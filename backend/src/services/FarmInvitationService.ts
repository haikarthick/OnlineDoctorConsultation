import crypto from 'crypto';
import database from '../utils/database';
import logger from '../utils/logger';
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import FarmAccessService, { Actor, FarmRole, isFarmRole } from './FarmAccessService';
import EnterpriseService from './EnterpriseService';
import UserService from './UserService';
import SmsService, { SmsOutcome } from './SmsService';
import NotificationService from './NotificationService';
import emailService from './EmailService';
import { normalizePhone, maskPhone } from './sms/phone';

/**
 * Farm team invitations (migration 048). The owner - or a manager, for the roles below a manager -
 * invites a person by mobile number and/or email with a role. Nobody asks to join.
 *
 * Lifecycle: pending -> accepted | declined | expired | revoked (7 days). The link holds a random
 * token; only its hash is stored. Accepting adds the person to enterprise_members (the one source of
 * truth for who is on a farm) and gives them a farm workspace (secondary 'farmer' role, see
 * EnterpriseService.grantFarmWorkspace) whatever their platform role is.
 */
export const INVITE_DAYS = 7;
export const RESEND_COOLDOWN_SECONDS = 60;
/** A person invited by mobile number only has no email; users.email is NOT NULL, so they get this placeholder. */
export const PHONE_ONLY_EMAIL_DOMAIN = 'phone.waytovet.invalid';
export const isPlaceholderEmail = (email: string | null | undefined): boolean => !!email && email.toLowerCase().endsWith(`@${PHONE_ONLY_EMAIL_DOMAIN}`);

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const newToken = () => crypto.randomBytes(24).toString('base64url');
const lower = (s: unknown) => (typeof s === 'string' && s.trim() ? s.trim().toLowerCase() : null);

const ROLE_WORDS: Record<string, string> = { manager: 'manager', supervisor: 'supervisor', worker: 'worker', farm_vet: 'farm vet', viewer: 'viewer', owner: 'owner' };

export function appBaseUrl(): string {
  return process.env.FRONTEND_URL || (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL.replace('/api/v1', '') : '') || 'http://localhost:5173';
}

export interface InvitationView {
  id: string; role: string; status: string; inviteeName: string | null;
  inviteePhoneMasked: string | null; inviteeEmail: string | null;
  expiresAt: string; createdAt: string; lastSentAt: string | null; sendCount: number;
  smsStatus: string | null; emailStatus: string | null; invitedByName: string | null; canResendAt: string | null;
}

class FarmInvitationService {

  private async expireOld(enterpriseId?: string): Promise<void> {
    await database.query(
      `UPDATE farm_invitations SET status = 'expired', decided_at = NOW(), updated_at = NOW()
        WHERE status = 'pending' AND expires_at < NOW() ${enterpriseId ? 'AND enterprise_id = $1' : ''}`,
      enterpriseId ? [enterpriseId] : []
    );
  }

  private view(r: any): InvitationView {
    const sentAt = r.last_sent_at ? new Date(r.last_sent_at) : null;
    return {
      id: r.id, role: r.role, status: r.status, inviteeName: r.invitee_name || null,
      inviteePhoneMasked: r.invitee_phone ? maskPhone(r.invitee_phone) : null, inviteeEmail: r.invitee_email || null,
      expiresAt: new Date(r.expires_at).toISOString(), createdAt: new Date(r.created_at).toISOString(),
      lastSentAt: sentAt ? sentAt.toISOString() : null, sendCount: Number(r.send_count || 0),
      smsStatus: r.sms_status || null, emailStatus: r.email_status || null, invitedByName: r.invited_by_name || null,
      canResendAt: sentAt ? new Date(sentAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000).toISOString() : null,
    };
  }

  /** Who is this invitation for, if they already have an account? Matched by mobile number or email. */
  private async findAccount(phone: string | null, email: string | null): Promise<{ id: string; role: string; email: string; phone: string | null; firstName: string } | null> {
    if (!phone && !email) return null;
    const r = await database.query(
      `SELECT id, role, email, phone_e164 AS phone, first_name AS "firstName" FROM users
        WHERE (${phone ? 'phone_e164 = $1' : 'false'}) OR (${email ? `LOWER(email) = $${phone ? 2 : 1}` : 'false'}) LIMIT 1`,
      [phone, email].filter(v => v !== null)
    );
    return r.rows[0] || null;
  }

