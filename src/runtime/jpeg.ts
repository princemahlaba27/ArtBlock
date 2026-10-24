/**
 * Baseline JPEG decoder (SOF0). No Node buffers, so it can run inside the
 * React Native JS runtime. Progressive JPEGs are rejected by the caller.
 */

const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7,
  14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46,
  53, 60, 61, 54, 47, 55, 62, 63,
];

const COS = new Float64Array(64);
const CU = new Float64Array(8);
for (let k = 0; k < 8; k += 1) {
  CU[k] = k === 0 ? 1 / Math.SQRT2 : 1;
  for (let n = 0; n < 8; n += 1) {
    COS[k * 8 + n] = Math.cos(((2 * n + 1) * k * Math.PI) / 16);
  }
}

export type DecodedImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

type HuffTable = Array<Map<number, number>>;

type Component = {
  id: number;
  h: number;
  v: number;
  quantId: number;
  pred: number;
};

type ScanComponent = {
  component: Component;
  dcId: number;
  acId: number;
};

class BitReader {
  private buf = 0;
  private count = 0;

  constructor(
    private readonly data: Uint8Array,
    private pos: number,
  ) {}

  private pullByte(): number {
    if (this.pos >= this.data.length) return 0xff;
    const byte = this.data[this.pos++];
    if (byte !== 0xff) return byte;
    if (this.pos >= this.data.length) return 0xff;
    const next = this.data[this.pos++];
    if (next === 0x00) return 0xff;
    this.pos -= 2;
    throw new Error('The photo could not be read.');
  }

  bit(): number {
    if (this.count === 0) {
      this.buf = this.pullByte();
      this.count = 8;
    }
    this.count -= 1;
    return (this.buf >> this.count) & 1;
  }

  bits(length: number): number {
    let value = 0;
    let left = length;
    while (left > 0) {
      if (this.count === 0) {
        this.buf = this.pullByte();
        this.count = 8;
      }
      const take = Math.min(left, this.count);
      this.count -= take;
      value = (value << take) | ((this.buf >> this.count) & ((1 << take) - 1));
      left -= take;
    }
    return value;
  }

  /** Drop a partial byte so the next read starts on the following marker. */
  align(): void {
    this.count = 0;
    this.buf = 0;
  }

  marker(): number {
    this.align();
    if (this.pos >= this.data.length || this.data[this.pos] !== 0xff) {
      throw new Error('The photo could not be read.');
    }
    this.pos += 1;
    while (this.pos < this.data.length && this.data[this.pos] === 0xff) this.pos += 1;
    if (this.pos >= this.data.length) throw new Error('The photo could not be read.');
    return this.data[this.pos++];
  }
}

function buildHuffman(counts: Uint8Array, symbols: Uint8Array): HuffTable {
  const tables: HuffTable = [];
  for (let length = 0; length <= 16; length += 1) tables.push(new Map());
  let code = 0;
  let symbolIndex = 0;
  for (let length = 1; length <= 16; length += 1) {
    const count = counts[length - 1] ?? 0;
    for (let index = 0; index < count; index += 1) {
      const symbol = symbols[symbolIndex];
      if (symbol === undefined) throw new Error('The photo could not be read.');
      tables[length]?.set(code, symbol);
      symbolIndex += 1;
      code += 1;
    }
    code <<= 1;
  }
  return tables;
}

function readSymbol(reader: BitReader, table: HuffTable): number {
  let code = 0;
  for (let length = 1; length <= 16; length += 1) {
    code = (code << 1) | reader.bit();
    const symbol = table[length]?.get(code);
    if (symbol !== undefined) return symbol;
  }
  throw new Error('The photo could not be read.');
}

function readAmplitude(reader: BitReader, length: number): number {
  if (length === 0) return 0;
  const value = reader.bits(length);
  const threshold = 1 << (length - 1);
  if (value < threshold) return value - (1 << length) + 1;
  return value;
}

