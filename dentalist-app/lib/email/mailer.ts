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
