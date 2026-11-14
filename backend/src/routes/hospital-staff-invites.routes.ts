import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { resolveNetworkAccess } from '../middleware/networkAccess';
import { asyncHandler } from '../utils/errorHandler';
import database from '../utils/database';
import logger from '../utils/logger';
import emailService from '../services/EmailService';
import { checkSeatLimit } from './network-subscriptions.routes';
import { inviteHospitalStaffSchema, acceptStaffInviteSchema } from '../middleware/validation';

const router = Router();

// HOSPITAL STAFF INVITES (invite-only registration for hospital_staff role)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/hospital-networks/:id/invite-staff', authMiddleware, roleMiddleware(['admin', 'corporate_admin', 'veterinarian', 'hospital_staff']), validateBody(inviteHospitalStaffSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  const networkId = req.params.id;
  // Secondary check: verify caller has appropriate network role for the (admin-configurable) inviteStaff action
  const access = await resolveNetworkAccess(networkId, authReq.userId, authReq.userRole, 'inviteStaff');
  if (!access.allowed) {
    if (access.reason === 'not_member') return res.status(404).json({ success: false, message: 'Network not found' });
    return res.status(403).json({ success: false, message: 'Only corporate admins and hospital directors can invite staff' });
  }
  const seat = await checkSeatLimit(networkId, db);
  if (!seat.allowed) {
    if (seat.status === 'suspended') return res.status(403).json({ success: false, message: 'This network has been suspended. Contact platform support.', code: 'network_suspended' });
    return res.status(403).json({ success: false, message: `Seat limit reached (${seat.used}/${seat.limit}). Contact platform admin to upgrade.`, code: 'seat_limit_exceeded', used: seat.used, limit: seat.limit });
  }
  const { invitee_email, invitee_name, staff_position, hospital_id } = req.body;
  const crypto = require('crypto');
  const token = crypto.randomBytes(48).toString('hex');
  const existing = await db.query(`SELECT id FROM hospital_staff_invites WHERE network_id=$1 AND invitee_email=$2 AND status='pending' AND expires_at>NOW()`, [networkId, invitee_email]);
  if (existing.rows.length > 0) return res.status(409).json({ success: false, message: 'A pending invite already exists for this email' });
  await db.query(`INSERT INTO hospital_staff_invites (network_id, hospital_id, invited_by, invitee_email, invitee_name, staff_position, invite_token) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [networkId, hospital_id||null, authReq.userId, invitee_email, invitee_name || '', staff_position, token]);

  // Build invite URL
  const frontendUrl = process.env.FRONTEND_URL || (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL.replace('/api/v1', '') : '') || 'http://localhost:5173';
  const inviteUrl = `${frontendUrl}/accept-hospital-invite?token=${token}`;

  // Fetch network + hospital names for email
  const networkResult = await db.query(`SELECT name FROM hospital_networks WHERE id = $1`, [networkId]);
  const networkName = networkResult.rows[0]?.name || 'the network';
  let hospitalName = '';
  if (hospital_id) {
    const hRes = await db.query(`SELECT name FROM vet_hospitals WHERE id = $1`, [hospital_id]);
    hospitalName = hRes.rows[0]?.name || '';
  }

  // Send invite email (non-blocking)
  emailService.send({
    to: invitee_email,
    subject: '',
    template: 'staff_invite',
    data: { inviteeName: invitee_name, networkName, hospitalName, position: staff_position, inviteUrl },
  }).catch((err: any) => logger.error('Staff invite email failed', { error: err.message }));

  // H6: In-app notification if invitee already has an account
  try {
    const inviteeUser = await db.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [invitee_email]);
    if (inviteeUser.rows.length > 0) {
      const NotificationService = (await import('../services/NotificationService')).default;
      await NotificationService.createNotification(
        inviteeUser.rows[0].id, 'system',
        `Invitation to join ${networkName}`,
        `You have been invited to join ${networkName}. Check your network invitations.`,
        'in_app', { networkId, type: 'staff_invite' }
      );
    }
  } catch (notifErr: any) {
    logger.warn('Staff invite in-app notification failed (non-blocking)', { networkId, error: notifErr.message });
  }

  res.status(201).json({ success: true, message: 'Invite created. Email sent if configured.', data: { token, inviteUrl } });
}));

router.get('/hospital-staff-invites/token/:token', asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const result = await db.query(
    `SELECT hsi.*, hn.name AS "networkName", vh.name AS "hospitalName" FROM hospital_staff_invites hsi JOIN hospital_networks hn ON hn.id=hsi.network_id LEFT JOIN vet_hospitals vh ON vh.id=hsi.hospital_id WHERE hsi.invite_token=$1`,
    [req.params.token]
  );
  if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Invite not found' });
  const invite = result.rows[0];
  if (invite.status !== 'pending') return res.status(400).json({ success: false, message: `Invite has been ${invite.status}` });
  if (new Date(invite.expires_at) < new Date()) {
    await db.query(`UPDATE hospital_staff_invites SET status='expired' WHERE invite_token=$1`, [req.params.token]);
    return res.status(400).json({ success: false, message: 'This invite has expired. Ask your administrator to resend.' });
  }
  res.json({ success: true, data: { email: invite.invitee_email, name: invite.invitee_name, position: invite.staff_position, networkName: invite.networkName, hospitalName: invite.hospitalName } });
}));

router.post('/hospital-staff-invites/accept', validateBody(acceptStaffInviteSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const { token, first_name, last_name, phone, password } = req.body;
  const inviteResult = await db.query(`SELECT * FROM hospital_staff_invites WHERE invite_token=$1 AND status='pending' AND expires_at>NOW()`, [token]);
  if (inviteResult.rows.length === 0) return res.status(400).json({ success: false, message: 'Invalid, expired, or already used invite' });
  const invite = inviteResult.rows[0];
  const existing = await db.query(`SELECT id FROM users WHERE email=$1`, [invite.invitee_email]);
  if (existing.rows.length > 0) return res.status(409).json({ success: false, message: 'An account with this email already exists. Please log in.' });

  // CRITICAL: Wrap the entire accept flow in a transaction to prevent seat limit race conditions
  // Without this, two parallel accepts could both pass the seat check but exceed the limit when committed
  try {
    // Direct db usage - transactions need explicit BEGIN/COMMIT
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

    // Re-check seat limit INSIDE the transaction (row-level lock prevents other accepts from executing in parallel)
    const seat = await db.query(`
      SELECT (SELECT COUNT(*) FROM users u
              INNER JOIN hospital_network_members hnm ON u.id = hnm.user_id
              WHERE hnm.network_id = $1 AND hnm.is_active = true
                AND (hnm.valid_until IS NULL OR hnm.valid_until > NOW())) as used_seats,
             hn.seat_limit
      FROM network_subscriptions hn
      WHERE hn.network_id = $1
    `, [invite.network_id]);

    if (seat.rows.length > 0) {
      const { used_seats, seat_limit } = seat.rows[0];
      if (parseInt(used_seats) >= parseInt(seat_limit)) {
        await db.query('ROLLBACK');
        return res.status(403).json({ success: false, message: 'Seat limit reached. Contact your network administrator.', code: 'seat_limit_exceeded' });
      }
    }

    const bcrypt = require('bcryptjs');
    const password_hash = await bcrypt.hash(password, 12);
    // Derive system role from invited staff_position - pharmacist gets dedicated role
    const staffPositionRoleMap: Record<string, string> = { pharmacist: 'pharmacist' };
    const assignedRole = staffPositionRoleMap[invite.staff_position] || 'hospital_staff';
    // network_role must satisfy the DB check constraint - always 'hospital_staff' for position-based invites
    const networkRole = 'hospital_staff';
    const userResult = await db.query(
      `INSERT INTO users (email, first_name, last_name, phone, role, password_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, first_name, last_name, role`,
      [invite.invitee_email, first_name, last_name, phone || '', assignedRole, password_hash]
    );
    const newUser = userResult.rows[0];
    await db.query(`INSERT INTO hospital_network_members (network_id, user_id, network_role, hospital_id, granted_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (network_id, user_id) DO NOTHING`,
      [invite.network_id, newUser.id, networkRole, invite.hospital_id, invite.invited_by]);
    // staff_positions may not have a unique constraint - use INSERT only if not exists
    const existingPos = await db.query(`SELECT id FROM staff_positions WHERE hospital_id=$1 AND user_id=$2`, [invite.hospital_id, newUser.id]);
    if (existingPos.rows.length === 0 && invite.hospital_id) {
      await db.query(`INSERT INTO staff_positions (hospital_id, user_id, position) VALUES ($1,$2,$3)`,
        [invite.hospital_id, newUser.id, invite.staff_position]).catch((err: any) => logger.error('Staff position insert failed', { error: err.message }));
    }
    await db.query(`UPDATE hospital_staff_invites SET status='accepted', accepted_at=NOW(), accepted_user_id=$1 WHERE invite_token=$2`, [newUser.id, token]);

    await db.query('COMMIT');

    // §17.2: record provable policy consent for the invited user (context 'invite')
    try {
      const LegalService = (await import('../services/LegalService')).default;
      await LegalService.recordAcceptances({
        userId: newUser.id,
        userEmail: newUser.email,
        docTypes: ['terms', 'privacy'],
        context: 'invite',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch (consentErr: any) {
      logger.error('Policy acceptance recording failed at invite accept', { userId: newUser.id, error: consentErr.message });
    }

    res.status(201).json({ success: true, message: 'Account created successfully. You can now log in.' });
  } catch (err: any) {
    try { await db.query('ROLLBACK'); } catch (rollbackErr: any) { logger.error('Rollback failed', { error: rollbackErr.message }); }
    logger.error('Accept invite failed', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: err.message || 'Failed to create account' });
  }
}));

// Send a staff invite via email
router.post('/hospital-networks/:id/staff-invites', authMiddleware, roleMiddleware(['admin', 'corporate_admin', 'veterinarian', 'hospital_staff']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  // Verify caller has appropriate network role for the (admin-configurable) inviteStaff action
  const access = await resolveNetworkAccess(req.params.id, authReq.userId, authReq.userRole, 'inviteStaff');
  if (!access.allowed) {
    if (access.reason === 'not_member') return res.status(404).json({ success: false, error: 'Network not found' });
    return res.status(403).json({ success: false, error: 'Only corporate admins and hospital directors can send staff invites' });
  }

  const { inviteeEmail, inviteeName = '', staffPosition, hospitalId, expiresInHours = 72 } = req.body;
  if (!inviteeEmail || !staffPosition) {
    return res.status(400).json({ success: false, error: 'inviteeEmail and staffPosition are required' });
  }

  const builtInPositions = ['nurse','technician','receptionist','lab_tech','radiologist','anesthesiologist','pharmacist','intern','admin_staff'];
  if (!builtInPositions.includes(staffPosition)) {
    // Allow custom roles defined for this network
    const customRoleRes = await db.query(
      `SELECT role_key FROM network_custom_roles WHERE network_id = $1 AND role_key = $2 AND is_active = true`,
      [req.params.id, staffPosition]
    );
    if (customRoleRes.rows.length === 0) {
      return res.status(400).json({ success: false, error: `staffPosition must be one of: ${builtInPositions.join(', ')}, or a custom role defined for this network` });
    }
  }

  // Check if email is already an active member
  const existingUser = await db.query(
    `SELECT u.id FROM users u
     JOIN hospital_network_members hnm ON hnm.user_id = u.id
     WHERE LOWER(u.email) = LOWER($1) AND hnm.network_id = $2 AND hnm.is_active = true
       AND (hnm.valid_until IS NULL OR hnm.valid_until > NOW())`,
    [inviteeEmail, req.params.id]
  );
  if (existingUser.rows.length > 0) {
    return res.status(409).json({ success: false, error: 'This user is already a member of this network' });
  }

  // Check for existing pending invite
  const existingInvite = await db.query(
    `SELECT id FROM hospital_staff_invites WHERE LOWER(invitee_email) = LOWER($1) AND network_id = $2 AND status = 'pending' AND expires_at > NOW()`,
    [inviteeEmail, req.params.id]
  );
  if (existingInvite.rows.length > 0) {
    return res.status(409).json({ success: false, error: 'A pending invite already exists for this email address' });
  }

  const crypto = await import('crypto');
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  const result = await db.query(
    `INSERT INTO hospital_staff_invites (network_id, hospital_id, invited_by, invitee_email, invitee_name, staff_position, invite_token, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, invite_token AS "inviteToken", invitee_email AS "inviteeEmail", invitee_name AS "inviteeName", staff_position AS "staffPosition", expires_at AS "expiresAt"`,
    [req.params.id, hospitalId || null, authReq.userId, inviteeEmail, inviteeName, staffPosition, token, expiresAt]
  );

  const invite = result.rows[0];

  // Send email invitation (non-fatal)
  try {
    const emailService = (await import('../services/EmailService')).default;
    const networkResult = await db.query(`SELECT name FROM hospital_networks WHERE id = $1`, [req.params.id]);
    const networkName = networkResult.rows[0]?.name ?? 'the hospital network';
    const inviteUrl = `${process.env.FRONTEND_URL || 'https://vetcare.app'}/accept-staff-invite?token=${token}`;
    await emailService.send({
      to: inviteeEmail,
      subject: `You've been invited to join ${networkName} as ${staffPosition}`,
      text: `Hi ${inviteeName},\n\nYou have been invited to join ${networkName} as a ${staffPosition}.\n\nAccept your invitation here: ${inviteUrl}\n\nThis invitation expires in ${expiresInHours} hours.\n\nIf you did not expect this invitation, you can safely ignore this email.`,
      html: `<p>Hi <strong>${inviteeName}</strong>,</p><p>You have been invited to join <strong>${networkName}</strong> as a <strong>${staffPosition}</strong>.</p><p><a href="${inviteUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Accept Invitation</a></p><p>This invitation expires in ${expiresInHours} hours.</p><p>If you did not expect this invitation, you can safely ignore this email.</p>`,
    }).catch((err: any) => logger.warn('Staff invite email failed to send', { error: err.message }));
  } catch (emailErr: any) {
    logger.warn('Staff invite email setup failed', { error: emailErr.message });
  }

  // H6: In-app notification if invitee already has an account
  try {
    const inviteeUser = await db.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [inviteeEmail]);
    if (inviteeUser.rows.length > 0) {
      const NotificationService = (await import('../services/NotificationService')).default;
      const networkRes = await db.query(`SELECT name FROM hospital_networks WHERE id = $1`, [req.params.id]);
      const netName = networkRes.rows[0]?.name ?? 'a hospital network';
      await NotificationService.createNotification(
        inviteeUser.rows[0].id, 'system',
        `Invitation to join ${netName}`,
        `You have been invited to join ${netName} as ${staffPosition}. Check your network invitations.`,
        'in_app', { networkId: req.params.id, type: 'staff_invite' }
      );
    }
  } catch (notifErr: any) {
    logger.warn('Staff invite in-app notification failed (non-blocking)', { networkId: req.params.id, error: notifErr.message });
  }

  res.status(201).json({ success: true, data: invite, message: 'Invitation sent successfully' });
}));

