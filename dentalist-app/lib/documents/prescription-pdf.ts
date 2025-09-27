import type { PngImage } from './png';
import { parsePng } from './png';

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

interface PdfContentOptions {
  title: string;
  patientName: string;
  patientDni: string;
  healthInsurance: string;
  affiliateNumber: string;
  professionalName: string;
  professionalDni?: string;
  professionalLicense?: string;
  professionalLocality?: string;
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
  const segments = normalized.split('\n');
  const lines: string[] = [];

  for (const segment of segments) {
    const words = segment.trim().length > 0 ? segment.trim().split(/\s+/) : [];
    if (words.length === 0) {
      lines.push('');
      continue;
    }

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
  }

  return lines.length > 0 ? lines : [''];
}

function fontWidth(text: string, size: number): number {
  // Helvetica aprox: cada unidad = size * 0.5 para caracteres alfanuméricos.
  // Es una aproximación suficiente para el envoltorio manual.
  return text.length * (size * 0.5);
}

function buildContentStream(
  options: PdfContentOptions,
  assets: {
    signature?: { image: PngImage; name: string };
    logo?: { image: PngImage; name: string };
  } = {},
): Buffer {
  const commands: string[] = [];

  // Fondo y borde
  commands.push('q');
  commands.push(`${toPdfColor(COLORS.background)} rg`);
  commands.push(`${toPdfColor(COLORS.border)} RG`);
  commands.push('1 w');
  commands.push(`${MARGIN} ${MARGIN} ${CONTENT_WIDTH} ${PAGE_HEIGHT - MARGIN * 2} re`);
  commands.push('B');
  commands.push('Q');

  const headerPaddingX = MARGIN + 20;
  const headerTop = PAGE_HEIGHT - MARGIN - 32;
  let cursorY = headerTop;

  const drawText = (font: 'F1' | 'F2', size: number, color: readonly [number, number, number], x: number, y: number, text: string) => {
    commands.push('BT');
    commands.push(`/${font} ${size} Tf`);
    commands.push(`${toPdfColor(color)} rg`);
    commands.push(`1 0 0 1 ${x} ${y} Tm`);
    commands.push(`(${encodeText(text)}) Tj`);
    commands.push('ET');
  };

  let headerTextX = headerPaddingX;
  let logoBottomY = headerTop;

  if (assets.logo) {
    const { image, name } = assets.logo;
    const maxWidth = 90;
    const maxHeight = 90;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const positionX = headerPaddingX;
    const positionY = headerTop - drawHeight + 6;

    commands.push('q');
    commands.push(`${drawWidth} 0 0 ${drawHeight} ${positionX} ${positionY} cm`);
    commands.push(`/${name} Do`);
    commands.push('Q');

    headerTextX = positionX + drawWidth + 16;
    logoBottomY = positionY - 12;
  }

  drawText('F2', 26, COLORS.title, headerTextX, cursorY, options.title);
  cursorY -= 44;

  cursorY = Math.min(cursorY, logoBottomY);

  drawText('F2', 18, COLORS.subtitle, headerPaddingX, cursorY, 'Datos del paciente');
  cursorY -= 26;

  const patientRows = [
    ['Nombre', options.patientName],
    ['DNI', options.patientDni],
    ['Obra Social', options.healthInsurance],
    ['N.º Afiliado', options.affiliateNumber],
  ] as const;

  for (const [label, value] of patientRows) {
    drawText('F2', 12, COLORS.label, headerPaddingX, cursorY, label);
    drawText('F1', 14, COLORS.value, headerPaddingX + 120, cursorY, value);
    cursorY -= 24;
  }

  const sections: Array<{ title: string; value: string }> = [
    { title: 'Diagnóstico', value: options.diagnosis || 'No especificado' },
    { title: 'Prescripción', value: `Rp/.\n${options.medication}`.trim() },
    { title: 'Indicaciones', value: options.instructions },
    { title: 'Notas adicionales', value: options.notes || 'Sin observaciones' },
  ];

  const paragraphWidth = CONTENT_WIDTH - 40;
  const lineHeight = 18;

  for (const section of sections) {
    drawText('F2', 18, COLORS.subtitle, headerPaddingX, cursorY, section.title);
    cursorY -= 24;

    const lines = wrapText(section.value, 14, paragraphWidth, fontWidth);
    for (const line of lines) {
      if (line === '') {
        cursorY -= lineHeight;
        continue;
      }
      drawText('F1', 14, COLORS.value, headerPaddingX, cursorY, line);
      cursorY -= lineHeight;
    }

    cursorY -= 24;
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

  if (assets.signature) {
    const { image, name } = assets.signature;
    const maxWidth = 190;
    const maxHeight = 90;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const signatureAreaWidth = signatureEndX - signatureStartX;
    const positionX = signatureStartX + (signatureAreaWidth - drawWidth) / 2;
    const positionY = signatureLineY + 10;

    commands.push('q');
    commands.push(`${drawWidth} 0 0 ${drawHeight} ${positionX} ${positionY} cm`);
    commands.push(`/${name} Do`);
    commands.push('Q');
  }

  drawText('F2', 12, COLORS.label, signatureStartX + 10, signatureLineY - 30, options.professionalName);

  const professionalDetails: string[] = [];
  if (options.professionalLicense) {
    professionalDetails.push(`Matrícula: ${options.professionalLicense}`);
  }
  if (options.professionalLocality) {
    professionalDetails.push(`Localidad: ${options.professionalLocality}`);
  } else if (options.professionalDni) {
    professionalDetails.push(`DNI: ${options.professionalDni}`);
  }

  const professionalLabel =
    professionalDetails.length > 0 ? professionalDetails.join(' · ') : 'Firma digital';

  drawText('F1', 11, COLORS.muted, signatureStartX + 10, signatureLineY - 48, professionalLabel);

  drawText('F2', 12, COLORS.label, headerPaddingX, signatureLineY - 18, `Fecha: ${formatDate(options.issuedAt)}`);

  return Buffer.from(commands.join('\n') + '\n', 'latin1');
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
  professionalLicense?: string;
  professionalLocality?: string;
  diagnosis?: string;
  medication: string;
  instructions: string;
  notes?: string;
  issuedAt?: Date;
  signatureDataUrl?: string;
  logo?: PngImage;
}

export async function generatePrescriptionPdf(options: PrescriptionPdfOptions): Promise<Buffer> {
  const issuedAt = options.issuedAt ?? new Date();
  const insuranceLabel = options.healthInsurance ? options.healthInsurance : 'Particular';
  const affiliateLabel = options.affiliateNumber?.trim() || 'No informado';

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
    title: options.title?.trim() || 'Receta digital',
    patientName: options.patientName,
    patientDni: options.patientDni ?? 'No informado',
    healthInsurance: insuranceLabel,
    affiliateNumber: affiliateLabel,
    professionalName: options.professionalName,
    professionalDni: options.professionalDni,
    professionalLicense: options.professionalLicense,
    diagnosis: options.diagnosis?.trim() || 'No especificado',
    medication: options.medication.trim(),
    instructions: options.instructions.trim(),
    notes: options.notes?.trim() || 'Sin observaciones',
    issuedAt,
  };

  const logo = options.logo;
  const signatureAsset = signature ? { image: signature, name: 'ImSign' } : undefined;
  const logoAsset = logo ? { image: logo, name: 'ImLogo' } : undefined;

  const contentStream = buildContentStream(pdfOptions, { signature: signatureAsset, logo: logoAsset });

  const objects: PdfObject[] = [];
  let idCounter = 1;

  const catalogId = idCounter++;
  const pagesId = idCounter++;
  const pageId = idCounter++;
  const fontRegularId = idCounter++;
  const fontBoldId = idCounter++;
  const logoImageId = logoAsset ? idCounter++ : null;
  const logoMaskId = logoAsset?.image.alpha ? idCounter++ : null;
  const signatureImageId = signatureAsset ? idCounter++ : null;
  const signatureMaskId = signatureAsset?.image.alpha ? idCounter++ : null;
  const contentId = idCounter++;

  objects.push(createObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`));
  objects.push(createObject(pagesId, `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`));

  const resourceEntries = [`/Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >>`];
  const xObjects: string[] = [];
  if (logoImageId && logoAsset) {
    xObjects.push(`/${logoAsset.name} ${logoImageId} 0 R`);
  }
  if (signatureImageId && signatureAsset) {
    xObjects.push(`/${signatureAsset.name} ${signatureImageId} 0 R`);
  }
  if (xObjects.length > 0) {
    resourceEntries.push(`/XObject << ${xObjects.join(' ')} >>`);
  }

  objects.push(
    createObject(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << ${resourceEntries.join(' ')} >> /Contents ${contentId} 0 R >>`,
    ),
  );

  objects.push(
    createObject(
      fontRegularId,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    ),
  );
  objects.push(
    createObject(
      fontBoldId,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ),
  );

  if (logoAsset && logoImageId) {
    if (logoMaskId && logoAsset.image.alpha) {
      objects.push(
        createStreamObject(logoMaskId, [
          '/Type /XObject',
          '/Subtype /Image',
          `/Width ${logoAsset.image.width}`,
          `/Height ${logoAsset.image.height}`,
          '/ColorSpace /DeviceGray',
          '/BitsPerComponent 8',
          '/Filter /FlateDecode',
        ], logoAsset.image.alpha),
      );
    }

    objects.push(
      createStreamObject(logoImageId, [
        '/Type /XObject',
        '/Subtype /Image',
        `/Width ${logoAsset.image.width}`,
        `/Height ${logoAsset.image.height}`,
        '/ColorSpace /DeviceRGB',
        '/BitsPerComponent 8',
        '/Filter /FlateDecode',
        ...(logoMaskId ? [`/SMask ${logoMaskId} 0 R`] : []),
      ], logoAsset.image.data),
    );
  }

  if (signatureAsset && signatureImageId) {
    if (signatureMaskId && signatureAsset.image.alpha) {
      objects.push(
        createStreamObject(signatureMaskId, [
          '/Type /XObject',
          '/Subtype /Image',
          `/Width ${signatureAsset.image.width}`,
          `/Height ${signatureAsset.image.height}`,
          '/ColorSpace /DeviceGray',
          '/BitsPerComponent 8',
          '/Filter /FlateDecode',
        ], signatureAsset.image.alpha),
      );
    }

    objects.push(
      createStreamObject(signatureImageId, [
        '/Type /XObject',
        '/Subtype /Image',
        `/Width ${signatureAsset.image.width}`,
        `/Height ${signatureAsset.image.height}`,
        '/ColorSpace /DeviceRGB',
        '/BitsPerComponent 8',
        '/Filter /FlateDecode',
        ...(signatureMaskId ? [`/SMask ${signatureMaskId} 0 R`] : []),
      ], signatureAsset.image.data),
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
