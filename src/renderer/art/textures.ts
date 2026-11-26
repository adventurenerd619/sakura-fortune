import { Texture } from 'pixi.js';
import * as A from './svg';

async function svgToTexture(svg: string, scale = 1): Promise<Texture> {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(img.width * scale);
  canvas.height = Math.ceil(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const t = Texture.from(canvas);
  t.source.scaleMode = 'linear';
  return t;
}

export const TEX: Record<string, Texture> = {};
/** resolution factor symbol textures are rendered at (sprites are scaled by 1/RES) */
export const RES = 1.5;

export async function loadTextures(onProgress?: (p: number) => void) {
  const jobs: [string, string, number][] = [
    ...A.SYMBOL_SVGS.map((f, i) => [`sym${i}`, f(), RES] as [string, string, number]),
    ['frame', A.frameSvg(1022, 600), 1],
    ['frameNight', A.frameSvg(1022, 600, true), 1],
    ['dusk', A.duskSceneSvg(), 1],
    ['night', A.nightSceneSvg(), 1],
    ['mountain', A.mountainSceneSvg(), 1],
    ['petal', A.petalSvg(), 1],
    ['petalWhite', A.petalSvg('#fff4f6'), 1],
    ['sparkle', A.sparkleSvg(), 1],
    ['sparkleBlue', A.sparkleSvg('#bfe6ff'), 1],
    ['glow', A.glowSvg(), 1],
    ['glowBlue', A.glowSvg('#9ad8ff'), 1],
    ['floatLantern', A.floatLanternSvg(), 1.5],
    ['lanternLit', A.paperLanternSvg(true), 1.5],
    ['lanternOff', A.paperLanternSvg(false), 1.5],
    ['omikujiBox', A.omikujiBoxSvg(), 1.5],
    ['omikujiStick', A.omikujiStickSvg(), 1.5],
    ['pine', A.pineBranchSvg(), 1.5],
    ['stone', A.stoneSvg(), 1.5],
    ['stoneGate', A.stoneSvg('#b8a17a'), 1.5],
    ['gate', A.smallToriiSvg(false), 1.5],
    ['gateLit', A.smallToriiSvg(true), 1.5],
    ['shrine', A.shrineSvg(), 1.5],
    ['fox', A.foxTokenSvg(), 1.5],
    ['sp_offering', A.spaceIconSvg('offering'), 1.5],
    ['sp_lantern', A.spaceIconSvg('lantern'), 1.5],
    ['sp_ema', A.spaceIconSvg('ema'), 1.5],
    ['sp_fox', A.spaceIconSvg('fox'), 1.5],
    ['sp_mist', A.spaceIconSvg('mist'), 1.5],
    ['m_cushion', A.mascotCushion(), 1],
    ['m_body', A.mascotBody(), 1],
    ['m_armUp', A.mascotArmUp(), 1],
    ['m_armDown', A.mascotArmDown(), 1],
    ['m_head', A.mascotHead(), 1],
    ['m_eyes_open', A.mascotEyes('open'), 1],
    ['m_eyes_happy', A.mascotEyes('happy'), 1],
    ['m_eyes_closed', A.mascotEyes('closed'), 1],
    ['m_eyes_wide', A.mascotEyes('wide'), 1],
    ['m_mouth_smile', A.mascotMouth('smile'), 1],
    ['m_mouth_open', A.mascotMouth('open'), 1],
    ['m_mouth_sleep', A.mascotMouth('sleep'), 1],
  ];
  let done = 0;
  await Promise.all(jobs.map(async ([k, svg, s]) => {
    TEX[k] = await svgToTexture(svg, s);
    done++;
    onProgress?.(done / jobs.length);
  }));
}
