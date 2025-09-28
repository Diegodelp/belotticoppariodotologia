import type { PngImage } from './png';
import { BudgetPractice } from '@/types';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  title: [15, 23, 42] as const,
  subtitle: [30, 41, 59] as const,
  label: [51, 65, 85] as const,
  value: [17, 24, 39] as const,
  muted: [100, 116, 139] as const,
  border: [226, 232, 240] as const,
  background: [248, 250, 252] as const,
  headerBackground: [224, 242, 254] as const,
  panel: [255, 255, 255] as const,
  divider: [203, 213, 225] as const,
  accent: [14, 116, 144] as const,
};

interface BudgetPdfProfessional {
  name: string;
  clinicName?: string;
  licenseNumber?: string;
  phone?: string;
  email?: string;
}

interface BudgetPdfPatient {
  name: string;
  dni: string;
  healthInsurance: string;
  affiliateNumber?: string;
}

interface BudgetPdfItem {
  practice: BudgetPractice;
  description?: string;
  amount: number;
}

interface BudgetPdfOptions {
  title: string;
  notes?: string;
  issuedAt: Date;
  professional: BudgetPdfProfessional;
  patient: BudgetPdfPatient;
  items: BudgetPdfItem[];
  logo?: PngImage;
}

function formatDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return formatter.format(date);
}

function formatCurrency(value: number): string {
  const formatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });
  return formatter.format(value);
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
  return text.length * (size * 0.5);
}

function practiceLabel(practice: BudgetPractice): string {
  switch (practice) {
    case 'operatoria':
      return 'Operatoria';
    case 'exodoncia':
      return 'Exodoncia';
    case 'limpieza':
      return 'Limpieza';
    case 'blanqueamiento':
      return 'Blanqueamiento';
    case 'implante':
      return 'Implante';
    case 'corona':
      return 'Corona';
    case 'carilla':
      return 'Carilla';
    case 'perno':
      return 'Perno';
    case 'endodoncia':
      return 'Endodoncia';
    case 'urgencia':
      return 'Urgencia';
    case 'regeneracionTisular':
      return 'Regeneración tisular';
    case 'otro':
      return 'Otro';
    default:
      return practice;
  }
}

