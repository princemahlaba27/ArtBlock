import { Platform } from 'react-native';

const MAX_EDGE = 420;
const EDGE_THRESHOLD = 48;
const INK = '#111118';

/**
 * Web line art: draw the photo into a canvas, convert it to grayscale, then run a
 * 3×3 Sobel kernel. Edges use the requested color and the paper field stays
 * transparent, so the overlay does not become a solid sheet. The bitmap is capped
 * at 420px so the convolution stays small. Native has no canvas here, so the
 * original URI is returned and the slot applies a grayscale, high-contrast
 * treatment instead of pretending this filter ran.
 */
export async function toLineArt(uri: string, edge: string = INK): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return uri;

  try {
    const image = await loadImage(uri);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height, 1));
    const width = Math.max(2, Math.round(image.width * scale));
    const height = Math.max(2, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return uri;
    context.drawImage(image, 0, 0, width, height);
    const source = context.getImageData(0, 0, width, height);
    const gray = new Float32Array(width * height);
    const pixels = source.data;
    for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
      gray[pixel] = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    }

    const [red, green, blue] = parseHex(edge);
    const output = context.createImageData(width, height);
    const dest = output.data;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const center = y * width + x;
        const gx =
          -gray[center - width - 1] +
          gray[center - width + 1] +
          -2 * gray[center - 1] +
          2 * gray[center + 1] +
          -gray[center + width - 1] +
          gray[center + width + 1];
        const gy =
          -gray[center - width - 1] -
          2 * gray[center - width] -
          gray[center - width + 1] +
          gray[center + width - 1] +
          2 * gray[center + width] +
          gray[center + width + 1];
        const magnitude = Math.hypot(gx, gy);
        if (magnitude < EDGE_THRESHOLD) continue;
        const offset = center * 4;
        dest[offset] = red;
        dest[offset + 1] = green;
        dest[offset + 2] = blue;
        dest[offset + 3] = 255;
      }
    }
    context.putImageData(output, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return uri;
  }
}

function parseHex(color: string): [number, number, number] {
  const hex = color.replace('#', '');
  const value = Number.parseInt(hex, 16);
  if (!Number.isFinite(value) || hex.length !== 6) return [17, 17, 24];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    if (/^https?:/i.test(uri)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The photo could not be read.'));
    image.src = uri;
  });
}