router.get('/hospital-networks/:id/staff-invites', authMiddleware, roleMiddleware(['admin', 'corporate_admin', 'veterinarian', 'hospital_staff']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  // Secondary check: verify caller has appropriate network role for the (admin-configurable) inviteStaff action
  const access = await resolveNetworkAccess(req.params.id, authReq.userId, authReq.userRole, 'inviteStaff');
  if (!access.allowed) {
    if (access.reason === 'not_member') return res.status(404).json({ success: false, message: 'Network not found' });
    return res.status(403).json({ success: false, message: 'Only corporate admins and hospital directors can view invites' });
  }
  const result = await db.query(
    `SELECT hsi.*, u.first_name AS "inviterFirstName", u.last_name AS "inviterLastName", vh.name AS "hospitalName"
     FROM hospital_staff_invites hsi
     JOIN users u ON u.id = hsi.invited_by
     LEFT JOIN vet_hospitals vh ON vh.id = hsi.hospital_id
     WHERE hsi.network_id = $1
       AND hsi.status = 'pending'
       AND hsi.expires_at > NOW()
     ORDER BY hsi.created_at DESC`,
    [req.params.id]
  );
  res.json({ success: true, data: result.rows });
}));

router.delete('/hospital-networks/:id/staff-invites/:inviteId', authMiddleware, roleMiddleware(['admin', 'corporate_admin', 'veterinarian', 'hospital_staff']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  // Secondary check: verify caller has appropriate network role for the (admin-configurable) inviteStaff action
  const access = await resolveNetworkAccess(req.params.id, authReq.userId, authReq.userRole, 'inviteStaff');
  if (!access.allowed) {
    if (access.reason === 'not_member') return res.status(404).json({ success: false, message: 'Network not found' });
    return res.status(403).json({ success: false, message: 'Only corporate admins and hospital directors can manage invites' });
  }
  await db.query(`UPDATE hospital_staff_invites SET status='revoked', updated_at=NOW() WHERE id=$1 AND network_id=$2 AND status='pending'`, [req.params.inviteId, req.params.id]);
  res.json({ success: true });
}));

