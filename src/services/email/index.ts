/**
 * Resend Email Service
 *
 * Handles transactional emails:
 * - Welcome emails
 * - Vote notifications
 * - Vote results
 * - Payment receipts
 */

import { Resend } from 'resend';

interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private resend: Resend;
  private config: EmailConfig;

  constructor() {
    this.config = {
      apiKey: process.env.RESEND_API_KEY || '',
      fromEmail: 'noreply@sync.co.il',
      fromName: 'סינק',
    };
    this.resend = new Resend(this.config.apiKey);
  }

  private getFromAddress(): string {
    return `${this.config.fromName} <${this.config.fromEmail}>`;
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(params: {
    to: string;
    firstName: string;
  }): Promise<void> {
    const template = this.getWelcomeTemplate(params.firstName);

    await this.resend.emails.send({
      from: this.getFromAddress(),
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send vote notification email
   */
  async sendVoteNotification(params: {
    to: string;
    firstName: string;
    voteTitle: string;
    voteId: string;
    municipality: string;
    endDate: Date;
  }): Promise<void> {
    const template = this.getVoteNotificationTemplate(params);

    await this.resend.emails.send({
      from: this.getFromAddress(),
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send vote results email
   */
  async sendVoteResultsEmail(params: {
    to: string;
    firstName: string;
    voteTitle: string;
    voteId: string;
    winningOption: string;
    totalParticipants: number;
    userVotedFor: string;
    userWon: boolean;
  }): Promise<void> {
    const template = this.getVoteResultsTemplate(params);

    await this.resend.emails.send({
      from: this.getFromAddress(),
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send payment receipt email
   */
  async sendPaymentReceiptEmail(params: {
    to: string;
    firstName: string;
    amount: number;
    type: 'vote' | 'create_vote';
    receiptUrl: string;
    tokensEarned: number;
  }): Promise<void> {
    const template = this.getPaymentReceiptTemplate(params);

    await this.resend.emails.send({
      from: this.getFromAddress(),
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  // ============================================
  // EMAIL TEMPLATES
  // ============================================

  private getWelcomeTemplate(firstName: string): EmailTemplate {
    return {
      subject: 'ברוכים הבאים לסינק! 🎉',
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Heebo', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563EB; font-size: 32px; margin: 0;">סינק</h1>
            </div>

            <h2 style="color: #171717; font-size: 24px; margin-bottom: 16px;">שלום ${firstName}! 👋</h2>

            <p style="color: #525252; font-size: 16px; line-height: 1.6;">
              ברוכים הבאים למשפחת סינק! אנחנו שמחים שהצטרפת אלינו במסע לשינוי
              הדרך שבה אזרחים משתתפים בקבלת החלטות מקומיות.
            </p>

            <p style="color: #525252; font-size: 16px; line-height: 1.6;">
              עכשיו אתה יכול:
            </p>

            <ul style="color: #525252; font-size: 16px; line-height: 1.8;">
              <li>להצביע על נושאים מקומיים ברשות שלך</li>
              <li>ליזום הצבעות חדשות</li>
              <li>לצבור טוקני Sync</li>
              <li>לעקוב אחרי החלטות והשפעות</li>
            </ul>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background-color: #2563EB; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                התחילו להצביע
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

            <p style="color: #737373; font-size: 14px; text-align: center;">
              הקול שלך. הקהילה שלך. העתיד שלנו.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `שלום ${firstName}! ברוכים הבאים לסינק. עכשיו אתה יכול להצביע על נושאים מקומיים ברשות שלך.`,
    };
  }

  private getVoteNotificationTemplate(params: {
    firstName: string;
    voteTitle: string;
    voteId: string;
    municipality: string;
    endDate: Date;
  }): EmailTemplate {
    const formattedDate = params.endDate.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      subject: `הצבעה חדשה ב${params.municipality}: ${params.voteTitle}`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Heebo', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563EB; font-size: 32px; margin: 0;">סינק</h1>
            </div>

            <h2 style="color: #171717; font-size: 24px; margin-bottom: 16px;">שלום ${params.firstName}!</h2>

            <p style="color: #525252; font-size: 16px; line-height: 1.6;">
              יש הצבעה חדשה ב${params.municipality} שמחכה לקול שלך:
            </p>

            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #171717; font-size: 20px; margin: 0 0 10px 0;">${params.voteTitle}</h3>
              <p style="color: #737373; font-size: 14px; margin: 0;">
                מסתיימת ב: ${formattedDate}
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/votes/${params.voteId}" style="background-color: #2563EB; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                הצביעו עכשיו
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

            <p style="color: #737373; font-size: 14px; text-align: center;">
              הקול שלך. הקהילה שלך. העתיד שלנו.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `שלום ${params.firstName}! יש הצבעה חדשה ב${params.municipality}: ${params.voteTitle}. מסתיימת ב: ${formattedDate}`,
    };
  }

  private getVoteResultsTemplate(params: {
    firstName: string;
    voteTitle: string;
    voteId: string;
    winningOption: string;
    totalParticipants: number;
    userVotedFor: string;
    userWon: boolean;
  }): EmailTemplate {
    const resultEmoji = params.userWon ? '🎉' : '📊';
    const resultMessage = params.userWon
      ? 'הבחירה שלך זכתה!'
      : 'תוצאות ההצבעה התקבלו.';

    return {
      subject: `${resultEmoji} תוצאות ההצבעה: ${params.voteTitle}`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Heebo', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563EB; font-size: 32px; margin: 0;">סינק</h1>
            </div>

            <h2 style="color: #171717; font-size: 24px; margin-bottom: 16px;">שלום ${params.firstName}!</h2>

            <p style="color: #525252; font-size: 16px; line-height: 1.6;">
              ${resultMessage}
            </p>

            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #171717; font-size: 18px; margin: 0 0 15px 0;">${params.voteTitle}</h3>

              <div style="margin-bottom: 10px;">
                <span style="color: #737373; font-size: 14px;">האפשרות הזוכה:</span>
                <span style="color: #10B981; font-size: 16px; font-weight: 600; display: block;">${params.winningOption}</span>
              </div>

              <div style="margin-bottom: 10px;">
                <span style="color: #737373; font-size: 14px;">הצבעת עבור:</span>
                <span style="color: #171717; font-size: 16px; display: block;">${params.userVotedFor}</span>
              </div>

              <div>
                <span style="color: #737373; font-size: 14px;">סה״כ משתתפים:</span>
                <span style="color: #171717; font-size: 16px; display: block;">${params.totalParticipants.toLocaleString('he-IL')}</span>
              </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/votes/${params.voteId}" style="background-color: #2563EB; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                צפו בתוצאות המלאות
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

            <p style="color: #737373; font-size: 14px; text-align: center;">
              הקול שלך. הקהילה שלך. העתיד שלנו.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `שלום ${params.firstName}! תוצאות ההצבעה "${params.voteTitle}" התקבלו. האפשרות הזוכה: ${params.winningOption}. סה״כ משתתפים: ${params.totalParticipants}`,
    };
  }

  private getPaymentReceiptTemplate(params: {
    firstName: string;
    amount: number;
    type: 'vote' | 'create_vote';
    receiptUrl: string;
    tokensEarned: number;
  }): EmailTemplate {
    const paymentDescription =
      params.type === 'vote' ? 'השתתפות בהצבעה' : 'יצירת הצבעה';

    return {
      subject: `קבלה עבור ${paymentDescription} - סינק`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Heebo', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563EB; font-size: 32px; margin: 0;">סינק</h1>
            </div>

            <h2 style="color: #171717; font-size: 24px; margin-bottom: 16px;">תודה ${params.firstName}!</h2>

            <p style="color: #525252; font-size: 16px; line-height: 1.6;">
              התשלום שלך התקבל בהצלחה.
            </p>

            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span style="color: #737373;">פעולה:</span>
                <span style="color: #171717; font-weight: 500;">${paymentDescription}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span style="color: #737373;">סכום:</span>
                <span style="color: #171717; font-weight: 500;">₪${params.amount}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #737373;">טוקנים שנצברו:</span>
                <span style="color: #10B981; font-weight: 600;">${params.tokensEarned} SYNC</span>
              </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${params.receiptUrl}" style="background-color: #2563EB; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                הורידו קבלה
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

            <p style="color: #737373; font-size: 14px; text-align: center;">
              הקול שלך. הקהילה שלך. העתיד שלנו.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `תודה ${params.firstName}! התשלום שלך עבור ${paymentDescription} בסך ₪${params.amount} התקבל בהצלחה. צברת ${params.tokensEarned} טוקני SYNC.`,
    };
  }
}

export const emailService = new EmailService();
