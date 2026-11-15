export const IMAGE_SIZE = 32;
export const IMAGE_PIXELS = IMAGE_SIZE * IMAGE_SIZE * 3;

const GRID = 8;
const BLOCK = IMAGE_SIZE / GRID;

/** Color and layout features. Must match scripts/train-eye-classifier.py. */
export function eyeFeatures(pixels: number[]): number[] {
  if (pixels.length !== IMAGE_PIXELS) {
    throw new Error(`Expected ${IMAGE_PIXELS} RGB values.`);
  }

  const grid: number[] = [];
  for (let gy = 0; gy < GRID; gy += 1) {
    for (let gx = 0; gx < GRID; gx += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let y = 0; y < BLOCK; y += 1) {
        for (let x = 0; x < BLOCK; x += 1) {
          const index = ((gy * BLOCK + y) * IMAGE_SIZE + (gx * BLOCK + x)) * 3;
          red += pixels[index];
          green += pixels[index + 1];
          blue += pixels[index + 2];
        }
      }
      const count = BLOCK * BLOCK;
      grid.push(red / count, green / count, blue / count);
    }
  }

  const mean = channelMean(pixels, () => true);
  const std = channelStd(pixels, mean);
  const centerMean = channelMean(pixels, (row, col) => row >= 8 && row < 24 && col >= 8 && col < 24);
  const borderMean = channelMean(
    pixels,
    (row, col) => row < 8 || row >= 24 || col < 8 || col >= 24,
  );
  const left = channelMean(pixels, (_row, col) => col < 16);
  const right = channelMean(pixels, (_row, col) => col >= 16);
  const top = channelMean(pixels, (row) => row < 16);
  const bottom = channelMean(pixels, (row) => row >= 16);
  const leftRight = left.map((value, index) => Math.abs(value - right[index]));
  const topBottom = top.map((value, index) => Math.abs(value - bottom[index]));

  return [...grid, ...mean, ...std, ...centerMean, ...borderMean, ...leftRight, ...topBottom, ...centerHue(pixels)];
}

function channelMean(pixels: number[], include: (row: number, col: number) => boolean): number[] {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let row = 0; row < IMAGE_SIZE; row += 1) {
    for (let col = 0; col < IMAGE_SIZE; col += 1) {
      if (!include(row, col)) continue;
      const index = (row * IMAGE_SIZE + col) * 3;
      red += pixels[index];
      green += pixels[index + 1];
      blue += pixels[index + 2];
      count += 1;
    }
  }
  return [red / count, green / count, blue / count];
}

function channelStd(pixels: number[], mean: number[]): number[] {
  let red = 0;
  let green = 0;
  let blue = 0;
  const count = IMAGE_SIZE * IMAGE_SIZE;
  for (let offset = 0; offset < pixels.length; offset += 3) {
    red += (pixels[offset] - mean[0]) ** 2;
    green += (pixels[offset + 1] - mean[1]) ** 2;
    blue += (pixels[offset + 2] - mean[2]) ** 2;
  }
  return [Math.sqrt(red / count), Math.sqrt(green / count), Math.sqrt(blue / count)];
}

function centerHue(pixels: number[]): number[] {
  const bins = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let row = 8; row < 24; row += 1) {
    for (let col = 8; col < 24; col += 1) {
      const index = (row * IMAGE_SIZE + col) * 3;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const delta = max - min;
      const saturation = max > 0 ? delta / max : 0;
      if (!(saturation > 0.15 && max > 0.1)) continue;
      let hue = 0;
      if (delta > 1e-6 && max === red) hue = modulo((green - blue) / delta, 6);
      if (delta > 1e-6 && max === green) hue = (blue - red) / delta + 2;
      if (delta > 1e-6 && max === blue) hue = (red - green) / delta + 4;
      const bin = Math.min(Math.floor((hue / 6) * 8), 7);
      bins[bin] += 1;
    }
  }
  const total = bins.reduce((sum, value) => sum + value, 0);
  if (total === 0) return bins;
  return bins.map((value) => value / total);
}

function modulo(value: number, base: number): number {
  return ((value % base) + base) % base;
}
