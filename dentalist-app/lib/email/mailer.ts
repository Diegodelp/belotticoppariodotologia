import nodemailer, { Transporter } from 'nodemailer';

interface MailerConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
  fromName?: string;
  secure?: boolean;
}

let cachedTransporter: Transporter | null = null;

function getMailerConfig(): MailerConfig {
  const host = process.env.SMTP_HOST;
  const portValue = process.env.SMTP_PORT ?? '587';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const fromName = process.env.SMTP_FROM_NAME;
  const secureValue = process.env.SMTP_SECURE;

  const port = Number.parseInt(portValue, 10);

  if (!host || Number.isNaN(port) || !from) {
    throw new Error(
      'Faltan variables SMTP obligatorias (SMTP_HOST, SMTP_PORT, SMTP_FROM).',
    );
  }

  const secure = secureValue
    ? secureValue.toLowerCase() === 'true'
    : port === 465;

  return {
    host,
    port,
    user,
    pass,
    from,
    fromName,
    secure,
  };
}

function getTransporter(): Transporter {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const { host, port, user, pass, secure } = getMailerConfig();

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  return cachedTransporter;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail({ to, subject, text, html }: SendMailOptions) {
  const transporter = getTransporter();
  const { from, fromName } = getMailerConfig();

  const formattedFrom = fromName ? `${fromName} <${from}>` : from;

  await transporter.sendMail({
    to,
    from: formattedFrom,
    subject,
    text,
    html,
  });
}

export async function sendTwoFactorCodeEmail({
  to,
  code,
  expiresMinutes,
  locale = 'es',
}: {
  to: string;
  code: string;
  expiresMinutes: number;
  locale?: 'es' | 'en';
}) {
  const subject =
    locale === 'en'
      ? 'Your Dentalist verification code'
      : 'Tu código de verificación Dentalist';

  const expirationText =
    locale === 'en'
      ? `This code will expire in ${expiresMinutes} minutes.`
      : `Este código vence en ${expiresMinutes} minutos.`;

  const textBody =
    locale === 'en'
      ? `Use the following verification code to continue: ${code}\n\n${expirationText}`
      : `Usá el siguiente código para continuar: ${code}\n\n${expirationText}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #1d4ed8;">${
        locale === 'en' ? 'Verification code' : 'Código de verificación'
      }</h2>
      <p style="font-size: 16px;">
        ${
          locale === 'en'
            ? 'Use the following code to continue with your login:'
            : 'Usá el siguiente código para continuar con tu inicio de sesión:'
        }
      </p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p style="font-size: 14px; color: #6b7280;">${expirationText}</p>
    </div>
  `;

  await sendMail({
    to,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

export async function sendPrescriptionIssuedEmail({
  to,
  patientName,
  professionalName,
  prescriptionTitle,
  documentUrl,
  clinicName,
}: {
  to: string;
  patientName: string;
  professionalName: string;
  prescriptionTitle: string;
  documentUrl: string;
  clinicName?: string;
}) {
  const trimmedPatient = patientName.trim();
  const trimmedProfessional = professionalName.trim();
  const safePatient = trimmedPatient.length > 0 ? trimmedPatient : 'Paciente';
  const safeProfessional = trimmedProfessional.length > 0 ? trimmedProfessional : 'su profesional tratante';
  const heading = clinicName?.trim().length
    ? `Receta emitida por ${clinicName.trim()}`
    : 'Receta digital disponible';
  const subject = heading;

  const textBody = `Hola ${safePatient},\n\n` +
    `${safeProfessional} emitió una nueva receta "${prescriptionTitle}".` +
    '\nPodés descargarla en el siguiente enlace temporal:\n' +
    `${documentUrl}\n\n` +
    'Recordá guardar el archivo si necesitás consultarlo más adelante.\n\n' +
    'Saludos.';

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #0ea5e9;">${heading}</h2>
      <p>Hola ${safePatient},</p>
      <p>
        ${safeProfessional} emitió una nueva receta
        <strong>${prescriptionTitle}</strong>.
      </p>
      <p>
        Podés descargarla usando el siguiente enlace temporal:
        <br />
        <a href="${documentUrl}" style="color: #0ea5e9;">Descargar receta</a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        Recordá guardar el archivo si necesitás consultarlo más adelante.
      </p>
      <p>Saludos.</p>
    </div>
  `;

  await sendMail({
    to,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

export async function sendBudgetIssuedEmail({
  to,
  patientName,
  professionalName,
  budgetTitle,
  totalAmount,
  documentUrl,
  clinicName,
}: {
  to: string;
  patientName: string;
  professionalName: string;
  budgetTitle: string;
  totalAmount: number;
  documentUrl: string;
  clinicName?: string;
}) {
  const trimmedPatient = patientName.trim();
  const trimmedProfessional = professionalName.trim();
  const safePatient = trimmedPatient.length > 0 ? trimmedPatient : 'Paciente';
  const safeProfessional = trimmedProfessional.length > 0 ? trimmedProfessional : 'su profesional tratante';
  const heading = clinicName?.trim().length
    ? `Presupuesto emitido por ${clinicName.trim()}`
    : 'Nuevo presupuesto disponible';
  const subject = heading;

  const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });
  const totalText = currencyFormatter.format(totalAmount);

  const textBody = `Hola ${safePatient},\n\n` +
    `${safeProfessional} compartió un presupuesto "${budgetTitle}".` +
    `\nMonto estimado: ${totalText}.` +
    '\nPodés descargarlo desde el siguiente enlace temporal:\n' +
    `${documentUrl}\n\n` +
    'Guardá el archivo si necesitás consultarlo más adelante.\n\n' +
    'Saludos.';

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #0ea5e9;">${heading}</h2>
      <p>Hola ${safePatient},</p>
      <p>
        ${safeProfessional} preparó un nuevo presupuesto
        <strong>${budgetTitle}</strong>.
      </p>
      <p style="margin: 12px 0; font-size: 14px; color: #0f172a;">
        Monto estimado: <strong>${totalText}</strong>
      </p>
      <p>
        Descargalo utilizando el siguiente enlace temporal:
        <br />
        <a href="${documentUrl}" style="color: #0ea5e9;">Descargar presupuesto</a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        Guardá el archivo si necesitás consultarlo más adelante.
      </p>
      <p>Saludos.</p>
    </div>
  `;

  await sendMail({
    to,
    subject,
    text: textBody,
    html: htmlBody,
  });
}
