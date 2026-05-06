/**
 * Shared image fixture buffers for tests that need real sharp-processable data.
 */

export let JPEG_1x1: Buffer;
export let PNG_1x1: Buffer;
export let WEBP_1x1: Buffer;
export let ANIMATED_GIF: Buffer;

export async function createImageFixtures() {
  const mod = await import('sharp');
  const sharp = mod.default ?? (mod as unknown as typeof mod.default);
  const base = sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 128, g: 128, b: 128 } },
  });
  JPEG_1x1 = await base.clone().jpeg({ quality: 80 }).toBuffer();
  WEBP_1x1 = await base.clone().webp({ quality: 80 }).toBuffer();
  PNG_1x1 = await base.clone().png().toBuffer();

  ANIMATED_GIF = Buffer.alloc(100, 0x00);
  ANIMATED_GIF[10] = 0x2c;
  ANIMATED_GIF[20] = 0x2c;
}
