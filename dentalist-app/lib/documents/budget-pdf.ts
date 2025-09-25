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
    default:
      return practice;
  }
}

function buildContentStream(options: BudgetPdfOptions): Buffer {
  const commands: string[] = [];

  commands.push('q');
  commands.push(`${toPdfColor(COLORS.background)} rg`);
  commands.push(`${toPdfColor(COLORS.border)} RG`);
  commands.push('1 w');
  commands.push(`${MARGIN} ${MARGIN} ${CONTENT_WIDTH} ${PAGE_HEIGHT - MARGIN * 2} re`);
  commands.push('B');
  commands.push('Q');

  let cursorY = PAGE_HEIGHT - MARGIN - 40;

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

  const heading = options.professional.clinicName?.trim() || options.title;
  drawText('F2', 26, COLORS.title, MARGIN + 20, cursorY, heading);
  cursorY -= 32;

  drawText('F2', 18, COLORS.subtitle, MARGIN + 20, cursorY, 'Datos del profesional');
  cursorY -= 24;

  const professionalRows = [
    ['Nombre', options.professional.name || ''],
    options.professional.licenseNumber ? ['Matrícula', options.professional.licenseNumber] : null,
    options.professional.phone ? ['Teléfono', options.professional.phone] : null,
    options.professional.email ? ['Email', options.professional.email] : null,
  ].filter((row): row is [string, string] => Array.isArray(row));

  for (const [label, value] of professionalRows) {
    drawText('F2', 12, COLORS.label, MARGIN + 20, cursorY, label);
    drawText('F1', 13, COLORS.value, MARGIN + 140, cursorY, value);
    cursorY -= 18;
  }

  cursorY -= 6;
  drawText('F2', 18, COLORS.subtitle, MARGIN + 20, cursorY, 'Datos del paciente');
  cursorY -= 24;

  const patientRows = [
    ['Nombre', options.patient.name],
    ['DNI', options.patient.dni || 'No informado'],
    ['Obra Social', options.patient.healthInsurance || 'Particular'],
    ['N.º Afiliado', options.patient.affiliateNumber ?? 'No informado'],
  ];

  for (const [label, value] of patientRows) {
    drawText('F2', 12, COLORS.label, MARGIN + 20, cursorY, label);
    drawText('F1', 13, COLORS.value, MARGIN + 140, cursorY, value);
    cursorY -= 18;
  }

  cursorY -= 10;
  drawText('F2', 18, COLORS.subtitle, MARGIN + 20, cursorY, 'Detalle de prácticas');
  cursorY -= 22;

  const practiceColumnX = MARGIN + 20;
  const descriptionColumnX = MARGIN + 150;
  const amountColumnX = MARGIN + CONTENT_WIDTH - 120;
  const descriptionWidth = amountColumnX - descriptionColumnX - 10;

  drawText('F2', 12, COLORS.label, practiceColumnX, cursorY, 'Práctica');
  drawText('F2', 12, COLORS.label, descriptionColumnX, cursorY, 'Descripción');
  drawText('F2', 12, COLORS.label, amountColumnX, cursorY, 'Importe');
  cursorY -= 16;

  const total = options.items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  for (const item of options.items) {
    const description = item.description?.trim() || '-';
    const descriptionLines = wrapText(description, 12, descriptionWidth, fontWidth);
    const practiceName = practiceLabel(item.practice);

    drawText('F1', 12, COLORS.value, practiceColumnX, cursorY, practiceName);
    drawText('F1', 12, COLORS.value, amountColumnX, cursorY, formatCurrency(item.amount));

    for (let index = 0; index < descriptionLines.length; index += 1) {
      const line = descriptionLines[index];
      drawText('F1', 12, COLORS.value, descriptionColumnX, cursorY, line);
      if (index < descriptionLines.length - 1) {
        cursorY -= 14;
      }
    }

    cursorY -= 18;
  }

  cursorY -= 6;
  drawText('F2', 14, COLORS.subtitle, amountColumnX, cursorY, `Total: ${formatCurrency(total)}`);
  cursorY -= 24;

  if (options.notes && options.notes.trim().length > 0) {
    drawText('F2', 16, COLORS.subtitle, MARGIN + 20, cursorY, 'Notas');
    cursorY -= 18;

    const notesLines = wrapText(options.notes.trim(), 12, CONTENT_WIDTH - 40, fontWidth);
    for (const line of notesLines) {
      drawText('F1', 12, COLORS.value, MARGIN + 20, cursorY, line);
      cursorY -= 14;
    }
    cursorY -= 8;
  }

  drawText('F2', 12, COLORS.label, MARGIN + 20, cursorY, `Fecha: ${formatDate(options.issuedAt)}`);

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
