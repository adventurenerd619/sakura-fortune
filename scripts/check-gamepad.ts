// Simulates several controllers (Steam Deck built-in + a PS4 pad, and a non-standard pad)
// to check that input from every connected controller is read.
//   npx tsx scripts/check-gamepad.ts
import { GamepadInput, PAD } from '../src/renderer/gamepad';

const listeners: Record<string, ((e: any) => void)[]> = {};
(globalThis as any).window = { addEventListener: (t: string, f: any) => (listeners[t] ??= []).push(f) };
let pads: any[] = [];
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true });

const mk = (index: number, id: string, mapping = 'standard', axes = [0, 0, 0, 0]) => ({
  index, id, mapping, connected: true, axes: [...axes],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});
const deck = mk(0, 'Steam Virtual Gamepad (Steam Deck)');
const ps4 = mk(1, 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)');
pads = [deck, ps4];

const got: number[] = [];
const input = new GamepadInput((b) => got.push(b), () => {});
let t = 0;
const frame = () => input.poll((t += 16));
let fails = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fails++; };

// PS4 (second pad) presses Cross = A
frame(); ps4.buttons[PAD.A].pressed = true; frame(); ps4.buttons[PAD.A].pressed = false; frame();
check('second controller (PS4) A press is registered', got.join() === String(PAD.A));

// Deck still works
got.length = 0; deck.buttons[PAD.B].pressed = true; frame(); deck.buttons[PAD.B].pressed = false; frame();
check('built-in Deck controls still registered', got.join() === String(PAD.B));

// holding a button fires once (edge), D-pad auto-repeats
got.length = 0; ps4.buttons[PAD.START].pressed = true; for (let i = 0; i < 40; i++) frame(); ps4.buttons[PAD.START].pressed = false; frame();
check('held button fires once', got.filter((b) => b === PAD.START).length === 1);
got.length = 0; ps4.buttons[PAD.RIGHT].pressed = true; for (let i = 0; i < 60; i++) frame(); ps4.buttons[PAD.RIGHT].pressed = false; frame();
check('held D-pad auto-repeats', got.filter((b) => b === PAD.RIGHT).length >= 3);

// left stick on the PS4 pad
got.length = 0; ps4.axes[0] = -0.9; frame(); ps4.axes[0] = 0; frame();
check('left stick moves like the D-pad', got.join() === String(PAD.LEFT));

// both pads pressing at once each count
got.length = 0; deck.buttons[PAD.X].pressed = true; ps4.buttons[PAD.Y].pressed = true; frame();
check('presses on both controllers in the same frame', got.includes(PAD.X) && got.includes(PAD.Y));
deck.buttons[PAD.X].pressed = false; ps4.buttons[PAD.Y].pressed = false; frame();

// non-standard pad: D-pad reported as a hat on axes 6/7
const raw = mk(2, 'Generic USB Joystick', '', [0, 0, 0, 0, 0, 0, 0, 0]);
pads = [deck, ps4, raw];
got.length = 0; frame(); raw.axes[7] = -1; frame(); raw.axes[7] = 0; frame();
check('non-standard pad hat D-pad works', got.join() === String(PAD.UP));

check('Settings lists all controllers', input.list().length === 3);
console.log(fails ? `\n${fails} FAILED` : '\nAll gamepad checks passed');
process.exit(fails ? 1 : 0);
