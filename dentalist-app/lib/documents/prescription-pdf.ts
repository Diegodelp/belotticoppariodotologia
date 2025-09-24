import { deflateSync, inflateSync } from 'zlib';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  title: [15, 23, 42] as const,
  subtitle: [30, 41, 59] as const,
  label: [31, 41, 55] as const,
  value: [17, 24, 39] as const,
  muted: [107, 114, 128] as const,
  border: [226, 232, 240] as const,
  background: [248, 250, 252] as const,
};

interface PngImage {
  width: number;
  height: number;
  data: Buffer;
}

interface PdfContentOptions {
  title: string;
  patientName: string;
  patientDni: string;
  healthInsurance: string;
  professionalName: string;
  professionalDni?: string;
  diagnosis: string;
  medication: string;
  instructions: string;
  notes: string;
  issuedAt: Date;
}

function formatDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return formatter.format(date);
}

function toPdfColor(color: readonly [number, number, number]): string {
  return color
    .map((component) => (component / 255).toFixed(3))
    .map((value) => value.replace(/0+$/, '').replace(/\.$/, ''))
    .join(' ');
}

function encodeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
  fontWidthCalculator: (value: string, size: number) => number,
): string[] {
  const normalized = text.replace(/\r/g, '');
  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (fontWidthCalculator(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

function parsePng(buffer: Buffer): PngImage {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) {
    throw new Error('La firma digital tiene un formato PNG inválido');
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
        throw new Error('Soportamos firmas PNG de 32 bits RGBA');
      }
    } else if (type === 'IDAT') {
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4; // saltar CRC
  }

  if (!width || !height) {
    throw new Error('No pudimos leer el ancho y alto de la firma');
  }

  const compressed = Buffer.concat(idatChunks);
  const decompressed = inflateSync(compressed);
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const rgbBytes = Buffer.alloc(width * height * 3);

  let srcOffset = 0;
  let dstOffset = 0;

  for (let y = 0; y < height; y++) {
    const filter = decompressed.readUInt8(srcOffset);
    if (filter !== 0) {
      throw new Error('La firma utiliza un filtro PNG no soportado');
    }
    srcOffset += 1;

    for (let x = 0; x < stride; x += bytesPerPixel) {
      const r = decompressed[srcOffset + x];
      const g = decompressed[srcOffset + x + 1];
      const b = decompressed[srcOffset + x + 2];
      const a = decompressed[srcOffset + x + 3] / 255;

      const outR = Math.round(r * a + 255 * (1 - a));
      const outG = Math.round(g * a + 255 * (1 - a));
      const outB = Math.round(b * a + 255 * (1 - a));

      rgbBytes[dstOffset++] = outR;
      rgbBytes[dstOffset++] = outG;
      rgbBytes[dstOffset++] = outB;
    }

    srcOffset += stride;
  }

  const recompressed = deflateSync(rgbBytes);
  return { width, height, data: recompressed };
}

function fontWidth(text: string, size: number): number {
  // Helvetica aprox: cada unidad = size * 0.5 para caracteres alfanuméricos.
  // Es una aproximación suficiente para el envoltorio manual.
  return text.length * (size * 0.5);
}

function buildContentStream(options: PdfContentOptions, signature?: PngImage): Buffer {
  const commands: string[] = [];

  // Fondo y borde
  commands.push('q');
  commands.push(`${toPdfColor(COLORS.background)} rg`);
  commands.push(`${toPdfColor(COLORS.border)} RG`);
  commands.push('1 w');
  commands.push(`${MARGIN} ${MARGIN} ${CONTENT_WIDTH} ${PAGE_HEIGHT - MARGIN * 2} re`);
  commands.push('B');
  commands.push('Q');

  let cursorY = PAGE_HEIGHT - MARGIN - 40;

  const drawText = (font: 'F1' | 'F2', size: number, color: readonly [number, number, number], x: number, y: number, text: string) => {
    commands.push('BT');
    commands.push(`/${font} ${size} Tf`);
    commands.push(`${toPdfColor(color)} rg`);
    commands.push(`1 0 0 1 ${x} ${y} Tm`);
    commands.push(`(${encodeText(text)}) Tj`);
    commands.push('ET');
  };

  drawText('F2', 26, COLORS.title, MARGIN + 20, cursorY, options.title);
  cursorY -= 30;

  drawText('F1', 12, COLORS.muted, MARGIN + 20, cursorY, `Emitido el ${formatDate(options.issuedAt)}`);
  cursorY -= 40;

  drawText('F2', 18, COLORS.subtitle, MARGIN + 20, cursorY, 'Datos del paciente');
  cursorY -= 26;

  const patientRows = [
    ['Nombre', options.patientName],
    ['DNI', options.patientDni],
    ['Cobertura', options.healthInsurance],
  ] as const;

  for (const [label, value] of patientRows) {
    drawText('F2', 12, COLORS.label, MARGIN + 20, cursorY, label);
    drawText('F1', 14, COLORS.value, MARGIN + 140, cursorY, value);
    cursorY -= 24;
  }

  const sections: Array<{ title: string; value: string }> = [
    { title: 'Diagnóstico', value: options.diagnosis || 'No especificado' },
    { title: 'Medicaciones / Tratamiento indicado', value: options.medication },
    { title: 'Indicaciones', value: options.instructions },
    { title: 'Notas adicionales', value: options.notes || 'Sin observaciones' },
  ];

  const paragraphWidth = CONTENT_WIDTH - 40;
  const lineHeight = 18;

  for (const section of sections) {
    drawText('F2', 18, COLORS.subtitle, MARGIN + 20, cursorY, section.title);
    cursorY -= 24;

    const lines = wrapText(section.value, 14, paragraphWidth, fontWidth);
    for (const line of lines) {
      drawText('F1', 14, COLORS.value, MARGIN + 20, cursorY, line);
      cursorY -= lineHeight;
    }

    cursorY -= 12;
  }

  const signatureLineY = MARGIN + 140;
  const signatureStartX = PAGE_WIDTH - MARGIN - 220;
  const signatureEndX = PAGE_WIDTH - MARGIN - 20;

  commands.push('q');
  commands.push(`${toPdfColor(COLORS.border)} RG`);
  commands.push('2 w');
  commands.push(`${signatureStartX} ${signatureLineY} m`);
  commands.push(`${signatureEndX} ${signatureLineY} l`);
  commands.push('S');
  commands.push('Q');

  if (signature) {
    const desiredWidth = 190;
    const desiredHeight = 90;
    const scaleX = desiredWidth;
    const scaleY = desiredHeight;
    const positionX = signatureEndX - desiredWidth;
    const positionY = signatureLineY - desiredHeight + 20;

    commands.push('q');
    commands.push(`${scaleX} 0 0 ${scaleY} ${positionX} ${positionY} cm`);
    commands.push('/Im1 Do');
    commands.push('Q');
  }

  drawText('F2', 12, COLORS.label, signatureStartX + 10, signatureLineY - 30, options.professionalName);

  const professionalLabel = options.professionalDni
    ? `Matrícula / DNI: ${options.professionalDni}`
    : 'Firma digital';

  drawText('F1', 11, COLORS.muted, signatureStartX + 10, signatureLineY - 48, professionalLabel);

  return Buffer.from(commands.join('\n') + '\n', 'utf8');
}

interface PdfObject {
  id: number;
  content: Buffer;
}

function createObject(id: number, body: string): PdfObject {
  const content = Buffer.from(`${id} 0 obj\n${body}\nendobj\n`, 'utf8');
  return { id, content };
}

function createStreamObject(id: number, dictionary: string[], stream: Buffer): PdfObject {
  const header = `${id} 0 obj\n<<\n${dictionary.join('\n')}\n/Length ${stream.length}\n>>\nstream\n`;
  const footer = '\nendstream\nendobj\n';
  const content = Buffer.concat([Buffer.from(header, 'utf8'), stream, Buffer.from(footer, 'utf8')]);
  return { id, content };
}

export interface PrescriptionPdfOptions {
  title: string;
  patientName: string;
  patientDni?: string;
  healthInsurance?: string;
  affiliateNumber?: string;
  professionalName: string;
  professionalDni?: string;
  diagnosis?: string;
  medication: string;
  instructions: string;
  notes?: string;
  issuedAt?: Date;
  signatureDataUrl?: string;
}

export async function generatePrescriptionPdf(options: PrescriptionPdfOptions): Promise<Buffer> {
  const issuedAt = options.issuedAt ?? new Date();
  const insuranceLabel = options.healthInsurance
    ? `${options.healthInsurance}${options.affiliateNumber ? ` · N.º ${options.affiliateNumber}` : ''}`
    : 'Particular';

  let signature: PngImage | undefined;
  if (options.signatureDataUrl) {
    const matches = /^data:(.+);base64,(.+)$/.exec(options.signatureDataUrl);
    if (matches) {
      const base64 = matches[2];
      const buffer = Buffer.from(base64, 'base64');
      try {
        signature = parsePng(buffer);
      } catch (error) {
        console.warn('No pudimos procesar la firma como PNG', error);
      }
    }
  }

  const pdfOptions: PdfContentOptions = {
    title: options.title,
    patientName: options.patientName,
    patientDni: options.patientDni ?? 'No informado',
    healthInsurance: insuranceLabel,
    professionalName: options.professionalName,
    professionalDni: options.professionalDni,
    diagnosis: options.diagnosis?.trim() || 'No especificado',
    medication: options.medication.trim(),
    instructions: options.instructions.trim(),
    notes: options.notes?.trim() || 'Sin observaciones',
    issuedAt,
  };

  const contentStream = buildContentStream(pdfOptions, signature);

  const objects: PdfObject[] = [];
  let idCounter = 1;

  const catalogId = idCounter++;
  const pagesId = idCounter++;
  const pageId = idCounter++;
  const fontRegularId = idCounter++;
  const fontBoldId = idCounter++;
  const imageId = signature ? idCounter++ : null;
  const contentId = idCounter++;

  objects.push(createObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`));
  objects.push(createObject(pagesId, `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`));

  const resourceEntries = [`/Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >>`];
  if (imageId) {
    resourceEntries.push(`/XObject << /Im1 ${imageId} 0 R >>`);
  }

  objects.push(
    createObject(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << ${resourceEntries.join(' ')} >> /Contents ${contentId} 0 R >>`,
    ),
  );

  objects.push(createObject(fontRegularId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));
  objects.push(createObject(fontBoldId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'));

  if (signature && imageId) {
    objects.push(
      createStreamObject(imageId, [
        '/Type /XObject',
        '/Subtype /Image',
        `/Width ${signature.width}`,
        `/Height ${signature.height}`,
        '/ColorSpace /DeviceRGB',
        '/BitsPerComponent 8',
        '/Filter /FlateDecode',
      ], signature.data),
    );
  }

  objects.push(createStreamObject(contentId, [], contentStream));

  objects.sort((a, b) => a.id - b.id);

  const header = Buffer.from('%PDF-1.4\n', 'utf8');
  const body: Buffer[] = [header];
  const xref: string[] = ['0000000000 65535 f \n'];

  let offset = header.length;
  for (const object of objects) {
    const padded = offset.toString().padStart(10, '0');
    xref.push(`${padded} 00000 n \n`);
    body.push(object.content);
    offset += object.content.length;
  }

  const xrefOffset = offset;
  const xrefSection = Buffer.from(`xref\n0 ${objects.length + 1}\n${xref.join('')}\n`, 'utf8');
  const trailer = Buffer.from(
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
    'utf8',
  );

  body.push(xrefSection, trailer);
  return Buffer.concat(body);
}
