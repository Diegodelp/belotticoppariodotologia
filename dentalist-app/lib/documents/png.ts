import { deflateSync, inflateSync } from 'node:zlib';

export interface PngImage {
  width: number;
  height: number;
  data: Buffer;
  alpha?: Buffer;
}

export function parsePng(buffer: Buffer): PngImage {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) {
    throw new Error('El archivo no es un PNG válido');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (type === 'IHDR') {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      const bitDepth = buffer.readUInt8(dataStart + 8);
      const colorType = buffer.readUInt8(dataStart + 9);
      if (bitDepth !== 8 || colorType !== 6) {
        throw new Error('Solo se admiten PNG RGBA de 32 bits');
      }
    } else if (type === 'IDAT') {
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!width || !height) {
    throw new Error('No pudimos leer las dimensiones del PNG');
  }

  const compressed = Buffer.concat(idatChunks);
  const decompressed = inflateSync(compressed);
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const rgbBytes = Buffer.alloc(width * height * 3);
  const alphaBytes = Buffer.alloc(width * height);
  const decodedRow = Buffer.alloc(stride);
  const previousRow = Buffer.alloc(stride);

  let srcOffset = 0;
  let dstOffset = 0;
  let alphaOffset = 0;

  const paethPredictor = (left: number, up: number, upLeft: number) => {
    const p = left + up - upLeft;
    const pa = Math.abs(p - left);
    const pb = Math.abs(p - up);
    const pc = Math.abs(p - upLeft);
    if (pa <= pb && pa <= pc) return left;
    if (pb <= pc) return up;
    return upLeft;
  };

  for (let y = 0; y < height; y++) {
    const filter = decompressed.readUInt8(srcOffset);
    srcOffset += 1;

    for (let x = 0; x < stride; x++) {
      const raw = decompressed[srcOffset + x];
      const left = x >= bytesPerPixel ? decodedRow[x - bytesPerPixel] : 0;
      const up = previousRow[x];
      const upLeft = x >= bytesPerPixel ? previousRow[x - bytesPerPixel] : 0;

      let value: number;
      switch (filter) {
        case 0:
          value = raw;
          break;
        case 1:
          value = (raw + left) & 0xff;
          break;
        case 2:
          value = (raw + up) & 0xff;
          break;
        case 3:
          value = (raw + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          value = (raw + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`Filtro PNG ${filter} no soportado`);
      }

      decodedRow[x] = value;
    }

    for (let x = 0; x < stride; x += bytesPerPixel) {
      const r = decodedRow[x];
      const g = decodedRow[x + 1];
      const b = decodedRow[x + 2];
      const a = decodedRow[x + 3];

      rgbBytes[dstOffset++] = r;
      rgbBytes[dstOffset++] = g;
      rgbBytes[dstOffset++] = b;
      alphaBytes[alphaOffset++] = a;
    }

    decodedRow.copy(previousRow);
    srcOffset += stride;
  }

  const recompressed = deflateSync(rgbBytes);
  const alphaCompressed = deflateSync(alphaBytes);
  return { width, height, data: recompressed, alpha: alphaCompressed };
}
