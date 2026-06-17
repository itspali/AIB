import "server-only";

import { Resend } from "resend";

export type TransactionalEmailAttachment = {
  filename: string;
  content: Buffer;
};

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: TransactionalEmailAttachment[];
};

export type SendTransactionalEmailResult =
  | { success: true; id: string }
  | { success: false; error: string; notConfigured?: boolean };

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export function isTransactionalEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<SendTransactionalEmailResult> {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    return {
      success: false,
      error: "Email is not configured. Set RESEND_FROM_EMAIL or mark the quote as sent manually.",
      notConfigured: true,
    };
  }

  const resend = getResendClient();
  if (!resend) {
    return {
      success: false,
      error: "Email is not configured. Set RESEND_API_KEY or mark the quote as sent manually.",
      notConfigured: true,
    };
  }

  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
    })),
  });

  if (error) {
    return { success: false, error: error.message ?? "Unable to send email." };
  }

  return { success: true, id: data?.id ?? "sent" };
}
