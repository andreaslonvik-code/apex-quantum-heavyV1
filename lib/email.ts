import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;

/**
 * Server-side Resend client. `null` when RESEND_API_KEY is not configured —
 * call sites must check before use so previews / local dev don't crash.
 */
export const resend: Resend | null = apiKey ? new Resend(apiKey) : null;

/** From-address: must be a verified domain in Resend. */
export const EMAIL_FROM = process.env.PLUS_EMAIL_FROM ?? 'Apex Quantum <noreply@apex-quantum.com>';

/** Public origin for unsubscribe links + signature image. */
export const PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://apex-quantum.com';
