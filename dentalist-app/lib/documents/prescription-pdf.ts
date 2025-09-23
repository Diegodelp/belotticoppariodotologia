import sharp from 'sharp';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMultiline(value: string): string {
  return escapeXml(value).replace(/\r?\n/g, '&#10;');
}

function formatDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return formatter.format(date);
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
  const diagnosisText = options.diagnosis?.trim() ?? 'No especificado';
  const notesText = options.notes?.trim() ?? '';
  const insuranceLabel = options.healthInsurance
    ? `${options.healthInsurance}${options.affiliateNumber ? ` · N.º ${options.affiliateNumber}` : ''}`
    : 'Particular';

  const signatureTag = options.signatureDataUrl
    ? `<image href="${options.signatureDataUrl}" x="360" y="620" width="190" height="90" preserveAspectRatio="xMidYMid meet" />`
    : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="595" height="842" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font: 700 26px 'Helvetica', 'Arial', sans-serif; fill: #0f172a; }
    .subtitle { font: 600 18px 'Helvetica', 'Arial', sans-serif; fill: #1e293b; }
    .label { font: 600 14px 'Helvetica', 'Arial', sans-serif; fill: #1f2937; }
    .value { font: 400 14px 'Helvetica', 'Arial', sans-serif; fill: #111827; }
    .body { font: 400 14px 'Helvetica', 'Arial', sans-serif; fill: #111827; }
    .muted { font: 400 12px 'Helvetica', 'Arial', sans-serif; fill: #6b7280; }
  </style>
  <rect width="595" height="842" fill="#ffffff" />
  <rect x="40" y="40" width="515" height="762" rx="16" ry="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />

  <text x="60" y="100" class="title">${escapeXml(options.title)}</text>
  <text x="60" y="130" class="muted">Emitido el ${formatDate(issuedAt)}</text>

  <text x="60" y="180" class="subtitle">Datos del paciente</text>
  <text x="60" y="206" class="label">Nombre</text>
  <text x="180" y="206" class="value">${escapeXml(options.patientName)}</text>
  <text x="60" y="230" class="label">DNI</text>
  <text x="180" y="230" class="value">${escapeXml(options.patientDni ?? 'No informado')}</text>
  <text x="60" y="254" class="label">Cobertura</text>
  <text x="180" y="254" class="value">${escapeXml(insuranceLabel)}</text>

  <text x="60" y="300" class="subtitle">Diagnóstico</text>
  <text x="60" y="326" class="body" xml:space="preserve">${formatMultiline(diagnosisText)}</text>

  <text x="60" y="380" class="subtitle">Medicaciones / Tratamiento indicado</text>
  <text x="60" y="406" class="body" xml:space="preserve">${formatMultiline(options.medication)}</text>

  <text x="60" y="470" class="subtitle">Indicaciones</text>
  <text x="60" y="496" class="body" xml:space="preserve">${formatMultiline(options.instructions)}</text>

  <text x="60" y="570" class="subtitle">Notas adicionales</text>
  <text x="60" y="596" class="body" xml:space="preserve">${formatMultiline(notesText || 'Sin observaciones')}</text>

  <line x1="340" y1="640" x2="540" y2="640" stroke="#cbd5f5" stroke-width="2" stroke-dasharray="6 4" />
  ${signatureTag}
  <text x="350" y="720" class="label">${escapeXml(options.professionalName)}</text>
  <text x="350" y="740" class="muted">${escapeXml(
    options.professionalDni ? `Matrícula / DNI: ${options.professionalDni}` : 'Firma digital',
  )}</text>
</svg>`;

  const pdfBuffer = await sharp(Buffer.from(svg)).toFormat('pdf').toBuffer();
  return pdfBuffer;
}