// G10 - Export audit logs as CSV
router.get('/hospital-networks/:id/audit-logs/export', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = req.params.id;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;

  // Was previously "any member" - hospital_staff has viewAuditLogs=false in the matrix
  // and should not be able to pull the raw clinical-access audit log via this endpoint.
  const access = await resolveNetworkAccess(networkId, userId, userRole, 'viewAuditLogs');
  if (!access.allowed) {
    if (access.reason === 'not_member') return res.status(404).json({ success: false, error: 'Network not found' });
    return res.status(403).json({ success: false, error: 'Insufficient role to view audit logs' });
  }

  const result = await database.query(
    `SELECT cal.id, cal.accessed_by,
            COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') as accessor_name,
            cal.animal_id, COALESCE(a.name, 'Unknown') as animal_name,
            cal.record_type, cal.access_type, cal.access_granted,
            cal.denial_reason, cal.ip_address, cal.accessed_at
     FROM clinical_data_access_log cal
     LEFT JOIN users u ON u.id = cal.accessed_by
     LEFT JOIN animals a ON a.id = cal.animal_id
     WHERE cal.accessor_network_id = $1
     ORDER BY cal.accessed_at DESC
     LIMIT 5000`,
    [networkId]
  );

  const headers = 'ID,Accessor,Animal,Record Type,Access Type,Granted,Denial Reason,IP Address,Timestamp\n';
  const rows = result.rows.map((r: any) =>
    `"${r.id}","${r.accessor_name}","${r.animal_name}","${r.record_type || ''}","${r.access_type || ''}","${r.access_granted}","${(r.denial_reason || '').replace(/"/g, '""')}","${r.ip_address || ''}","${r.accessed_at}"`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=audit-log-${networkId.slice(0,8)}-${new Date().toISOString().slice(0,10)}.csv`);
  res.send(headers + rows);
}));


export default router;