function buildContentStream(options: BudgetPdfOptions, logo?: { image: PngImage; name: string }): Buffer {
  const commands: string[] = [];

  const bodyPaddingX = 28;
  const headerHeight = 96;
  const headerTop = PAGE_HEIGHT - MARGIN;
  const headerBottom = headerTop - headerHeight;
  const headerPaddingX = MARGIN + bodyPaddingX;
  const panelX = MARGIN + bodyPaddingX;
  const panelWidth = CONTENT_WIDTH - bodyPaddingX * 2;

  // Fondo exterior
  commands.push('q');
  commands.push(`${toPdfColor(COLORS.background)} rg`);
  commands.push(`${toPdfColor(COLORS.border)} RG`);
  commands.push('1 w');
  commands.push(`${MARGIN} ${MARGIN} ${CONTENT_WIDTH} ${PAGE_HEIGHT - MARGIN * 2} re`);
  commands.push('B');
  commands.push('Q');

  // Encabezado
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

  let cursorY = headerTop - 32;

  const drawText = (
    font: 'F1' | 'F2',
    size: number,
    color: readonly [number, number, number],
    x: number,
    y: number,
    text: string,
  ) => {
    commands.push('BT');
    commands.push(`/${font} ${size} Tf`);
    commands.push(`${toPdfColor(color)} rg`);
    commands.push(`1 0 0 1 ${x} ${y} Tm`);
    commands.push(`(${encodeText(text)}) Tj`);
    commands.push('ET');
  };

  let headingX = headerPaddingX;
  let logoBottomY = headerBottom + 24;

  if (logo) {
    const { image, name } = logo;
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

    headingX = positionX + drawWidth + 16;
    logoBottomY = positionY;
  }

  const clinicName = options.professional.clinicName?.trim() ?? '';
  const title = options.title?.trim() ?? '';
  const professionalName = options.professional.name?.trim() ?? '';
  const primaryHeading = clinicName || title || 'Presupuesto';
  const secondaryHeading = title && title.toLowerCase() !== primaryHeading.toLowerCase() ? title : '';

  if (primaryHeading) {
    drawText('F2', 20, COLORS.title, headingX, cursorY, primaryHeading);
    cursorY -= 26;
  }

  if (secondaryHeading) {
    drawText('F1', 13, COLORS.value, headingX, cursorY, secondaryHeading);
    cursorY -= 20;
  }

  const headingMeta: string[] = [];
  if (professionalName) {
    headingMeta.push(professionalName);
  }
  if (options.professional.licenseNumber?.trim()) {
    headingMeta.push(`Matrícula ${options.professional.licenseNumber.trim()}`);
  }
  if (options.professional.phone?.trim()) {
    headingMeta.push(`Tel. ${options.professional.phone.trim()}`);
  }
  if (options.professional.email?.trim()) {
    headingMeta.push(options.professional.email.trim());
  }

  for (const meta of headingMeta) {
    drawText('F1', 11, COLORS.muted, headingX, cursorY, meta);
    cursorY -= 15;
  }

  const separatorY = Math.max(Math.min(cursorY, logoBottomY) - 10, headerBottom + 18);

  commands.push('q');
  commands.push(`${toPdfColor(COLORS.accent)} RG`);
  commands.push('1.5 w');
  commands.push(`${headerPaddingX} ${separatorY} m`);
  commands.push(`${PAGE_WIDTH - headerPaddingX} ${separatorY} l`);
  commands.push('S');
  commands.push('Q');

  const sectionTitleFontSize = 13;
  const sectionSpacing = 24;
  const titleToCardGap = 2;
  const headerContentSpacing = 36;
  let contentCursorY = separatorY - headerContentSpacing;

  const patientTitleY = contentCursorY - titleToCardGap;
  drawText('F2', sectionTitleFontSize, COLORS.subtitle, panelX, patientTitleY, 'Datos del paciente');

  const patientRows = [
    ['Nombre', options.patient.name],
    ['DNI', options.patient.dni],
    ['Obra Social', options.patient.healthInsurance || 'Sin obra social'],
    ['N.º Afiliado', options.patient.affiliateNumber || '—'],
  ] as const;

  const patientCardPadding = 20;
  const patientRowHeight = 32;
  const patientColumns = 2;
  const rowsPerColumn = Math.ceil(patientRows.length / patientColumns);
  const patientCardHeight = patientCardPadding * 2 + rowsPerColumn * patientRowHeight;
  const patientCardTop = patientTitleY - titleToCardGap;
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

  contentCursorY = patientCardBottom - sectionSpacing;

  const itemsTitleY = contentCursorY - titleToCardGap;
  drawText('F2', sectionTitleFontSize, COLORS.subtitle, panelX, itemsTitleY, 'Detalle del presupuesto');

  const itemsCardTop = itemsTitleY - titleToCardGap;
  const itemsPaddingX = 22;
  const itemsPaddingY = 22;
  const amountColumnWidth = 110;
  const detailColumnWidth = panelWidth - itemsPaddingX * 2 - amountColumnWidth;
  const headerLineHeight = 12;
  const headerSpacing = 18;
  const practiceLineHeight = 16;
  const descriptionLineHeight = 12.5;
  const postDescriptionWithContent = 6;
  const postDescriptionEmpty = 10;
  const interItemSpacing = 8;

  const hasItems = options.items.length > 0;
  const itemLayouts = hasItems
    ? options.items.map((item) => {
        const practiceName = practiceLabel(item.practice);
        const description = item.description?.trim() ?? '';
        const descriptionLines = description
          ? wrapText(description, 10.5, detailColumnWidth, fontWidth)
          : [];
        const amountText = formatCurrency(item.amount);
        const blockHeight =
          practiceLineHeight +
          (descriptionLines.length > 0
            ? descriptionLines.length * descriptionLineHeight + postDescriptionWithContent
            : postDescriptionEmpty);
        return { practiceName, descriptionLines, amountText, blockHeight };
      })
    : [];

  const itemsContentHeight = hasItems
    ? itemLayouts.reduce(
        (sum, layout, index) =>
          sum +
          layout.blockHeight +
          (index < itemLayouts.length - 1 ? interItemSpacing : 0),
        0,
      )
    : 18;

  const itemsCardHeight = itemsPaddingY * 2 + headerLineHeight + headerSpacing + itemsContentHeight;
  const itemsCardBottom = itemsCardTop - itemsCardHeight;

  commands.push('q');
  commands.push(`${toPdfColor(COLORS.panel)} rg`);
  commands.push(`${toPdfColor(COLORS.border)} RG`);
  commands.push('1 w');
  commands.push(`${panelX} ${itemsCardBottom} ${panelWidth} ${itemsCardHeight} re`);
  commands.push('B');
  commands.push('Q');

  const amountHeaderText = 'MONTO';
  const amountHeaderWidth = fontWidth(amountHeaderText, 10);
  const amountHeaderX = panelX + panelWidth - itemsPaddingX - amountHeaderWidth;
  const headerLabelY = itemsCardTop - itemsPaddingY - 4;

  drawText('F2', 10, COLORS.muted, panelX + itemsPaddingX, headerLabelY, 'PRÁCTICA');
  drawText('F2', 10, COLORS.muted, amountHeaderX, headerLabelY, amountHeaderText);

  let itemCursorY = headerLabelY - headerSpacing;

  if (hasItems) {
    itemLayouts.forEach((layout, index) => {
      const amountWidth = fontWidth(layout.amountText, 12.5);
      const amountX = panelX + panelWidth - itemsPaddingX - amountWidth;

      drawText('F2', 12.5, COLORS.value, panelX + itemsPaddingX, itemCursorY, layout.practiceName);
      drawText('F2', 12.5, COLORS.value, amountX, itemCursorY, layout.amountText);

      itemCursorY -= practiceLineHeight;

      if (layout.descriptionLines.length > 0) {
        for (const line of layout.descriptionLines) {
          drawText('F1', 10.5, COLORS.muted, panelX + itemsPaddingX, itemCursorY, line);
          itemCursorY -= descriptionLineHeight;
        }
        itemCursorY -= postDescriptionWithContent;
      } else {
        itemCursorY -= postDescriptionEmpty;
      }

      if (index < itemLayouts.length - 1) {
        const dividerY = itemCursorY + 4;
        commands.push('q');
        commands.push(`${toPdfColor(COLORS.divider)} RG`);
        commands.push('0.75 w');
        commands.push(`${panelX + itemsPaddingX} ${dividerY} m`);
        commands.push(`${panelX + panelWidth - itemsPaddingX} ${dividerY} l`);
        commands.push('S');
        commands.push('Q');
        itemCursorY -= interItemSpacing;
      }
    });
  } else {
    drawText(
      'F1',
      11,
      COLORS.muted,
      panelX + itemsPaddingX,
      itemCursorY,
      'Sin prácticas registradas.',
    );
  }

  contentCursorY = itemsCardBottom - sectionSpacing;

  const notesContent = options.notes?.trim() ?? '';
  const notesText = notesContent.length > 0 ? notesContent : 'Sin notas adicionales.';
  const notesTitleY = contentCursorY - titleToCardGap;
  drawText('F2', sectionTitleFontSize, COLORS.subtitle, panelX, notesTitleY, 'Notas del profesional');

  const notesCardTop = notesTitleY - titleToCardGap;
  const notesPadding = 20;
  const paragraphWidth = panelWidth - notesPadding * 2;
  const noteLines = wrapText(notesText, 11, paragraphWidth, fontWidth);
  const noteLineHeight = 14;
  const notesCardHeight = notesPadding * 2 + noteLines.length * noteLineHeight;
  const notesCardBottom = notesCardTop - notesCardHeight;

  commands.push('q');
  commands.push(`${toPdfColor(COLORS.panel)} rg`);
  commands.push(`${toPdfColor(COLORS.border)} RG`);
  commands.push('1 w');
  commands.push(`${panelX} ${notesCardBottom} ${panelWidth} ${notesCardHeight} re`);
  commands.push('B');
  commands.push('Q');

  let noteCursorY = notesCardTop - notesPadding;
  for (const line of noteLines) {
    drawText('F1', 11, COLORS.value, panelX + notesPadding, noteCursorY, line);
    noteCursorY -= noteLineHeight;
  }

  contentCursorY = notesCardBottom - sectionSpacing;

  const total = options.items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const summaryTitleY = contentCursorY - titleToCardGap;
  drawText('F2', sectionTitleFontSize, COLORS.subtitle, panelX, summaryTitleY, 'Resumen');

  const summaryCardTop = summaryTitleY - titleToCardGap;
  const summaryPadding = 20;
  const summaryCardHeight = summaryPadding * 2 + 48;
  const summaryCardBottom = summaryCardTop - summaryCardHeight;

  commands.push('q');
  commands.push(`${toPdfColor(COLORS.panel)} rg`);
  commands.push(`${toPdfColor(COLORS.border)} RG`);
  commands.push('1 w');
  commands.push(`${panelX} ${summaryCardBottom} ${panelWidth} ${summaryCardHeight} re`);
  commands.push('B');
  commands.push('Q');

  const columnSpacing = 32;
  const summaryColumnWidth = (panelWidth - summaryPadding * 2 - columnSpacing) / 2;
  const firstColumnX = panelX + summaryPadding;
  const secondColumnX = firstColumnX + summaryColumnWidth + columnSpacing;
  const summaryLabelY = summaryCardTop - summaryPadding - 6;

  drawText('F2', 10, COLORS.muted, firstColumnX, summaryLabelY, 'TOTAL');
  drawText('F1', 13, COLORS.value, firstColumnX, summaryLabelY - 18, formatCurrency(total));

  drawText('F2', 10, COLORS.muted, secondColumnX, summaryLabelY, 'FECHA DE EMISIÓN');
  drawText('F1', 12, COLORS.value, secondColumnX, summaryLabelY - 18, formatDate(options.issuedAt));

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

export function generateBudgetPdf(options: BudgetPdfOptions): Buffer {
  const logoAsset = options.logo ? { image: options.logo, name: 'ImLogo' } : undefined;
  const contentStream = buildContentStream(options, logoAsset);

  const objects: PdfObject[] = [];
  let idCounter = 1;

  const catalogId = idCounter++;
  const pagesId = idCounter++;
  const pageId = idCounter++;
  const fontRegularId = idCounter++;
  const fontBoldId = idCounter++;
  const logoImageId = logoAsset ? idCounter++ : null;
  const logoMaskId = logoAsset?.image.alpha ? idCounter++ : null;
  const contentId = idCounter++;

  objects.push(createObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`));
  objects.push(createObject(pagesId, `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`));

  const resourceEntries = [`/Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >>`];
  if (logoImageId && logoAsset) {
    resourceEntries.push(`/XObject << /${logoAsset.name} ${logoImageId} 0 R >>`);
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
