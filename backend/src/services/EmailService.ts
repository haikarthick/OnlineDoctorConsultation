/**
 * Email Service
 *
 * Priority: Resend (HTTP) → SMTP → Log-only fallback
 *
 * Configuration via environment variables:
 *   RESEND_API_KEY          — Resend HTTP API (works on all platforms including Render)
 *   SMTP_HOST/PORT/USER/PASS — Traditional SMTP (may be blocked on some cloud platforms)
 *   SMTP_FROM               — Sender address for both providers
 *   EMAIL_DEV_REDIRECT      — Redirect ALL emails to this address in dev/demo
 */

import nodemailer, { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { Resend } from 'resend';
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

  staff_invite: {
    subject: (d) => `You're invited to join ${d.networkName} on VetCare`,
    html: (d) => `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
      <div style="text-align:center;margin-bottom:24px"><span style="font-size:48px">🏥</span></div>
      <h2 style="color:#667eea;text-align:center">You've been invited!</h2>
      <p>Hi ${d.inviteeName || 'there'},</p>
      <p>You've been invited to join <strong>${d.networkName}</strong> as a <strong>${d.position}</strong>${d.hospitalName ? ` at <strong>${d.hospitalName}</strong>` : ''}.</p>
      <p>Click the button below to create your account and accept the invitation:</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${d.inviteUrl}" style="background:#667eea;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Accept Invitation</a>
      </p>
      <p style="color:#6b7280;font-size:13px">This invitation expires in 7 days. If you did not expect this invitation, you can safely ignore this email.</p>
      <p style="color:#6b7280;font-size:13px">Or copy this link: <a href="${d.inviteUrl}">${d.inviteUrl}</a></p>
      <p style="margin-top:32px;color:#999;font-size:12px">— The VetCare Team</p>
    </div>`,
    text: (d) => `You've been invited to join ${d.networkName} as a ${d.position}.\n\nAccept here: ${d.inviteUrl}\n\nThis link expires in 7 days.`,
  },
};

// ── Service ───────────────────────────────────────────────────

class EmailService {
  private transporter: Transporter | null = null;
  private resendClient: Resend | null = null;
  private from: string;
  /** 'resend' | 'smtp' | 'log-only' */
  private mode: string = 'unknown';
  private initialized = false;

  constructor() {
    this.from = process.env.SMTP_FROM || 'VetCare <noreply@vetcare.app>';
    // Eagerly check for Resend API key
    if (process.env.RESEND_API_KEY) {
      this.resendClient = new Resend(process.env.RESEND_API_KEY);
      this.mode = 'resend';
      this.initialized = true;
      logger.info('Email service using Resend HTTP API');
    }
  }

  /** Initialize SMTP transporter (only called if Resend not available) */
  private async initSmtp(): Promise<boolean> {
    if (!process.env.SMTP_HOST) return false;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = port === 465;

    try {
      const opts: SMTPTransport.Options = {
        host, port, secure,
        auth: { user, pass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 15000,
        tls: { rejectUnauthorized: false },
      };
      const transport = nodemailer.createTransport(opts);
      await Promise.race([
        transport.verify(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP verify timeout (10s hard limit)')), 10000)),
      ]);
      this.transporter = transport;
      this.mode = 'smtp';
      logger.info(`SMTP connection verified: ${host}:${port}`);
      return true;
    } catch (err: any) {
      logger.error(`SMTP connection failed (${host}:${port}): ${err.message}`);
      return false;
    }
  }

  /** Ensure the service is initialized (lazy for SMTP) */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Try SMTP
    if (await this.initSmtp()) return;

    // All providers failed — log-only mode
    this.mode = 'log-only';
    logger.warn('Email service in LOG-ONLY mode. Set RESEND_API_KEY (recommended) or configure working SMTP for delivery.');
  }

  /**
   * Send an email via Resend, SMTP, or log-only depending on available provider.
   */
  async send(options: EmailOptions): Promise<{ messageId: string; previewUrl?: string | false; mode?: string }> {
    await this.ensureInitialized();

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

    // Dev/demo email redirect
    const devRedirect = process.env.EMAIL_DEV_REDIRECT;
    let actualTo = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    if (devRedirect) {
      subject = `[DEV→${actualTo}] ${subject}`;
      actualTo = devRedirect;
      logger.info(`Email redirected to dev address: ${devRedirect} (original: ${options.to})`);
    }

    // ── Resend (HTTP API) ──
    if (this.mode === 'resend' && this.resendClient) {
      try {
        const { data: resendData, error } = await this.resendClient.emails.send({
          from: this.from,
          to: actualTo,
          subject,
          html,
          text,
        });
        if (error) throw new Error(error.message);
        const messageId = resendData?.id || `resend-${Date.now()}`;
        logger.info(`Email sent via Resend: ${messageId} → ${actualTo}`);
        return { messageId, mode: 'resend' };
      } catch (err: any) {
        logger.error(`Resend send failed: ${err.message}`);
        throw err;
      }
    }

    // ── SMTP (nodemailer) ──
    if (this.mode === 'smtp' && this.transporter) {
      const info = await this.transporter.sendMail({ from: this.from, to: actualTo, subject, html, text });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) logger.info(`Email preview URL: ${previewUrl}`);
      logger.info(`Email sent via SMTP: ${info.messageId} → ${actualTo}`);
      return { messageId: info.messageId, previewUrl, mode: 'smtp' };
    }

    // ── Log-only fallback ──
    const logId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    logger.info(`[EMAIL-LOG] ${logId} | To: ${actualTo} | Subject: ${subject}`);
    logger.info(`[EMAIL-LOG] ${logId} | Text: ${text.substring(0, 500)}`);
    return { messageId: logId, previewUrl: false as const, mode: 'log-only' };
  }

  /** Get current email provider mode */
  getMode(): string { return this.mode; }

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
