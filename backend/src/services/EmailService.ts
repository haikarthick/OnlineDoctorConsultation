/**
 * Email Service
 *
 * Provides a template-driven email sending layer using nodemailer.
 *
 * Configuration via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * In development the service falls back to Ethereal (https://ethereal.email)
 * so emails are captured for inspection without a real SMTP server.
 */

import nodemailer, { Transporter } from 'nodemailer';
import logger from '../utils/logger';

// ── Types ─────────────────────────────────────────────────────

export interface EmailOptions {
  to: string | string[];
  subject: string;
  /** Prebuilt HTML body (takes precedence over template) */
  html?: string;
  /** Plain-text fallback */
  text?: string;
  /** Named template + data (rendered via built-in templates) */
  template?: string;
  data?: Record<string, any>;
}

interface EmailTemplate {
  subject: (data: Record<string, any>) => string;
  html: (data: Record<string, any>) => string;
  text: (data: Record<string, any>) => string;
}

// ── Built-in Email Templates ──────────────────────────────────

const templates: Record<string, EmailTemplate> = {
  welcome: {
    subject: (d) => `Welcome to VetCare, ${d.firstName}!`,
    html: (d) => `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
        <div style="text-align:center;margin-bottom:24px"><span style="font-size:48px">🏥</span></div>
        <h1 style="color:#667eea;text-align:center;margin-bottom:16px">Welcome to VetCare!</h1>
        <p>Hi <strong>${d.firstName}</strong>,</p>
        <p>Thank you for registering on VetCare — the complete animal health platform. Your account is ready to use.</p>
        <ul>
          <li><strong>Email:</strong> ${d.email}</li>
          <li><strong>Role:</strong> ${d.role}</li>
        </ul>
        <p>If you have any questions, reply to this email or contact support.</p>
        <p style="margin-top:32px;color:#999;font-size:12px">— The VetCare Team</p>
      </div>`,
    text: (d) => `Welcome to VetCare, ${d.firstName}!\n\nYour account (${d.email}) with role "${d.role}" is ready.\n\n— The VetCare Team`,
  },

  consultation_booked: {
    subject: (d) => `Consultation Booked – ${d.consultationId}`,
    html: (d) => `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#667eea">Consultation Booked</h2>
        <p>Hi <strong>${d.userName}</strong>,</p>
        <p>Your consultation has been booked successfully.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;font-weight:600">ID</td><td>${d.consultationId}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600">Doctor</td><td>${d.vetName || 'Assigned soon'}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600">Date / Time</td><td>${d.scheduledAt || 'TBD'}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600">Type</td><td>${d.type || 'video_call'}</td></tr>
        </table>
        <p style="margin-top:32px;color:#999;font-size:12px">— VetCare Notifications</p>
      </div>`,
    text: (d) => `Consultation ${d.consultationId} booked.\nDoctor: ${d.vetName || 'TBD'}\nDate: ${d.scheduledAt || 'TBD'}\nType: ${d.type || 'video_call'}`,
  },

  consultation_completed: {
    subject: (d) => `Consultation Completed – ${d.consultationId}`,
    html: (d) => `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#2e7d32">Consultation Completed ✓</h2>
        <p>Hi <strong>${d.userName}</strong>,</p>
        <p>Your consultation <strong>${d.consultationId}</strong> with <strong>${d.vetName}</strong> has been completed.</p>
        <p>You can view your medical records and prescriptions in your dashboard.</p>
        <p>If you had a good experience, please consider leaving a review!</p>
        <p style="margin-top:32px;color:#999;font-size:12px">— VetCare Notifications</p>
      </div>`,
    text: (d) => `Consultation ${d.consultationId} with ${d.vetName} completed.\nCheck your dashboard for records and prescriptions.`,
  },

  password_reset: {
    subject: () => 'VetCare — Password Reset Request',
    html: (d) => `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#d32f2f">Password Reset</h2>
        <p>Hi <strong>${d.firstName}</strong>,</p>
        <p>We received a request to reset your password. Use the link below within 1 hour:</p>
        <p style="text-align:center;margin:24px 0"><a href="${d.resetUrl}" style="background:#667eea;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a></p>
        <p>If you did not request this, you can ignore this email.</p>
        <p style="margin-top:32px;color:#999;font-size:12px">— VetCare Security</p>
      </div>`,
    text: (d) => `Password reset requested.\nReset URL: ${d.resetUrl}\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.`,
  },

  payment_receipt: {
    subject: (d) => `Payment Receipt – ${d.paymentId}`,
    html: (d) => `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#667eea">Payment Received</h2>
        <p>Hi <strong>${d.userName}</strong>,</p>
        <p>We've received your payment of <strong>$${(d.amount / 100).toFixed(2)}</strong> for consultation <strong>${d.consultationId}</strong>.</p>
        <p>Payment ID: ${d.paymentId}</p>
        <p style="margin-top:32px;color:#999;font-size:12px">— VetCare Billing</p>
      </div>`,
    text: (d) => `Payment of $${(d.amount / 100).toFixed(2)} received.\nPayment ID: ${d.paymentId}\nConsultation: ${d.consultationId}`,
  },
};

