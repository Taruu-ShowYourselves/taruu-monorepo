/**
 * Security notification emails (Issue #71, canonical §6.2a/§6.3/§7.3).
 *
 * Four notices: MFA enabled, MFA disabled, recovery code used, MFA reset by
 * support. Same Resend account and sender as services/email/index.ts; a
 * separate module because these are security evidence, not marketing - and
 * their failure must never fail the security action that triggered them, so
 * every sender here catches, logs, and returns a boolean instead of throwing.
 *
 * Hebrew, RTL, matching the house template look. No secrets, codes, tokens,
 * or IPs ever appear in a message body.
 */

import { Resend } from 'resend';
import { escapeHtml } from '@/lib/escapeHtml';

const FROM_EMAIL = 'noreply@taruu.co.il';
const FROM_NAME = 'תַּרְאוּ';

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  return new Resend(apiKey);
}

function wrapTemplate(title: string, bodyHtml: string): string {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <body style="font-family: Arial, sans-serif; background: #fafafa; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto; padding: 30px 20px; background: #ffffff;">
        <h2 style="color: #171717;">${title}</h2>
        ${bodyHtml}
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
        <p style="color: #737373; font-size: 14px; text-align: center;">
          הקול שלך. הקהילה שלך. העתיד שלנו.
        </p>
      </div>
    </body>
    </html>
  `;
}

async function sendSecurityEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  try {
    await getResend().emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return true;
  } catch (cause) {
    console.error('security email send failed:', params.subject, cause);
    return false;
  }
}

/** Enrollment confirmed - two-factor authentication is now active. */
export async function sendMfaEnabledEmail(params: {
  to: string;
  firstName: string | null;
}): Promise<boolean> {
  const name = escapeHtml(params.firstName || '');
  return sendSecurityEmail({
    to: params.to,
    subject: 'אימות דו-שלבי הופעל בחשבונך',
    html: wrapTemplate(
      'אימות דו-שלבי הופעל',
      `<p style="color: #404040;">שלום ${name},</p>
       <p style="color: #404040;">אימות דו-שלבי (אפליקציית אימות) הופעל בחשבונך.
       שמרו את קודי השחזור במקום בטוח - הם הדרך היחידה להתחבר אם תאבדו גישה לאפליקציה.</p>
       <p style="color: #404040;">אם לא אתם ביצעתם את הפעולה, היכנסו מיד להגדרות האבטחה וצרו קשר עם התמיכה.</p>`
    ),
    text: `שלום ${params.firstName || ''}, אימות דו-שלבי הופעל בחשבונך. אם לא אתם ביצעתם את הפעולה - צרו קשר עם התמיכה מיד.`,
  });
}

/** User-initiated disable (canonical §6.3 step 6). */
export async function sendMfaDisabledEmail(params: {
  to: string;
  firstName: string | null;
}): Promise<boolean> {
  const name = escapeHtml(params.firstName || '');
  return sendSecurityEmail({
    to: params.to,
    subject: 'אימות דו-שלבי הושבת בחשבונך',
    html: wrapTemplate(
      'אימות דו-שלבי הושבת',
      `<p style="color: #404040;">שלום ${name},</p>
       <p style="color: #404040;">אימות דו-שלבי הושבת בחשבונך, וכל ההתחברויות הפעילות נותקו.</p>
       <p style="color: #404040;">אם לא אתם ביצעתם את הפעולה, היכנסו מיד לחשבון, הפעילו מחדש אימות דו-שלבי וצרו קשר עם התמיכה.</p>`
    ),
    text: `שלום ${params.firstName || ''}, אימות דו-שלבי הושבת בחשבונך וכל ההתחברויות נותקו. אם לא אתם ביצעתם את הפעולה - צרו קשר עם התמיכה מיד.`,
  });
}

/** Every successful recovery-code login (canonical §6.2a item 4). */
export async function sendRecoveryCodeUsedEmail(params: {
  to: string;
  firstName: string | null;
  remaining: number;
}): Promise<boolean> {
  const name = escapeHtml(params.firstName || '');
  return sendSecurityEmail({
    to: params.to,
    subject: 'קוד שחזור שימש להתחברות לחשבונך',
    html: wrapTemplate(
      'התחברות עם קוד שחזור',
      `<p style="color: #404040;">שלום ${name},</p>
       <p style="color: #404040;">בוצעה התחברות לחשבונך באמצעות קוד שחזור. נותרו ${params.remaining} קודי שחזור שלא נוצלו.</p>
       <p style="color: #404040;">אם לא אתם התחברתם - היכנסו מיד להגדרות האבטחה, אפסו את קודי השחזור ובדקו את פרטי החשבון.</p>`
    ),
    text: `שלום ${params.firstName || ''}, בוצעה התחברות לחשבונך עם קוד שחזור (נותרו ${params.remaining}). אם לא אתם התחברתם - בדקו את הגדרות האבטחה מיד.`,
  });
}

/** Operator reset (canonical §7.3) - the target is notified, always. */
export async function sendMfaResetByOperatorEmail(params: {
  to: string;
  firstName: string | null;
}): Promise<boolean> {
  const name = escapeHtml(params.firstName || '');
  return sendSecurityEmail({
    to: params.to,
    subject: 'אימות דו-שלבי אופס על ידי התמיכה',
    html: wrapTemplate(
      'אימות דו-שלבי אופס',
      `<p style="color: #404040;">שלום ${name},</p>
       <p style="color: #404040;">האימות הדו-שלבי בחשבונך אופס על ידי צוות התמיכה, וכל ההתחברויות הפעילות נותקו.
       בהתחברות הבאה תוכלו להירשם מחדש לאימות דו-שלבי.</p>
       <p style="color: #404040;">אם לא ביקשתם איפוס - צרו קשר עם התמיכה מיד.</p>`
    ),
    text: `שלום ${params.firstName || ''}, האימות הדו-שלבי בחשבונך אופס על ידי התמיכה וכל ההתחברויות נותקו. אם לא ביקשתם זאת - צרו קשר עם התמיכה מיד.`,
  });
}
