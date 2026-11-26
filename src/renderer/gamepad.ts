/**
 * Gamepad support (Steam Deck, Xbox/PlayStation pads, Android controllers).
 * Uses the browser Gamepad API with the "standard" button layout; Steam Input
 * presents the Deck's controls and connected pads this way.
 *
 * Every connected controller is read: on a Steam Deck the built-in controls are
 * pad 0 and an extra controller (PS4/PS5/Xbox) is pad 1+, so reading only the
 * first pad would ignore the extra controller.
 */
export const PAD = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
} as const;
export type PadButton = (typeof PAD)[keyof typeof PAD];

/** Buttons we act on (standard layout indices). */
const WATCHED = [PAD.A, PAD.B, PAD.X, PAD.Y, PAD.LB, PAD.RB, PAD.LT, PAD.RT, PAD.VIEW, PAD.START, PAD.UP, PAD.DOWN, PAD.LEFT, PAD.RIGHT];

/** Pressed state of each watched button on one pad, in the standard layout. */
export function readPad(pad: Gamepad): boolean[] {
  const pressed: boolean[] = [];
  const btn = (i: number) => { const b = pad.buttons[i]; return !!b && (b.pressed || b.value > 0.6); };
  for (const i of WATCHED) pressed[i] = btn(i);
  // left stick acts like the D-pad
  const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
  if (ax < -0.6) pressed[PAD.LEFT] = true;
  if (ax > 0.6) pressed[PAD.RIGHT] = true;
  if (ay < -0.6) pressed[PAD.UP] = true;
  if (ay > 0.6) pressed[PAD.DOWN] = true;
  // pads without the standard mapping often report the D-pad as a hat on axes 6/7 (or 9)
  if (pad.mapping !== 'standard') {
    const hx = pad.axes[6], hy = pad.axes[7];
    if (hx !== undefined && hy !== undefined) {
      if (hx < -0.5) pressed[PAD.LEFT] = true;
      if (hx > 0.5) pressed[PAD.RIGHT] = true;
      if (hy < -0.5) pressed[PAD.UP] = true;
      if (hy > 0.5) pressed[PAD.DOWN] = true;
    }
  }
  return pressed;
}

export class GamepadInput {
  /** previous pressed state per pad index */
  private prev = new Map<number, boolean[]>();
  /** next auto-repeat time per "pad:button" */
  private repeatAt = new Map<string, number>();
  private announced = new Set<string>();
  constructor(private onPress: (b: number) => void, private onConnect: (name: string) => void) {
    window.addEventListener('gamepadconnected', (e) => {
      const id = (e as GamepadEvent).gamepad.id;
      if (!this.announced.has(id)) { this.announced.add(id); if (this.announced.size === 1) this.onConnect(id); }
    });
    window.addEventListener('gamepaddisconnected', (e) => this.prev.delete((e as GamepadEvent).gamepad.index));
  }

  /** Connected controllers, for the Settings panel. */
  list(): { index: number; id: string; mapping: string }[] {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return Array.from(pads).filter((p): p is Gamepad => !!p && p.connected).map((p) => ({ index: p.index, id: p.id, mapping: p.mapping || 'non-standard' }));
  }

  /** Call every frame. Fires onPress on button-down edges from any pad, with auto-repeat for the D-pad. */
  poll(nowMs: number) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of Array.from(pads)) {
      if (!pad || !pad.connected) continue;
      const pressed = readPad(pad);
      const before = this.prev.get(pad.index) ?? [];
      for (const i of WATCHED) {
        const isDir = i >= PAD.UP && i <= PAD.RIGHT;
        const key = pad.index + ':' + i;
        if (pressed[i] && !before[i]) {
          this.onPress(i);
          if (isDir) this.repeatAt.set(key, nowMs + 420);
        } else if (pressed[i] && isDir && nowMs >= (this.repeatAt.get(key) ?? Infinity)) {
          this.onPress(i);
          this.repeatAt.set(key, nowMs + 140);
        }
      }
      this.prev.set(pad.index, pressed);
    }
  }
}