// ── Service ───────────────────────────────────────────────────

class EmailService {
  private transporter: Transporter | null = null;
  private from: string;

  constructor() {
    this.from = process.env.SMTP_FROM || 'VetCare <noreply@vetcare.app>';
  }

  /** Lazy-initialize the nodemailer transporter */
  private async getTransporter(): Promise<Transporter> {
    if (this.transporter) return this.transporter;

    if (process.env.SMTP_HOST) {
      // Real SMTP configuration
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: (process.env.SMTP_PORT || '587') === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      logger.info('Email transporter configured with real SMTP');
    } else {
      // Use Ethereal test account in dev
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      logger.info(`Email transporter using Ethereal test account: ${testAccount.user}`);
    }

    return this.transporter;
  }

  /**
   * Send an email.
   * If a template is specified, it takes precedence over raw html/text.
   */
  async send(options: EmailOptions): Promise<{ messageId: string; previewUrl?: string | false }> {
    const transporter = await this.getTransporter();

    let subject = options.subject;
    let html = options.html || '';
    let text = options.text || '';

    // Resolve template
    if (options.template && templates[options.template]) {
      const tpl = templates[options.template];
      const data = options.data || {};
      subject = tpl.subject(data);
      html = tpl.html(data);
      text = tpl.text(data);
    }

    const info = await transporter.sendMail({
      from: this.from,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject,
      html,
      text,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      logger.info(`Email preview URL: ${previewUrl}`);
    }

    logger.info(`Email sent: ${info.messageId} → ${options.to}`);
    return { messageId: info.messageId, previewUrl };
  }

  /** Helper: send a welcome email */
  async sendWelcome(to: string, data: { firstName: string; email: string; role: string }) {
    return this.send({ to, subject: '', template: 'welcome', data });
  }

  /** Helper: consultation booked notification */
  async sendConsultationBooked(to: string, data: Record<string, any>) {
    return this.send({ to, subject: '', template: 'consultation_booked', data });
  }

  /** Helper: consultation completed notification */
  async sendConsultationCompleted(to: string, data: Record<string, any>) {
    return this.send({ to, subject: '', template: 'consultation_completed', data });
  }

  /** Helper: password reset email */
  async sendPasswordReset(to: string, data: { firstName: string; resetUrl: string }) {
    return this.send({ to, subject: '', template: 'password_reset', data });
  }

  /** Helper: payment receipt */
  async sendPaymentReceipt(to: string, data: Record<string, any>) {
    return this.send({ to, subject: '', template: 'payment_receipt', data });
  }
}

const emailService = new EmailService();
export default emailService;