  private async farmAndInviter(enterpriseId: string, inviterId: string): Promise<{ farm: string; inviter: string }> {
    const f = await database.query(`SELECT name FROM enterprises WHERE id = $1`, [enterpriseId]);
    const u = await database.query(`SELECT first_name, last_name FROM users WHERE id = $1`, [inviterId]);
    return { farm: f.rows[0]?.name || 'a farm', inviter: [u.rows[0]?.first_name, u.rows[0]?.last_name].filter(Boolean).join(' ') || 'The farm owner' };
  }

  /** Sends the invitation by SMS and / or email and notifies an existing account. Never throws for delivery problems. */
  private async deliver(inv: { id: string; enterpriseId: string; role: string; phone: string | null; email: string | null; name: string | null; token: string }, inviterId: string, existingUserId: string | null) {
    const { farm, inviter } = await this.farmAndInviter(inv.enterpriseId, inviterId);
    const link = `${appBaseUrl()}/join-farm?token=${inv.token}`;
    const role = ROLE_WORDS[inv.role] || inv.role;
    let sms: SmsOutcome | null = null;
    let emailStatus: string | null = null;

    if (inv.phone) sms = await SmsService.send({ to: inv.phone, template: 'farm_invite', vars: { inviter, farm, role, link }, requestedBy: inviterId });
    if (inv.email && !isPlaceholderEmail(inv.email)) {
      try {
        await emailService.send({ to: inv.email, subject: '', template: 'farm_invite', data: { inviteeName: inv.name, inviter, farm, role, inviteUrl: link } });
        emailStatus = 'sent';
      } catch (err: any) {
        logger.warn('Farm invitation email failed', { error: err.message });
        emailStatus = 'failed';
      }
    }
    if (existingUserId) {
      try {
        await NotificationService.createNotification(existingUserId, 'system', `${inviter} invited you to ${farm}`,
          `You were invited to join ${farm} as ${role}. Open your invitations to accept or decline.`, 'in_app', { type: 'farm_invite', enterpriseId: inv.enterpriseId });
      } catch (err: any) { logger.warn('Farm invitation notification failed', { error: err.message }); }
    }
    await database.query(
      `UPDATE farm_invitations SET last_sent_at = NOW(), send_count = send_count + 1, sms_status = $2, email_status = $3, updated_at = NOW() WHERE id = $1`,
      [inv.id, sms ? sms.status : null, emailStatus]
    );
    return { link, sms, emailStatus };
  }

