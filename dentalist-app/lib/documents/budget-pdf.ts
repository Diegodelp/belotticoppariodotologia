import { BudgetPractice } from '@/types';

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

function buildContentStream(options: BudgetPdfOptions): Buffer {
  const commands: string[] = [];

  let cursorY = PAGE_HEIGHT - MARGIN - 32;

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

  const heading = options.title?.trim() || 'Presupuesto';
  drawText('F2', 26, COLORS.title, MARGIN, cursorY, heading);
  cursorY -= 32;

  drawText('F2', 16, COLORS.subtitle, MARGIN, cursorY, 'Profesional');
  cursorY -= 22;

  const professionalLines = [
    options.professional.name ? `Nombre: ${options.professional.name}` : null,
    options.professional.licenseNumber ? `Matrícula: ${options.professional.licenseNumber}` : null,
    options.professional.phone ? `Teléfono: ${options.professional.phone}` : null,
  ].filter((value): value is string => Boolean(value));

  for (const line of professionalLines) {
    drawText('F1', 13, COLORS.value, MARGIN, cursorY, line);
    cursorY -= 18;
  }

  cursorY -= 6;
  drawText('F2', 16, COLORS.subtitle, MARGIN, cursorY, 'Paciente');
  cursorY -= 22;
  drawText('F1', 13, COLORS.value, MARGIN, cursorY, options.patient.name || '');
  cursorY -= 28;

  drawText('F2', 16, COLORS.subtitle, MARGIN, cursorY, 'Detalle del presupuesto');
  cursorY -= 22;

  const amountColumnX = MARGIN + CONTENT_WIDTH - 120;
  const detailWidth = amountColumnX - MARGIN - 20;

  const total = options.items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  for (const item of options.items) {
    const practiceName = practiceLabel(item.practice);
    drawText('F1', 12, COLORS.value, MARGIN, cursorY, `• ${practiceName}`);
    drawText('F1', 12, COLORS.value, amountColumnX, cursorY, formatCurrency(item.amount));
    cursorY -= 16;

    if (item.description && item.description.trim().length > 0) {
      const descriptionLines = wrapText(item.description.trim(), 11, detailWidth, fontWidth);
      for (const line of descriptionLines) {
        drawText('F1', 11, COLORS.muted, MARGIN + 18, cursorY, line);
        cursorY -= 14;
      }
    }

    cursorY -= 6;
  }

  cursorY -= 10;
  drawText('F2', 14, COLORS.subtitle, MARGIN, cursorY, `Total: ${formatCurrency(total)}`);
  cursorY -= 22;
  drawText('F2', 12, COLORS.label, MARGIN, cursorY, `Fecha: ${formatDate(options.issuedAt)}`);

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
  const contentStream = buildContentStream(options);

  const objects: PdfObject[] = [];
  let idCounter = 1;

  const catalogId = idCounter++;
  const pagesId = idCounter++;
  const pageId = idCounter++;
  const fontRegularId = idCounter++;
  const fontBoldId = idCounter++;
  const contentId = idCounter++;

  objects.push(createObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`));
  objects.push(createObject(pagesId, `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`));

  const resourceEntries = [`/Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >>`];

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
