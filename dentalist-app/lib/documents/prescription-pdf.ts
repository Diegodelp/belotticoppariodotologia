import type { PngImage } from './png';
import { parsePng } from './png';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  title: [15, 23, 42] as const,
  subtitle: [30, 41, 59] as const,
  label: [51, 65, 85] as const,
  value: [15, 23, 42] as const,
  muted: [100, 116, 139] as const,
  border: [226, 232, 240] as const,
  background: [248, 250, 252] as const,
  headerBackground: [224, 242, 254] as const,
  panel: [255, 255, 255] as const,
  divider: [203, 213, 225] as const,
  accent: [14, 116, 144] as const,
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

  const bodyPaddingX = 28;
  const headerHeight = 118;
  const headerTop = PAGE_HEIGHT - MARGIN;
  const headerBottom = headerTop - headerHeight;

  commands.push('q');
  commands.push(`${toPdfColor(COLORS.headerBackground)} rg`);
  commands.push(`${MARGIN} ${headerBottom} ${CONTENT_WIDTH} ${headerHeight} re`);
  commands.push('f');
  commands.push('Q');

  commands.push('q');
  commands.push(`${toPdfColor(COLORS.border)} RG`);
  commands.push('1 w');
  commands.push(`${MARGIN} ${headerBottom} ${CONTENT_WIDTH} ${headerHeight} re`);
  commands.push('S');
  commands.push('Q');

  const headerPaddingX = MARGIN + bodyPaddingX;
  let cursorY = headerTop - 40;

  const drawText = (font: 'F1' | 'F2', size: number, color: readonly [number, number, number], x: number, y: number, text: string) => {
    commands.push('BT');
    commands.push(`/${font} ${size} Tf`);
    commands.push(`${toPdfColor(color)} rg`);
    commands.push(`1 0 0 1 ${x} ${y} Tm`);
    commands.push(`(${encodeText(text)}) Tj`);
    commands.push('ET');
  };

  let headerTextX = headerPaddingX;
  let logoBottomY = headerBottom + 24;

  if (assets.logo) {
    const { image, name } = assets.logo;
    const maxWidth = 104;
    const maxHeight = headerHeight - 44;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const positionX = headerPaddingX;
    const positionY = headerBottom + (headerHeight - drawHeight) / 2;

    commands.push('q');
    commands.push(`${drawWidth} 0 0 ${drawHeight} ${positionX} ${positionY} cm`);
    commands.push(`/${name} Do`);
    commands.push('Q');

    headerTextX = positionX + drawWidth + 16;
    logoBottomY = positionY;
  }

  const headingTitle = options.title;
  drawText('F2', 20, COLORS.title, headerTextX, cursorY, headingTitle);
  cursorY -= 26;

  const headingMeta: string[] = [];
  if (!assets.logo) {
    headingMeta.push(options.professionalName);
  }

  for (const meta of headingMeta) {
    drawText('F1', 11, COLORS.muted, headerTextX, cursorY, meta);
    cursorY -= 16;
  }

  const separatorY = Math.max(Math.min(cursorY, logoBottomY) - 10, headerBottom + 18);

  commands.push('q');
  commands.push(`${toPdfColor(COLORS.accent)} RG`);
  commands.push('1.5 w');
  commands.push(`${headerPaddingX} ${separatorY} m`);
  commands.push(`${PAGE_WIDTH - headerPaddingX} ${separatorY} l`);
  commands.push('S');
  commands.push('Q');

  let contentCursorY = separatorY - 26;

  drawText('F2', 16, COLORS.subtitle, headerPaddingX, contentCursorY, 'Datos del paciente');
  contentCursorY -= 22;

  const patientRows = [
    ['Nombre', options.patientName],
    ['DNI', options.patientDni],
    ['Obra Social', options.healthInsurance],
    ['N.º Afiliado', options.affiliateNumber],
  ] as const;

  const panelX = MARGIN + bodyPaddingX;
  const panelWidth = CONTENT_WIDTH - bodyPaddingX * 2;
  const patientCardPadding = 20;
  const patientRowHeight = 32;
  const patientColumns = 2;
  const rowsPerColumn = Math.ceil(patientRows.length / patientColumns);
  const patientCardHeight = patientCardPadding * 2 + rowsPerColumn * patientRowHeight;
  const patientCardTop = contentCursorY;
  const patientCardBottom = patientCardTop - patientCardHeight;

  commands.push('q');
  commands.push(`${toPdfColor(COLORS.panel)} rg`);
  commands.push(`${toPdfColor(COLORS.border)} RG`);
  commands.push('1 w');
  commands.push(`${panelX} ${patientCardBottom} ${panelWidth} ${patientCardHeight} re`);
  commands.push('B');
  commands.push('Q');

  const columnGap = 28;
  const columnWidth = (panelWidth - columnGap) / patientColumns;

  for (let index = 0; index < patientRows.length; index += 1) {
    const [label, value] = patientRows[index];
    const column = index % patientColumns;
    const row = Math.floor(index / patientColumns);
    const baseX = panelX + patientCardPadding + column * (columnWidth + columnGap);
    const labelY = patientCardTop - patientCardPadding - row * patientRowHeight - 6;
    const valueY = labelY - 15;

    drawText('F2', 10, COLORS.muted, baseX, labelY, label.toUpperCase());
    drawText('F1', 12.5, COLORS.value, baseX, valueY, value);
  }

  contentCursorY = patientCardBottom - 26;

  const sections: Array<{ title: string; value: string; prefix?: string }> = [
    { title: 'Diagnóstico', value: options.diagnosis || 'Sin diagnóstico registrado' },
    { title: 'Prescripción', value: options.medication, prefix: 'Rp/.' },
    { title: 'Indicaciones para el paciente', value: options.instructions },
    { title: 'Notas adicionales', value: options.notes || 'Sin observaciones' },
  ];

  const paragraphWidth = panelWidth - patientCardPadding * 2;
  const lineHeight = 17;

  for (const section of sections) {
    const lines = wrapText(section.value, 13, paragraphWidth, fontWidth);
    const hasContent = lines.length > 0 && !(lines.length === 1 && lines[0] === '');
    const effectiveLines = hasContent ? lines : ['—'];
    const sectionPaddingY = 26;
    const titleHeight = 18;
    const prefixHeight = section.prefix ? lineHeight : 0;
    const contentHeight = effectiveLines.length * lineHeight;
    const sectionHeight = sectionPaddingY * 2 + titleHeight + prefixHeight + contentHeight;
    const sectionTop = contentCursorY;
    const sectionBottom = sectionTop - sectionHeight;

    commands.push('q');
    commands.push(`${toPdfColor(COLORS.panel)} rg`);
    commands.push(`${toPdfColor(COLORS.border)} RG`);
    commands.push('1 w');
    commands.push(`${panelX} ${sectionBottom} ${panelWidth} ${sectionHeight} re`);
    commands.push('B');
    commands.push('Q');

    commands.push('q');
    commands.push(`${toPdfColor(COLORS.accent)} rg`);
    commands.push(`${panelX} ${sectionTop - 6} ${panelWidth} 1 re`);
    commands.push('f');
    commands.push('Q');

    let textCursorY = sectionTop - sectionPaddingY;
    drawText('F2', 14, COLORS.subtitle, panelX + patientCardPadding, textCursorY, section.title);
    textCursorY -= 22;

    if (section.prefix) {
      drawText('F2', 12, COLORS.accent, panelX + patientCardPadding, textCursorY, section.prefix);
      textCursorY -= lineHeight;
    }

    for (const line of effectiveLines) {
      if (line === '') {
        textCursorY -= lineHeight;
        continue;
      }
      drawText('F1', 12.5, COLORS.value, panelX + patientCardPadding, textCursorY, line);
      textCursorY -= lineHeight;
    }

    contentCursorY = sectionBottom - 20;
  }

  const desiredSignatureLineY = MARGIN + 74;
  const minimumFooterSpacing = 140;
  let signatureLineY = desiredSignatureLineY;
  if (contentCursorY - signatureLineY < minimumFooterSpacing) {
    signatureLineY = Math.max(MARGIN + 60, contentCursorY - minimumFooterSpacing);
  }

  const footerLabelOffset = 44;
  const footerDateLabelY = signatureLineY + footerLabelOffset;
  drawText('F2', 11, COLORS.subtitle, panelX, footerDateLabelY, 'Fecha de emisión');
  drawText('F1', 13, COLORS.value, panelX, footerDateLabelY - 20, formatDate(options.issuedAt));

  const signatureStartX = PAGE_WIDTH - MARGIN - 240;
  const signatureEndX = PAGE_WIDTH - MARGIN - 20;

  drawText('F2', 11, COLORS.subtitle, signatureStartX, footerDateLabelY, 'Firma y sello del profesional');

  commands.push('q');
  commands.push(`${toPdfColor(COLORS.border)} RG`);
  commands.push('1 w');
  commands.push(`${signatureStartX} ${signatureLineY} m`);
  commands.push(`${signatureEndX} ${signatureLineY} l`);
  commands.push('S');
  commands.push('Q');

  if (assets.signature) {
    const { image, name } = assets.signature;
    const maxWidth = 170;
    const maxHeight = 70;
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

  drawText('F2', 11, COLORS.label, signatureStartX, signatureLineY - 24, options.professionalName);

  const professionalDetails: string[] = [];
  if (options.professionalLicense) {
    professionalDetails.push(`Matrícula ${options.professionalLicense}`);
  }
  if (options.professionalLocality) {
    professionalDetails.push(options.professionalLocality);
  } else if (options.professionalDni) {
    professionalDetails.push(`DNI ${options.professionalDni}`);
  }

  const professionalLabel = professionalDetails.length > 0 ? professionalDetails.join(' · ') : 'Firma digital';

  drawText('F1', 10.5, COLORS.muted, signatureStartX, signatureLineY - 38, professionalLabel);

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

  const computedTitle = options.logo
    ? 'Receta digital'
    : options.title?.trim() || options.professionalName || 'Receta digital';

  const pdfOptions: PdfContentOptions = {
    title: computedTitle,
    patientName: options.patientName,
    patientDni: options.patientDni ?? 'No informado',
    healthInsurance: insuranceLabel,
    affiliateNumber: affiliateLabel,
    professionalName: options.professionalName,
    professionalDni: options.professionalDni,
    professionalLicense: options.professionalLicense,
    professionalLocality: options.professionalLocality,
    diagnosis: options.diagnosis?.trim() || 'No especificado',
    medication: options.medication.trim() || 'Sin prescripción indicada',
    instructions: options.instructions.trim() || 'Sin indicaciones específicas',
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