function idct(block: Float64Array, tmp: Float64Array): void {
  let onlyDc = true;
  for (let index = 1; index < 64; index += 1) {
    if (block[index] !== 0) {
      onlyDc = false;
      break;
    }
  }
  if (onlyDc) {
    block.fill(block[0] * 0.125);
    return;
  }

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      let sum = 0;
      const row = y * 8;
      for (let u = 0; u < 8; u += 1) {
        sum += CU[u] * block[row + u] * COS[u * 8 + x];
      }
      tmp[row + x] = sum;
    }
  }
  for (let x = 0; x < 8; x += 1) {
    for (let y = 0; y < 8; y += 1) {
      let sum = 0;
      for (let v = 0; v < 8; v += 1) {
        sum += CU[v] * tmp[v * 8 + x] * COS[v * 8 + y];
      }
      block[y * 8 + x] = sum * 0.25;
    }
  }
}

function readOrientation(segment: Uint8Array): number {
  if (segment.length < 16) return 1;
  if (segment[0] !== 0x45 || segment[1] !== 0x78 || segment[2] !== 0x69 || segment[3] !== 0x66) return 1;
  const tiff = 6;
  const little = segment[tiff] === 0x49 && segment[tiff + 1] === 0x49;
  const big = segment[tiff] === 0x4d && segment[tiff + 1] === 0x4d;
  if (!little && !big) return 1;
  const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
  const u16 = (offset: number) => view.getUint16(tiff + offset, little);
  const u32 = (offset: number) => view.getUint32(tiff + offset, little);
  if (u16(2) !== 0x002a) return 1;
  const ifd = u32(4);
  if (ifd < 8 || tiff + ifd + 2 > segment.length) return 1;
  const entries = u16(ifd);
  for (let index = 0; index < entries; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (tiff + entry + 12 > segment.length) break;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

function applyOrientation(image: DecodedImage, orientation: number): DecodedImage {
  if (orientation <= 1) return image;
  const { data, width, height } = image;
  const swap = orientation >= 5;
  const nextWidth = swap ? height : width;
  const nextHeight = swap ? width : height;
  const out = new Uint8Array(nextWidth * nextHeight * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let nx = x;
      let ny = y;
      if (orientation === 2) nx = width - 1 - x;
      else if (orientation === 3) {
        nx = width - 1 - x;
        ny = height - 1 - y;
      } else if (orientation === 4) ny = height - 1 - y;
      else if (orientation === 5) {
        nx = y;
        ny = x;
      } else if (orientation === 6) {
        nx = height - 1 - y;
        ny = x;
      } else if (orientation === 7) {
        nx = height - 1 - y;
        ny = width - 1 - x;
      } else if (orientation === 8) {
        nx = y;
        ny = width - 1 - x;
      }
      const from = (y * width + x) * 4;
      const to = (ny * nextWidth + nx) * 4;
      out[to] = data[from];
      out[to + 1] = data[from + 1];
      out[to + 2] = data[from + 2];
      out[to + 3] = data[from + 3];
    }
  }
  return { width: nextWidth, height: nextHeight, data: out };
}

function decodeBlock(
  reader: BitReader,
  component: Component,
  quant: Int32Array,
  dcTable: HuffTable,
  acTable: HuffTable,
  tmp: Float64Array,
): Float64Array {
  const block = new Float64Array(64);
  const dcLength = readSymbol(reader, dcTable);
  component.pred += readAmplitude(reader, dcLength);
  block[0] = component.pred * quant[0];
  let index = 1;
  while (index < 64) {
    const symbol = readSymbol(reader, acTable);
    if (symbol === 0) break;
    if (symbol === 0xf0) {
      index += 16;
      continue;
    }
    index += symbol >> 4;
    const size = symbol & 15;
    const amplitude = readAmplitude(reader, size);
    if (index < 64) block[ZIGZAG[index]] = amplitude * quant[index];
    index += 1;
  }
  idct(block, tmp);
  return block;
}

function clampByte(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

export async function decodeJpeg(bytes: Uint8Array): Promise<DecodedImage> {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('The photo could not be read.');
  }

  const quantTables: Int32Array[] = [];
  const dcTables: HuffTable[] = [];
  const acTables: HuffTable[] = [];
  let width = 0;
  let height = 0;
  let components: Component[] = [];
  let restartInterval = 0;
  let orientation = 1;
  let pos = 2;
  let scan: ScanComponent[] | null = null;

  while (pos + 1 < bytes.length) {
    if (bytes[pos] !== 0xff) throw new Error('The photo could not be read.');
    while (bytes[pos] === 0xff) pos += 1;
    const marker = bytes[pos++];
    if (marker === 0xd9) break;
    if (marker === 0xda) {
      const length = (bytes[pos] << 8) | bytes[pos + 1];
      const segment = bytes.subarray(pos + 2, pos + length);
      pos += length;
      scan = readScan(segment, components);
      break;
    }
    if (marker === 0xd8) continue;
    const length = (bytes[pos] << 8) | bytes[pos + 1];
    if (length < 2 || pos + length > bytes.length) throw new Error('The photo could not be read.');
    const segment = bytes.subarray(pos + 2, pos + length);
    pos += length;
    if (marker === 0xc0) {
      const frame = readFrame(segment);
      width = frame.width;
      height = frame.height;
      components = frame.components;
    } else if (marker === 0xc4) {
      readHuffman(segment, dcTables, acTables);
    } else if (marker === 0xdb) {
      readQuant(segment, quantTables);
    } else if (marker === 0xdd && segment.length >= 2) {
      restartInterval = (segment[0] << 8) | segment[1];
    } else if (marker === 0xe1) {
      const next = readOrientation(segment);
      if (next > 1) orientation = next;
    } else if (marker >= 0xc1 && marker <= 0xcf) {
      throw new Error('The photo could not be read.');
    }
  }

  if (!scan || width < 2 || height < 2 || components.length === 0) {
    throw new Error('The photo could not be read.');
  }
  if (width * height > 20_000_000) throw new Error('The photo could not be read.');

  const maxH = components.reduce((max, component) => Math.max(max, component.h), 1);
  const maxV = components.reduce((max, component) => Math.max(max, component.v), 1);
  const mcuWidth = maxH * 8;
  const mcuHeight = maxV * 8;
  const mcusX = Math.ceil(width / mcuWidth);
  const mcusY = Math.ceil(height / mcuHeight);
  const planes = components.map(() => new Uint8Array(width * height));
  for (const plane of planes) plane.fill(128);

  const reader = new BitReader(bytes, pos);
  const idctTmp = new Float64Array(64);
  const componentIndex = new Map(components.map((component, index) => [component.id, index]));
  let mcu = 0;
  for (let my = 0; my < mcusY; my += 1) {
    for (let mx = 0; mx < mcusX; mx += 1) {
      if (restartInterval > 0 && mcu > 0 && mcu % restartInterval === 0) {
        const marker = reader.marker();
        if (marker < 0xd0 || marker > 0xd7) throw new Error('The photo could not be read.');
        for (const component of components) component.pred = 0;
      }
      for (const part of scan) {
        const quant = quantTables[part.component.quantId];
        const dc = dcTables[part.dcId];
        const ac = acTables[part.acId];
        if (!quant || !dc || !ac) throw new Error('The photo could not be read.');
        const planeIndex = componentIndex.get(part.component.id) ?? 0;
        const plane = planes[planeIndex];
        const scaleX = mcuWidth / part.component.h / 8;
        const scaleY = mcuHeight / part.component.v / 8;
        for (let by = 0; by < part.component.v; by += 1) {
          for (let bx = 0; bx < part.component.h; bx += 1) {
            const block = decodeBlock(reader, part.component, quant, dc, ac, idctTmp);
            const originX = mx * mcuWidth + bx * 8 * scaleX;
            const originY = my * mcuHeight + by * 8 * scaleY;
            for (let py = 0; py < 8; py += 1) {
              for (let px = 0; px < 8; px += 1) {
                const value = clampByte(block[py * 8 + px] + 128);
                const x0 = originX + px * scaleX;
                const y0 = originY + py * scaleY;
                for (let sy = 0; sy < scaleY; sy += 1) {
                  const sampleY = y0 + sy;
                  if (sampleY >= height) continue;
                  for (let sx = 0; sx < scaleX; sx += 1) {
                    const sampleX = x0 + sx;
                    if (sampleX >= width || !plane) continue;
                    plane[sampleY * width + sampleX] = value;
                  }
                }
              }
            }
          }
        }
      }
      mcu += 1;
      if ((mcu & 255) === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  const yPlane = planes[0];
  const cbPlane = planes[1];
  const crPlane = planes[2];
  const color = components.length >= 3 && yPlane && cbPlane && crPlane;
  for (let index = 0; index < width * height; index += 1) {
    const y = yPlane?.[index] ?? 0;
    const offset = index * 4;
    if (color && cbPlane && crPlane) {
      const cb = cbPlane[index] - 128;
      const cr = crPlane[index] - 128;
      rgba[offset] = clampByte(y + 1.402 * cr);
      rgba[offset + 1] = clampByte(y - 0.344136 * cb - 0.714136 * cr);
      rgba[offset + 2] = clampByte(y + 1.772 * cb);
    } else {
      rgba[offset] = y;
      rgba[offset + 1] = y;
      rgba[offset + 2] = y;
    }
    rgba[offset + 3] = 255;
  }

  return applyOrientation({ width, height, data: rgba }, orientation);
}

function readFrame(segment: Uint8Array): { width: number; height: number; components: Component[] } {
  if (segment.length < 6 || segment[0] !== 8) throw new Error('The photo could not be read.');
  const height = (segment[1] << 8) | segment[2];
  const width = (segment[3] << 8) | segment[4];
  const count = segment[5];
  if (segment.length < 6 + count * 3) throw new Error('The photo could not be read.');
  const components: Component[] = [];
  for (let index = 0; index < count; index += 1) {
    const base = 6 + index * 3;
    const sampling = segment[base + 1];
    components.push({
      id: segment[base],
      h: sampling >> 4,
      v: sampling & 15,
      quantId: segment[base + 2],
      pred: 0,
    });
  }
  if (components.some((component) => component.h < 1 || component.v < 1 || component.h > 4 || component.v > 4)) {
    throw new Error('The photo could not be read.');
  }
  return { width, height, components };
}

function readQuant(segment: Uint8Array, tables: Int32Array[]): void {
  let pos = 0;
  while (pos < segment.length) {
    const header = segment[pos++];
    const id = header & 15;
    const precision = header >> 4;
    const values = new Int32Array(64);
    if (precision === 0) {
      if (pos + 64 > segment.length) throw new Error('The photo could not be read.');
      for (let index = 0; index < 64; index += 1) values[index] = segment[pos++];
    } else {
      if (pos + 128 > segment.length) throw new Error('The photo could not be read.');
      for (let index = 0; index < 64; index += 1) {
        values[index] = (segment[pos] << 8) | segment[pos + 1];
        pos += 2;
      }
    }
    tables[id] = values;
  }
}

function readHuffman(segment: Uint8Array, dcTables: HuffTable[], acTables: HuffTable[]): void {
  let pos = 0;
  while (pos < segment.length) {
    const header = segment[pos++];
    const counts = segment.subarray(pos, pos + 16);
    pos += 16;
    let total = 0;
    for (let index = 0; index < 16; index += 1) total += counts[index] ?? 0;
    const symbols = segment.subarray(pos, pos + total);
    pos += total;
    const table = buildHuffman(counts, symbols);
    const id = header & 15;
    if (header >> 4 === 0) dcTables[id] = table;
    else acTables[id] = table;
  }
}

function readScan(segment: Uint8Array, components: Component[]): ScanComponent[] {
  if (segment.length < 1) throw new Error('The photo could not be read.');
  const count = segment[0];
  if (segment.length < 1 + count * 2) throw new Error('The photo could not be read.');
  const scan: ScanComponent[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = segment[1 + index * 2];
    const tables = segment[2 + index * 2];
    const component = components.find((item) => item.id === id);
    if (!component) throw new Error('The photo could not be read.');
    scan.push({ component, dcId: tables >> 4, acId: tables & 15 });
  }
  return scan;
}