  async create(enterpriseId: string, actor: Actor, input: { phone?: string; email?: string; name?: string; role: string }) {
    const actorRole = await FarmAccessService.assert(enterpriseId, actor, 'manage_team');
    if (!isFarmRole(input.role)) throw new ValidationError('Choose a role: manager, supervisor, worker, farm vet or viewer.');
    FarmAccessService.assertTeamChange(actorRole, { kind: 'add', newRole: input.role });

    const email = lower(input.email);
    const phone = input.phone && String(input.phone).trim() ? normalizePhone(input.phone) : null;
    if (input.phone && String(input.phone).trim() && !phone) throw new ValidationError('Please enter a valid mobile number, for example 98765 43210.');
    if (!phone && !email) throw new ValidationError("Enter the person's mobile number or email so we can send the invitation.");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidationError('Please enter a valid email address.');
    if (email && isPlaceholderEmail(email)) throw new ValidationError('Please enter a real email address.');

    await this.expireOld(enterpriseId);

    const account = await this.findAccount(phone, email);
    if (account) {
      const already = await FarmAccessService.roleOf(enterpriseId, account.id);
      if (already) throw new ConflictError(`${account.firstName || 'This person'} is already on this farm as ${ROLE_WORDS[already] || already}.`);
    }
    const dup = await database.query(
      `SELECT 1 FROM farm_invitations WHERE enterprise_id = $1 AND status = 'pending'
          AND ((${phone ? 'invitee_phone = $2' : 'false'}) OR (${email ? `invitee_email = $${phone ? 3 : 2}` : 'false'})) LIMIT 1`,
      [enterpriseId, ...[phone, email].filter(v => v !== null)]
    );
    if (dup.rows.length) throw new ConflictError('An invitation is already waiting for this person. You can resend it from the team list.');

    const token = newToken();
    const ins = await database.query(
      `INSERT INTO farm_invitations (enterprise_id, role, invitee_phone, invitee_email, invitee_name, token_hash, invited_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [enterpriseId, input.role, phone, email, input.name ? String(input.name).trim().slice(0, 150) : null, hash(token), actor.userId]
    );
    const id = ins.rows[0].id;
    const delivery = await this.deliver({ id, enterpriseId, role: input.role, phone, email, name: input.name || null, token }, actor.userId, account?.id || null);
    logger.info('Farm invitation created', { enterpriseId, id, role: input.role });
    return { invitation: await this.getView(id), link: delivery.link, sms: delivery.sms, emailStatus: delivery.emailStatus, existingAccount: !!account };
  }

  private async getView(id: string): Promise<InvitationView> {
    const r = await database.query(
      `SELECT i.*, u.first_name || ' ' || u.last_name AS invited_by_name FROM farm_invitations i LEFT JOIN users u ON u.id = i.invited_by WHERE i.id = $1`, [id]);
    return this.view(r.rows[0]);
  }

  async list(enterpriseId: string, actor: Actor): Promise<InvitationView[]> {
    await FarmAccessService.assert(enterpriseId, actor, 'manage_team');
    await this.expireOld(enterpriseId);
    const r = await database.query(
      `SELECT i.*, u.first_name || ' ' || u.last_name AS invited_by_name FROM farm_invitations i LEFT JOIN users u ON u.id = i.invited_by
        WHERE i.enterprise_id = $1 AND (i.status = 'pending' OR i.created_at > NOW() - INTERVAL '30 days')
        ORDER BY (i.status = 'pending') DESC, i.created_at DESC LIMIT 100`, [enterpriseId]);
    return r.rows.map((x: any) => this.view(x));
  }

  private async loadForManage(enterpriseId: string, invitationId: string, actor: Actor) {
    const actorRole = await FarmAccessService.assert(enterpriseId, actor, 'manage_team');
    const r = await database.query(`SELECT * FROM farm_invitations WHERE id = $1 AND enterprise_id = $2`, [invitationId, enterpriseId]);
    if (!r.rows.length) throw new NotFoundError('That invitation was not found. It may have been removed.');
    // A manager may only handle invitations for the roles below a manager.
    FarmAccessService.assertTeamChange(actorRole, { kind: 'add', newRole: r.rows[0].role });
    return r.rows[0];
  }

  async resend(enterpriseId: string, invitationId: string, actor: Actor) {
    const inv = await this.loadForManage(enterpriseId, invitationId, actor);
    await this.expireOld(enterpriseId);
    const cur = await database.query(`SELECT status, last_sent_at FROM farm_invitations WHERE id = $1`, [invitationId]);
    if (cur.rows[0].status !== 'pending') throw new ValidationError(`This invitation is ${cur.rows[0].status}, so it cannot be resent. Send a new one instead.`);
    const last = cur.rows[0].last_sent_at ? new Date(cur.rows[0].last_sent_at).getTime() : 0;
    const wait = Math.ceil((last + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);
    if (wait > 0) throw new ValidationError(`It was sent a moment ago. Please wait ${wait} seconds before sending it again.`);

    // A new link each time (only the hash is stored, so the old link cannot be re-sent), and a fresh 7 days.
    const token = newToken();
    await database.query(`UPDATE farm_invitations SET token_hash = $2, expires_at = NOW() + INTERVAL '${INVITE_DAYS} days', updated_at = NOW() WHERE id = $1`, [invitationId, hash(token)]);
    const account = await this.findAccount(inv.invitee_phone, inv.invitee_email);
    const delivery = await this.deliver({ id: invitationId, enterpriseId, role: inv.role, phone: inv.invitee_phone, email: inv.invitee_email, name: inv.invitee_name, token }, actor.userId, account?.id || null);
    return { invitation: await this.getView(invitationId), link: delivery.link, sms: delivery.sms, emailStatus: delivery.emailStatus };
  }

  async revoke(enterpriseId: string, invitationId: string, actor: Actor): Promise<void> {
    await this.loadForManage(enterpriseId, invitationId, actor);
    const r = await database.query(
      `UPDATE farm_invitations SET status = 'revoked', decided_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'pending'`, [invitationId]);
    if (!r.rowCount) throw new ValidationError('This invitation is no longer waiting, so there is nothing to cancel.');
  }

  // ── The invited person's side ──────────────────────────────────────────────

  private async byToken(token: string): Promise<any> {
    if (!token || typeof token !== 'string' || token.length < 16 || token.length > 200) throw new NotFoundError('This invitation link is not valid. Ask the farm owner to send a new one.');
    await this.expireOld();
    const r = await database.query(
      `SELECT i.*, e.name AS farm_name, u.first_name || ' ' || u.last_name AS inviter_name
         FROM farm_invitations i JOIN enterprises e ON e.id = i.enterprise_id LEFT JOIN users u ON u.id = i.invited_by
        WHERE i.token_hash = $1`, [hash(token)]);
    if (!r.rows.length) throw new NotFoundError('This invitation link is not valid. Ask the farm owner to send a new one.');
    return r.rows[0];
  }

  private statusProblem(inv: any): string | null {
    switch (inv.status) {
      case 'pending': return null;
      case 'accepted': return 'This invitation was already accepted.';
      case 'declined': return 'This invitation was declined.';
      case 'revoked': return 'The farm owner cancelled this invitation. Ask them to send a new one if you still need access.';
      default: return 'This invitation has expired (they last 7 days). Ask the farm owner to send a new one.';
    }
  }

  /** What the link shows before anyone signs in: the farm's name, the role, and whether they already have an account. */
  async preview(token: string) {
    const inv = await this.byToken(token);
    const account = await this.findAccount(inv.invitee_phone, inv.invitee_email);
    return {
      farmName: inv.farm_name, role: inv.role, inviterName: inv.inviter_name || null, inviteeName: inv.invitee_name || null,
      status: inv.status, problem: this.statusProblem(inv),
      hasAccount: !!account, sentTo: inv.invitee_phone ? maskPhone(inv.invitee_phone) : inv.invitee_email,
      byPhone: !!inv.invitee_phone, byEmail: !!inv.invitee_email && !isPlaceholderEmail(inv.invitee_email), expiresAt: new Date(inv.expires_at).toISOString(),
    };
  }

  /** The person's own pending invitations (shown when they sign in), matched by their mobile number or email. */
  async mine(userId: string) {
    await this.expireOld();
    const me = await database.query(`SELECT phone_e164, LOWER(email) AS email FROM users WHERE id = $1`, [userId]);
    if (!me.rows.length) return [];
    const r = await database.query(
      `SELECT i.id, i.role, i.expires_at, e.name AS farm_name, u.first_name || ' ' || u.last_name AS inviter_name
         FROM farm_invitations i JOIN enterprises e ON e.id = i.enterprise_id LEFT JOIN users u ON u.id = i.invited_by
        WHERE i.status = 'pending' AND (i.invitee_phone = $1 OR i.invitee_email = $2) ORDER BY i.created_at DESC`,
      [me.rows[0].phone_e164, me.rows[0].email]);
    return r.rows.map((x: any) => ({ id: x.id, farmName: x.farm_name, role: x.role, inviterName: x.inviter_name, expiresAt: new Date(x.expires_at).toISOString() }));
  }

  private async assertForMe(inv: any, userId: string): Promise<void> {
    const me = await database.query(`SELECT phone_e164, LOWER(email) AS email FROM users WHERE id = $1`, [userId]);
    const u = me.rows[0];
    const matches = !!u && ((inv.invitee_phone && u.phone_e164 === inv.invitee_phone) || (inv.invitee_email && u.email === inv.invitee_email));
    if (!matches) {
      const target = inv.invitee_phone ? maskPhone(inv.invitee_phone) : inv.invitee_email;
      throw new ForbiddenError(`This invitation was sent to ${target}. Sign in with that mobile number or email to answer it.`);
    }
  }

  /** The same invitation, found by its id - for the person's own list after sign-in (no link needed). */
  private async byIdForMe(invitationId: string): Promise<any> {
    await this.expireOld();
    const r = await database.query(
      `SELECT i.*, e.name AS farm_name, u.first_name || ' ' || u.last_name AS inviter_name
         FROM farm_invitations i JOIN enterprises e ON e.id = i.enterprise_id LEFT JOIN users u ON u.id = i.invited_by
        WHERE i.id = $1`, [invitationId]);
    if (!r.rows.length) throw new NotFoundError('That invitation was not found. It may have been cancelled.');
    return r.rows[0];
  }

  async acceptById(invitationId: string, userId: string) {
    return this.acceptInvitation(await this.byIdForMe(invitationId), userId);
  }

  async declineById(invitationId: string, userId: string) {
    return this.declineInvitation(await this.byIdForMe(invitationId), userId);
  }

  async accept(token: string, userId: string) {
    return this.acceptInvitation(await this.byToken(token), userId);
  }

  private async acceptInvitation(inv: any, userId: string) {
    const problem = this.statusProblem(inv);
    if (problem) throw new ValidationError(problem);
    await this.assertForMe(inv, userId);
    await EnterpriseService.addMember(inv.enterprise_id, userId, inv.role); // also gives them the farm workspace
    await database.query(`UPDATE farm_invitations SET status = 'accepted', accepted_by = $2, decided_at = NOW(), updated_at = NOW() WHERE id = $1`, [inv.id, userId]);
    await this.tell(inv, userId, 'accepted');
    return { farmId: inv.enterprise_id, farmName: inv.farm_name, role: inv.role };
  }

  async decline(token: string, userId: string) {
    return this.declineInvitation(await this.byToken(token), userId);
  }

  private async declineInvitation(inv: any, userId: string) {
    const problem = this.statusProblem(inv);
    if (problem) throw new ValidationError(problem);
    await this.assertForMe(inv, userId);
    await database.query(`UPDATE farm_invitations SET status = 'declined', decided_at = NOW(), updated_at = NOW() WHERE id = $1`, [inv.id]);
    await this.tell(inv, userId, 'declined');
  }

  private async tell(inv: any, userId: string, outcome: 'accepted' | 'declined'): Promise<void> {
    try {
      if (!inv.invited_by) return;
      const u = await database.query(`SELECT first_name, last_name FROM users WHERE id = $1`, [userId]);
      const who = [u.rows[0]?.first_name, u.rows[0]?.last_name].filter(Boolean).join(' ') || inv.invitee_name || 'The person you invited';
      await NotificationService.createNotification(inv.invited_by, 'system',
        outcome === 'accepted' ? `${who} joined ${inv.farm_name}` : `${who} declined the invitation to ${inv.farm_name}`,
        outcome === 'accepted' ? `${who} accepted your invitation and is now on the team as ${ROLE_WORDS[inv.role] || inv.role}.` : `${who} declined your invitation to join ${inv.farm_name}.`,
        'in_app', { type: 'farm_invite_' + outcome, enterpriseId: inv.enterprise_id });
    } catch (err: any) { logger.warn('Could not tell the inviter', { error: err.message }); }
  }

  /**
   * A person with no account answers the invitation by creating one. The link itself proves they
   * hold the number / email it was sent to. The account is a plain one: platform role 'farmer' (the
   * farm workspace), and the number becomes their sign-in identifier.
   */
  async registerFromInvite(token: string, input: { firstName: string; lastName: string; password: string; email?: string }) {
    const inv = await this.byToken(token);
    const problem = this.statusProblem(inv);
    if (problem) throw new ValidationError(problem);
    const existing = await this.findAccount(inv.invitee_phone, inv.invitee_email);
    if (existing) throw new ConflictError('There is already an account for this mobile number or email. Sign in to answer the invitation.');

    const realEmail = lower(input.email) || (inv.invitee_email && !isPlaceholderEmail(inv.invitee_email) ? inv.invitee_email : null);
    const email = realEmail || `m${(inv.invitee_phone || '').replace(/\D/g, '')}@${PHONE_ONLY_EMAIL_DOMAIN}`;
    const user = await UserService.createUser({
      email, firstName: input.firstName, lastName: input.lastName, phone: inv.invitee_phone || '', password: input.password, role: 'farmer',
    } as any);
    if (inv.invitee_phone) {
      await database.query(`UPDATE users SET phone_verified_at = NOW() WHERE id = $1`, [user.id]);
    }
    const accepted = await this.accept(token, user.id);
    return { ...accepted, identifier: inv.invitee_phone || email };
  }
}

export default new FarmInvitationService();
