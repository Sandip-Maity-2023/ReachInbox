import nodemailer, { Transporter } from 'nodemailer';

// In-memory cache for transporter instances per sender
const transporterMap = new Map<string, Transporter>();
let defaultTestAccount: any = null;

export async function getTransporterForSender(senderEmail: string): Promise<Transporter> {
  if (transporterMap.has(senderEmail)) {
    return transporterMap.get(senderEmail)!;
  }

  // Generate or reuse Ethereal test credentials
  if (!defaultTestAccount) {
    console.log('🔄 Creating Ethereal Email test account for SMTP sending...');
    defaultTestAccount = await nodemailer.createTestAccount();
    console.log(`✅ Ethereal test account initialized: ${defaultTestAccount.user}`);
  }

  const transporter = nodemailer.createTransport({
    host: defaultTestAccount.smtp.host,
    port: defaultTestAccount.smtp.port,
    secure: defaultTestAccount.smtp.secure,
    auth: {
      user: defaultTestAccount.user,
      pass: defaultTestAccount.pass,
    },
  });

  transporterMap.set(senderEmail, transporter);
  return transporter;
}

export interface SendEmailParams {
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | null;
}

export async function sendEmail({
  senderEmail,
  recipientEmail,
  subject,
  body,
}: SendEmailParams): Promise<SendEmailResult> {
  const transporter = await getTransporterForSender(senderEmail);

  const info = await transporter.sendMail({
    from: `"${senderEmail.split('@')[0]}" <${senderEmail}>`,
    to: recipientEmail,
    subject,
    html: body.replace(/\n/g, '<br/>'),
    text: body,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;

  return {
    messageId: info.messageId,
    previewUrl: previewUrl ? String(previewUrl) : null,
  };
}

