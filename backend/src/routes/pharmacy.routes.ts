import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/errorHandler';
import database from '../utils/database';
import logger from '../utils/logger';

const router = Router();

// ============================================================
// PHARMACY MODULE ROUTES
// ============================================================

// ── Access Guards ────────────────────────────────────────────
// Returns networkId or sends 403/404 and returns null. All pharmacy routes MUST call this first.
async function guardPharmacy(req: Request, res: Response, pharmacyId: string): Promise<string | null> {
  const authReq = req as any;
  if (!pharmacyId) { res.status(400).json({ success: false, message: 'pharmacyId is required' }); return null; }
  const p = await database.query('SELECT network_id, is_active FROM hospital_pharmacies WHERE id=$1', [pharmacyId]);
  if (!p.rows[0]) { res.status(404).json({ success: false, message: 'Pharmacy not found' }); return null; }
  if (authReq.userRole === 'admin') return p.rows[0].network_id;
  const m = await database.query(
    'SELECT 1 FROM hospital_network_members WHERE network_id=$1 AND user_id=$2 AND is_active=true',
    [p.rows[0].network_id, authReq.userId]
  );
  if (!m.rows[0]) { res.status(403).json({ success: false, message: 'You are not a member of this pharmacy\'s network' }); return null; }
  return p.rows[0].network_id;
}

// Network-level pharmacy guard (for /networks/:networkId/suppliers, /medications etc.)
async function guardNetworkPharmacy(req: Request, res: Response, networkId: string): Promise<boolean> {
  const authReq = req as any;
  if (authReq.userRole === 'admin') return true;
  const m = await database.query(
    'SELECT 1 FROM hospital_network_members WHERE network_id=$1 AND user_id=$2 AND is_active=true',
    [networkId, authReq.userId]
  );
  if (!m.rows[0]) { res.status(403).json({ success: false, message: 'You are not a member of this network' }); return false; }
  return true;
}

// Auto-discover pharmacies for the current user based on network membership
router.get('/pharmacy/my-pharmacies', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const userId = authReq.userId;

  // An empty list has two completely different causes and the screen used to show the same
  // dead end for both: "Select a pharmacy", with nothing to select and no explanation. `reason`
  // lets the UI say which precondition actually failed and what to do about it.
  // See docs/DESIGN_SYSTEM.md section 5a.

  // A platform admin is not a network member but must still be able to see and set pharmacies up.
  if (authReq.userRole === 'admin') {
    const all = await database.query(
      `SELECT hp.*, vh.name AS hospital_name FROM hospital_pharmacies hp
       LEFT JOIN vet_hospitals vh ON hp.hospital_id = vh.id
       ORDER BY hp.is_primary_pharmacy DESC, hp.pharmacy_name ASC`
    );
    return res.json({
      success: true, data: all.rows, networkId: null,
      reason: all.rows.length ? 'ok' : 'no_pharmacy_in_network', canCreate: true,
    });
  }

  const memberRes = await database.query(
    `SELECT hnm.network_id, hnm.network_role
       FROM hospital_network_members hnm
      WHERE hnm.user_id = $1 AND hnm.is_active = true
        AND (hnm.valid_until IS NULL OR hnm.valid_until > NOW())`,
    [userId]
  );
  if (memberRes.rows.length === 0) {
    // The pharmacist exists but nobody has added them to a network, so there is no pharmacy
    // they could possibly reach. Previously indistinguishable from "network has no pharmacy".
    return res.json({
      success: true, data: [], networkId: null,
      reason: 'not_in_network', canCreate: false,
    });
  }

  const networkId = memberRes.rows[0].network_id;
  // Only these roles may stand a new pharmacy up; the UI uses this to decide whether to offer
  // the action or tell the user who to ask.
  const canCreate = ['corporate_admin', 'hospital_director'].includes(memberRes.rows[0].network_role);

  const pharmaRes = await database.query(
    `SELECT hp.*, vh.name AS hospital_name FROM hospital_pharmacies hp
     LEFT JOIN vet_hospitals vh ON hp.hospital_id = vh.id
     WHERE hp.network_id = $1
     ORDER BY hp.is_primary_pharmacy DESC, hp.pharmacy_name ASC`,
    [networkId]
  );
  res.json({
    success: true, data: pharmaRes.rows, networkId,
    reason: pharmaRes.rows.length ? 'ok' : 'no_pharmacy_in_network',
    canCreate,
  });
}));

// ── Pharmacy Setup ──────────────────────────────────────────

// List pharmacies for a network
router.get('/networks/:networkId/pharmacies', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const { networkId } = req.params;
  if (!await guardNetworkPharmacy(req, res, networkId)) return;
  const result = await database.query(
    `SELECT hp.*, vh.name AS hospital_name, u.first_name || ' ' || u.last_name AS created_by_name
     FROM hospital_pharmacies hp
     LEFT JOIN vet_hospitals vh ON hp.hospital_id = vh.id
     LEFT JOIN users u ON hp.created_by = u.id
     WHERE hp.network_id = $1
     ORDER BY hp.is_primary_pharmacy DESC, hp.pharmacy_name ASC`,
    [networkId]
  );
  res.json(result.rows);
}));

// Create pharmacy
router.post('/networks/:networkId/pharmacies', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const { networkId } = req.params;
  if (!await guardNetworkPharmacy(req, res, networkId)) return;
  const { pharmacy_name, hospital_id, address, phone, email, license_number, operating_hours, is_primary_pharmacy } = req.body;
  if (!pharmacy_name) return res.status(400).json({ error: 'pharmacy_name is required' });
  // If setting as primary, unset others
  if (is_primary_pharmacy) {
    await database.query(`UPDATE hospital_pharmacies SET is_primary_pharmacy = false WHERE network_id = $1`, [networkId]);
  }
  const result = await database.query(
    `INSERT INTO hospital_pharmacies (network_id, hospital_id, pharmacy_name, address, phone, email, license_number, operating_hours, is_primary_pharmacy, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [networkId, hospital_id || null, pharmacy_name, address || null, phone || null, email || null, license_number || null, operating_hours ? JSON.stringify(operating_hours) : '{}', is_primary_pharmacy || false, authReq.userId]
  );
  res.status(201).json(result.rows[0]);
}));

// Get / Update pharmacy
router.get('/pharmacies/:pharmacyId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const result = await database.query(
    `SELECT hp.*, vh.name AS hospital_name FROM hospital_pharmacies hp
     LEFT JOIN vet_hospitals vh ON hp.hospital_id = vh.id
     WHERE hp.id = $1`,
    [req.params.pharmacyId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Pharmacy not found' });
  res.json(result.rows[0]);
}));

router.patch('/pharmacies/:pharmacyId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const authReq = req as any;
  const { pharmacy_name, address, phone, email, license_number, operating_hours, is_primary_pharmacy, is_accepting_requests, is_active } = req.body;
  const existing = await database.query(`SELECT * FROM hospital_pharmacies WHERE id = $1`, [req.params.pharmacyId]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Pharmacy not found' });
  if (is_primary_pharmacy) {
    await database.query(`UPDATE hospital_pharmacies SET is_primary_pharmacy = false WHERE network_id = $1`, [existing.rows[0].network_id]);
  }
  const result = await database.query(
    `UPDATE hospital_pharmacies SET
       pharmacy_name = COALESCE($1, pharmacy_name),
       address = COALESCE($2, address),
       phone = COALESCE($3, phone),
       email = COALESCE($4, email),
       license_number = COALESCE($5, license_number),
       operating_hours = COALESCE($6::jsonb, operating_hours),
       is_primary_pharmacy = COALESCE($7, is_primary_pharmacy),
       is_accepting_requests = COALESCE($8, is_accepting_requests),
       is_active = COALESCE($9, is_active),
       updated_at = NOW()
     WHERE id = $10 RETURNING *`,
    [pharmacy_name, address, phone, email, license_number, operating_hours ? JSON.stringify(operating_hours) : null, is_primary_pharmacy, is_accepting_requests, is_active, req.params.pharmacyId]
  );
  res.json(result.rows[0]);
}));

// ── Suppliers ──────────────────────────────────────────────

router.get('/networks/:networkId/suppliers', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const result = await database.query(
    `SELECT ps.*, (SELECT COUNT(*) FROM pharmacy_medications WHERE supplier_id = ps.id) AS medication_count
     FROM pharmacy_suppliers ps
     WHERE ps.network_id = $1 ORDER BY ps.name ASC`,
    [req.params.networkId]
  );
  res.json(result.rows);
}));

router.post('/networks/:networkId/suppliers', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const authReq = req as any;
  const { name, contact_name, email, phone, address, payment_terms, lead_time_days, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = await database.query(
    `INSERT INTO pharmacy_suppliers (network_id, name, contact_name, email, phone, address, payment_terms, lead_time_days, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [req.params.networkId, name, contact_name || null, email || null, phone || null, address || null, payment_terms || null, lead_time_days || 7, notes || null, authReq.userId]
  );
  res.status(201).json(result.rows[0]);
}));

router.patch('/networks/:networkId/suppliers/:supplierId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const { name, contact_name, email, phone, address, payment_terms, lead_time_days, notes, is_approved, is_active } = req.body;
  const result = await database.query(
    `UPDATE pharmacy_suppliers SET
       name = COALESCE($1, name), contact_name = COALESCE($2, contact_name),
       email = COALESCE($3, email), phone = COALESCE($4, phone),
       address = COALESCE($5, address), payment_terms = COALESCE($6, payment_terms),
       lead_time_days = COALESCE($7, lead_time_days), notes = COALESCE($8, notes),
       is_approved = COALESCE($9, is_approved), is_active = COALESCE($10, is_active),
       updated_at = NOW()
     WHERE id = $11 AND network_id = $12 RETURNING *`,
    [name, contact_name, email, phone, address, payment_terms, lead_time_days, notes, is_approved, is_active, req.params.supplierId, req.params.networkId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Supplier not found' });
  res.json(result.rows[0]);
}));

// ── Medications ─────────────────────────────────────────────

router.get('/networks/:networkId/medications', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const result = await database.query(
    `SELECT pm.*, ps.name AS supplier_name FROM pharmacy_medications pm
     LEFT JOIN pharmacy_suppliers ps ON pm.supplier_id = ps.id
     WHERE pm.network_id = $1
     ORDER BY pm.name ASC`,
    [req.params.networkId]
  );
  res.json(result.rows);
}));

router.post('/networks/:networkId/medications', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const authReq = req as any;
  const { name, generic_name, form, strength, unit, supplier_id, unit_cost, selling_price, min_stock_level, max_stock_level, reorder_point, reorder_quantity, manufacturer, registration_number, is_controlled, contraindications, side_effects, common_interactions } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = await database.query(
    `INSERT INTO pharmacy_medications (network_id, name, generic_name, form, strength, unit, supplier_id, unit_cost, selling_price, min_stock_level, max_stock_level, reorder_point, reorder_quantity, manufacturer, registration_number, is_controlled, contraindications, side_effects, common_interactions, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
    [req.params.networkId, name, generic_name || null, form || 'tablet', strength || null, unit || 'unit', supplier_id || null, unit_cost || 0, selling_price || 0, min_stock_level || 10, max_stock_level || 500, reorder_point || 20, reorder_quantity || 100, manufacturer || null, registration_number || null, is_controlled || false, contraindications || [], side_effects || [], common_interactions || [], authReq.userId]
  );
  res.status(201).json(result.rows[0]);
}));

router.patch('/networks/:networkId/medications/:medId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const { name, generic_name, form, strength, unit, supplier_id, unit_cost, selling_price, min_stock_level, max_stock_level, reorder_point, reorder_quantity, manufacturer, registration_number, is_controlled, is_active } = req.body;
  const result = await database.query(
    `UPDATE pharmacy_medications SET
       name = COALESCE($1, name), generic_name = COALESCE($2, generic_name),
       form = COALESCE($3, form), strength = COALESCE($4, strength),
       unit = COALESCE($5, unit), supplier_id = COALESCE($6, supplier_id),
       unit_cost = COALESCE($7, unit_cost), selling_price = COALESCE($8, selling_price),
       min_stock_level = COALESCE($9, min_stock_level), max_stock_level = COALESCE($10, max_stock_level),
       reorder_point = COALESCE($11, reorder_point), reorder_quantity = COALESCE($12, reorder_quantity),
       manufacturer = COALESCE($13, manufacturer), registration_number = COALESCE($14, registration_number),
       is_controlled = COALESCE($15, is_controlled), is_active = COALESCE($16, is_active),
       updated_at = NOW()
     WHERE id = $17 AND network_id = $18 RETURNING *`,
    [name, generic_name, form, strength, unit, supplier_id, unit_cost, selling_price, min_stock_level, max_stock_level, reorder_point, reorder_quantity, manufacturer, registration_number, is_controlled, is_active, req.params.medId, req.params.networkId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Medication not found' });
  res.json(result.rows[0]);
}));

// ── Inventory ───────────────────────────────────────────────

router.get('/pharmacies/:pharmacyId/inventory', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const result = await database.query(
    `SELECT pi.*, pm.name AS med_name, pm.generic_name, pm.form, pm.strength, pm.unit AS med_unit,
            pm.reorder_point, pm.min_stock_level,
            (pi.expiry_date - CURRENT_DATE) AS days_until_expiry
     FROM pharmacy_inventory pi
     JOIN pharmacy_medications pm ON pi.med_id = pm.id
     WHERE pi.pharmacy_id = $1 AND pi.is_active = true
     ORDER BY pi.expiry_date ASC NULLS LAST`,
    [req.params.pharmacyId]
  );
  res.json(result.rows);
}));

router.post('/pharmacies/:pharmacyId/inventory', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const authReq = req as any;
  const { med_id, batch_number, quantity, unit, expiry_date, received_from, location_code, shipment_request_id } = req.body;
  if (!med_id || !quantity) return res.status(400).json({ error: 'med_id and quantity are required' });
  const result = await database.query(
    `INSERT INTO pharmacy_inventory (pharmacy_id, med_id, batch_number, quantity, unit, expiry_date, received_from, received_by, location_code, shipment_request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.params.pharmacyId, med_id, batch_number || null, quantity, unit || 'unit', expiry_date || null, received_from || null, authReq.userId, location_code || null, shipment_request_id || null]
  );
  // Log adjustment
  await database.query(
    `INSERT INTO pharmacy_stock_adjustments (pharmacy_id, med_id, inventory_id, batch_number, adjustment_qty, adjustment_type, reason, adjusted_by)
     VALUES ($1,$2,$3,$4,$5,'add','Batch received',$6)`,
    [req.params.pharmacyId, med_id, result.rows[0].id, batch_number || null, quantity, authReq.userId]
  ).catch(() => {});
  res.status(201).json(result.rows[0]);
}));

// Expiry alerts
router.get('/pharmacies/:pharmacyId/expiry-alerts', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const result = await database.query(
    `SELECT pi.*, pm.name AS med_name, pm.form, pm.strength,
            (pi.expiry_date - CURRENT_DATE) AS days_until_expiry
     FROM pharmacy_inventory pi
     JOIN pharmacy_medications pm ON pi.med_id = pm.id
     WHERE pi.pharmacy_id = $1 AND pi.is_active = true
       AND pi.expiry_date IS NOT NULL AND pi.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
     ORDER BY pi.expiry_date ASC`,
    [req.params.pharmacyId]
  );
  res.json(result.rows);
}));

// Low stock alerts
router.get('/pharmacies/:pharmacyId/low-stock-alerts', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const result = await database.query(
    `SELECT pm.id AS med_id, pm.name AS med_name, pm.form, pm.strength, pm.reorder_point, pm.min_stock_level,
            COALESCE(SUM(pi.quantity), 0) AS current_stock
     FROM pharmacy_medications pm
     LEFT JOIN pharmacy_inventory pi ON pi.med_id = pm.id AND pi.pharmacy_id = $1 AND pi.is_active = true
     WHERE pm.network_id = (SELECT network_id FROM hospital_pharmacies WHERE id = $1)
       AND pm.is_active = true
     GROUP BY pm.id
     HAVING COALESCE(SUM(pi.quantity), 0) <= pm.reorder_point
     ORDER BY current_stock ASC`,
    [req.params.pharmacyId]
  );
  res.json(result.rows);
}));

// Stock adjustments
router.post('/pharmacies/:pharmacyId/stock-adjustments', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const authReq = req as any;
  const { med_id, inventory_id, batch_number, adjustment_qty, adjustment_type, reason, evidence_url } = req.body;
  if (!med_id || !adjustment_qty || !adjustment_type) return res.status(400).json({ error: 'med_id, adjustment_qty, adjustment_type are required' });
  await database.query(
    `INSERT INTO pharmacy_stock_adjustments (pharmacy_id, med_id, inventory_id, batch_number, adjustment_qty, adjustment_type, reason, evidence_url, adjusted_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [req.params.pharmacyId, med_id, inventory_id || null, batch_number || null, adjustment_qty, adjustment_type, reason || null, evidence_url || null, authReq.userId]
  );
  // Update inventory quantity if inventory_id provided
  if (inventory_id) {
    const sign = ['add','return'].includes(adjustment_type) ? '+' : '-';
    await database.query(
      `UPDATE pharmacy_inventory SET quantity = quantity ${sign} $1, updated_at = NOW() WHERE id = $2`,
      [Math.abs(adjustment_qty), inventory_id]
    );
  }
  res.status(201).json({ success: true });
}));

router.get('/pharmacies/:pharmacyId/stock-adjustments', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const result = await database.query(
    `SELECT psa.*, pm.name AS med_name, u.first_name || ' ' || u.last_name AS adjusted_by_name
     FROM pharmacy_stock_adjustments psa
     JOIN pharmacy_medications pm ON psa.med_id = pm.id
     LEFT JOIN users u ON psa.adjusted_by = u.id
     WHERE psa.pharmacy_id = $1
     ORDER BY psa.adjusted_at DESC LIMIT 200`,
    [req.params.pharmacyId]
  );
  res.json(result.rows);
}));

// ── Reorder Requests ─────────────────────────────────────────

router.get('/pharmacies/:pharmacyId/reorders', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const result = await database.query(
    `SELECT pr.*, pm.name AS med_name, pm.form, pm.strength, ps.name AS supplier_name,
            u.first_name || ' ' || u.last_name AS requested_by_name
     FROM pharmacy_reorder_requests pr
     JOIN pharmacy_medications pm ON pr.med_id = pm.id
     LEFT JOIN pharmacy_suppliers ps ON pr.supplier_id = ps.id
     LEFT JOIN users u ON pr.requested_by = u.id
     WHERE pr.pharmacy_id = $1
     ORDER BY pr.created_at DESC`,
    [req.params.pharmacyId]
  );
  res.json(result.rows);
}));

router.post('/pharmacies/:pharmacyId/reorders', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const authReq = req as any;
  const { med_id, supplier_id, requested_qty, notes, triggered_by } = req.body;
  if (!med_id || !requested_qty) return res.status(400).json({ error: 'med_id and requested_qty are required' });
  const result = await database.query(
    `INSERT INTO pharmacy_reorder_requests (pharmacy_id, med_id, supplier_id, requested_qty, requested_by, triggered_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.params.pharmacyId, med_id, supplier_id || null, requested_qty, authReq.userId, triggered_by || 'manual', notes || null]
  );
  res.status(201).json(result.rows[0]);
}));

router.patch('/pharmacies/:pharmacyId/reorders/:reorderId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const authReq = req as any;
  const { status, tracking_number, expected_delivery_date, notes } = req.body;
  const now = new Date().toISOString();

  // Build SET clause with correctly indexed parameters - never hardcode index offsets
  const setParts: string[] = [];
  const params: any[] = [];

  if (status !== undefined)                { setParts.push(`status = $${params.push(status)}`); }
  if (tracking_number !== undefined)       { setParts.push(`tracking_number = $${params.push(tracking_number || null)}`); }
  if (expected_delivery_date !== undefined){ setParts.push(`expected_delivery_date = $${params.push(expected_delivery_date || null)}`); }
  if (notes !== undefined)                 { setParts.push(`notes = $${params.push(notes || null)}`); }

  // Status-specific timestamp columns - use correct column names from pharmacy_reorder_requests schema
  if (status === 'received')  { setParts.push(`received_at = $${params.push(now)}`); }
  if (status === 'shipped')   { setParts.push(`shipped_at = $${params.push(now)}`); }
  if (status === 'confirmed') { setParts.push(`confirmed_at = $${params.push(now)}`); }

  setParts.push('updated_at = NOW()');

  // WHERE clause params added last
  const reorderIdx = params.push(req.params.reorderId);
  const pharmacyIdx = params.push(req.params.pharmacyId);

  const result = await database.query(
    `UPDATE pharmacy_reorder_requests SET ${setParts.join(', ')}
     WHERE id = $${reorderIdx} AND pharmacy_id = $${pharmacyIdx} RETURNING *`,
    params
  );
  if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Reorder request not found' });

  // When marked received: log a stock audit event (non-fatal)
  if (status === 'received') {
    const r = result.rows[0];
    database.query(
      `INSERT INTO pharmacy_stock_adjustments (pharmacy_id, med_id, adjustment_qty, adjustment_type, reason, adjusted_by)
       VALUES ($1, $2, $3, 'add', 'Reorder received - add stock via Inventory tab', $4)`,
      [req.params.pharmacyId, r.med_id, r.requested_qty, authReq.userId]
    ).catch(() => {});
  }

  res.json({ success: true, data: result.rows[0] });
}));

// ── Prescription Review ──────────────────────────────────────

// Pending prescriptions queue for a pharmacy
router.get('/pharmacies/:pharmacyId/pending-prescriptions', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = await guardPharmacy(req, res, req.params.pharmacyId);
  if (!networkId) return;
  const result = await database.query(
    `SELECT p.id, p.created_at, p.valid_until, p.instructions, p.medications, p.review_status,
            p.animal_id, p.veterinarian_id, p.pet_owner_id, p.consultation_id,
            a.name AS pet_name, a.species AS animal_species, a.breed AS animal_breed,
            u.first_name || ' ' || u.last_name AS vet_name,
            po.first_name || ' ' || po.last_name AS owner_name,
            (SELECT STRING_AGG(med->>'name', ', ')
             FROM jsonb_array_elements(COALESCE(p.medications, '[]'::jsonb)) AS med
            ) AS medication_names
     FROM prescriptions p
     JOIN animals a ON p.animal_id = a.id
     JOIN users u ON p.veterinarian_id = u.id
     LEFT JOIN users po ON p.pet_owner_id = po.id
     WHERE p.network_id = $1
       AND (p.review_status = 'pending_review' OR p.review_status IS NULL)
       AND p.is_active = true
     ORDER BY p.created_at ASC`,
    [networkId]
  );
  res.json(result.rows);
}));

// Submit prescription review - pharmacist or admin only, scoped to their network
router.post('/prescriptions/:prescriptionId/review', authMiddleware, roleMiddleware(['pharmacist', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  // Verify prescription exists and belongs to the pharmacist's network
  const rxRow = await database.query(
    `SELECT id, network_id FROM prescriptions WHERE id = $1 AND is_active = true`,
    [req.params.prescriptionId]
  );
  if (!rxRow.rows[0]) return res.status(404).json({ success: false, message: 'Prescription not found' });
  if (authReq.userRole !== 'admin') {
    if (!await guardNetworkPharmacy(req, res, rxRow.rows[0].network_id)) return;
  }
  // Accept both field naming conventions (frontend sends review_notes; canonical is rejection_reason/findings)
  const review_status = req.body.review_status;
  const validation_checks = req.body.validation_checks || {};
  const rejection_reason = req.body.rejection_reason || req.body.review_notes || null;
  const findings = req.body.findings || null;
  const suggested_modifications = req.body.suggested_modifications || null;
  if (!review_status) return res.status(400).json({ success: false, message: 'review_status is required' });
  const validStatuses = ['approved', 'rejected', 'needs_clarification'];
  if (!validStatuses.includes(review_status)) return res.status(400).json({ success: false, message: 'Invalid review_status' });
  // Insert review record
  // findings is TEXT[] - the frontend sends one free-text string, so wrap it as a
  // single-element array; binding a bare JS string to an array column throws
  // "malformed array literal" in Postgres.
  await database.query(
    `INSERT INTO prescription_reviews (prescription_id, pharmacist_id, review_status, validation_checks, findings, suggested_modifications, rejection_reason)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)`,
    [req.params.prescriptionId, authReq.userId, review_status, JSON.stringify(validation_checks), findings ? [findings] : null, suggested_modifications, rejection_reason]
  );
  // Map to prescription review_status
  const prescriptionStatus = review_status === 'approved' ? 'approved_for_dispensing' : review_status === 'rejected' ? 'rejected' : 'needs_clarification';
  await database.query(
    `UPDATE prescriptions SET review_status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3, updated_at = NOW() WHERE id = $4`,
    [prescriptionStatus, authReq.userId, rejection_reason || suggested_modifications || null, req.params.prescriptionId]
  );
  // Notify vet on rejection or clarification request
  if (review_status === 'rejected' || review_status === 'needs_clarification') {
    try {
      const rxRow = await database.query(
        `SELECT p.veterinarian_id, a.name AS animal_name FROM prescriptions p LEFT JOIN animals a ON a.id=p.animal_id WHERE p.id=$1`,
        [req.params.prescriptionId]
      );
      if (rxRow.rows[0]) {
        const msg = review_status === 'rejected'
          ? `Your prescription for ${rxRow.rows[0].animal_name || 'your patient'} was rejected by the pharmacist.${rejection_reason ? ' Reason: ' + rejection_reason : ''}`
          : `Pharmacist needs clarification on your prescription for ${rxRow.rows[0].animal_name || 'your patient'}.${suggested_modifications ? ' Note: ' + suggested_modifications : ''}`;
        const NSvc = (await import('../services/NotificationService')).default;
        await NSvc.createNotification(rxRow.rows[0].veterinarian_id, 'prescription',
          review_status === 'rejected' ? 'Prescription Rejected' : 'Prescription - Clarification Needed',
          msg, 'all', { prescriptionId: req.params.prescriptionId });
      }
    } catch { /* non-fatal */ }
  }
  res.json({ success: true, review_status: prescriptionStatus });
}));

// Get review history for a prescription
router.get('/prescriptions/:prescriptionId/reviews', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const rxRow = await database.query(
    `SELECT veterinarian_id, pet_owner_id, network_id FROM prescriptions WHERE id = $1`,
    [req.params.prescriptionId]
  );
  if (!rxRow.rows[0]) return res.status(404).json({ success: false, message: 'Prescription not found' });
  const { veterinarian_id, pet_owner_id, network_id } = rxRow.rows[0];
  const isOwner = authReq.userId === veterinarian_id || authReq.userId === pet_owner_id;
  if (authReq.userRole !== 'admin' && !isOwner) {
    if (!network_id) return res.status(403).json({ success: false, message: 'You do not have access to this prescription' });
    if (!await guardNetworkPharmacy(req, res, network_id)) return;
  }
  const result = await database.query(
    `SELECT pr.*, u.first_name || ' ' || u.last_name AS pharmacist_name
     FROM prescription_reviews pr
     JOIN users u ON pr.pharmacist_id = u.id
     WHERE pr.prescription_id = $1
     ORDER BY pr.reviewed_at DESC`,
    [req.params.prescriptionId]
  );
  res.json(result.rows);
}));

// ── Dispensing ──────────────────────────────────────────────

// Ready-for-dispensing queue
router.get('/pharmacies/:pharmacyId/ready-for-dispensing', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = await guardPharmacy(req, res, req.params.pharmacyId);
  if (!networkId) return;
  const result = await database.query(
    `SELECT p.id, p.created_at, p.valid_until, p.instructions, p.medications, p.review_status,
            p.animal_id, p.veterinarian_id, p.pet_owner_id, p.consultation_id,
            a.name AS pet_name, a.species AS animal_species, a.breed AS animal_breed,
            u.first_name || ' ' || u.last_name AS vet_name,
            po.first_name || ' ' || po.last_name AS owner_name,
            dr.id AS dispensing_record_id, dr.dispensing_status,
            (SELECT STRING_AGG(med->>'name', ', ')
             FROM jsonb_array_elements(COALESCE(p.medications, '[]'::jsonb)) AS med
            ) AS medication_names
     FROM prescriptions p
     JOIN animals a ON p.animal_id = a.id
     JOIN users u ON p.veterinarian_id = u.id
     LEFT JOIN users po ON p.pet_owner_id = po.id
     LEFT JOIN dispensing_records dr ON dr.prescription_id = p.id AND dr.pharmacy_id = $1
     WHERE p.network_id = $2
       AND p.review_status = 'approved_for_dispensing'
       AND (dr.id IS NULL OR dr.dispensing_status NOT IN ('handed_over','delivered'))
       AND p.is_active = true
     ORDER BY p.created_at ASC`,
    [req.params.pharmacyId, networkId]
  );
  res.json(result.rows);
}));

// Create dispensing record
router.post('/dispensing', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.body.pharmacy_id)) return;
  const authReq = req as any;
  const { prescription_id, pharmacy_id, dispensing_method, line_items, received_by, notes } = req.body;
  if (!prescription_id || !pharmacy_id) return res.status(400).json({ success: false, message: 'prescription_id and pharmacy_id are required' });
  // Calculate total cost
  const total_cost = (line_items || []).reduce((sum: number, item: any) => sum + (item.line_total || 0), 0);
  const record = await database.query(
    `INSERT INTO dispensing_records (prescription_id, pharmacy_id, pharmacist_id, dispensing_method, total_cost, received_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [prescription_id, pharmacy_id, authReq.userId, dispensing_method || 'walk_in_pickup', total_cost, received_by || null, notes || null]
  );
  const recordId = record.rows[0].id;
  // Insert line items
  for (const item of (line_items || [])) {
    await database.query(
      `INSERT INTO dispensing_line_items (dispensing_record_id, med_id, inventory_id, batch_number, quantity_dispensed, unit, unit_price, line_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [recordId, item.med_id, item.inventory_id || null, item.batch_number || null, item.quantity_dispensed, item.unit || 'unit', item.unit_price || 0, item.line_total || 0]
    );
    // Decrement inventory
    if (item.inventory_id) {
      await database.query(`UPDATE pharmacy_inventory SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2`, [item.quantity_dispensed, item.inventory_id]).catch(() => {});
      await database.query(
        `INSERT INTO pharmacy_stock_adjustments (pharmacy_id, med_id, inventory_id, batch_number, adjustment_qty, adjustment_type, reason, adjusted_by)
         VALUES ($1,$2,$3,$4,$5,'dispense','Prescription dispensed',$6)`,
        [pharmacy_id, item.med_id, item.inventory_id, item.batch_number || null, item.quantity_dispensed, authReq.userId]
      ).catch(() => {});
    }
  }
  // Update prescription to dispensed
  await database.query(`UPDATE prescriptions SET review_status = 'dispensed', updated_at = NOW() WHERE id = $1`, [prescription_id]);
  // Create pharmacy payment record (pending - patient pays at counter or later)
  if (total_cost > 0) {
    try {
      const rxForBilling = await database.query(
        `SELECT pet_owner_id, consultation_id FROM prescriptions WHERE id=$1`, [prescription_id]
      );
      if (rxForBilling.rows[0]) {
        const invoiceNum = `PHARM-${recordId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
        const payStatus = (dispensing_method === 'walk_in_pickup' || dispensing_method === 'hospital_pickup') ? 'completed' : 'pending';
        const payRow = await database.query(
          `INSERT INTO payments (consultation_id, dispensing_id, user_id, payer_id, amount, currency, status, payment_method, payment_source, invoice_number, paid_at, created_at, updated_at)
           VALUES ($1,$2,$3,$3,$4,'INR',$5,'cash','pharmacy',$6,
             CASE WHEN $5='completed' THEN NOW() ELSE NULL END, NOW(), NOW())
           RETURNING id`,
          [rxForBilling.rows[0].consultation_id || null, recordId, rxForBilling.rows[0].pet_owner_id, total_cost, payStatus, invoiceNum]
        );
        const InvoiceService = (await import('../services/payment/InvoiceService')).default;
        await InvoiceService.createPharmacyInvoice(payRow.rows[0].id);
      }
    } catch (billErr: any) {
      logger.warn('Pharmacy billing record creation failed (non-fatal)', { error: billErr.message });
    }
  }
  // Notify pet owner that medication is ready/dispensed
  try {
    const rxRow = await database.query(
      `SELECT p.pet_owner_id, a.name AS animal_name FROM prescriptions p LEFT JOIN animals a ON a.id=p.animal_id WHERE p.id=$1`,
      [prescription_id]
    );
    if (rxRow.rows[0]?.pet_owner_id) {
      const method = dispensing_method || 'walk_in_pickup';
      const msg = method === 'home_delivery'
        ? `${rxRow.rows[0].animal_name || 'Your pet'}'s medication has been dispatched for home delivery.`
        : `${rxRow.rows[0].animal_name || 'Your pet'}'s medication is ready for ${method === 'courier' ? 'courier pickup' : 'collection'} at the pharmacy.`;
      const NSvc = (await import('../services/NotificationService')).default;
      await NSvc.createNotification(rxRow.rows[0].pet_owner_id, 'prescription', 'Medication Ready', msg, 'all', { prescriptionId: prescription_id, dispensingId: recordId });
    }
  } catch { /* non-fatal */ }
  res.status(201).json(record.rows[0]);
}));

// Update dispensing status - requires pharmacy membership
router.patch('/dispensing/:dispensingId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const row = await database.query(
    `SELECT pharmacy_id FROM dispensing_records WHERE id = $1`,
    [req.params.dispensingId]
  );
  if (!row.rows[0]) return res.status(404).json({ error: 'Dispensing record not found' });
  if (!await guardPharmacy(req, res, row.rows[0].pharmacy_id)) return;
  const { dispensing_status, received_by, signature_url, notes } = req.body;
  const now = new Date().toISOString();
  const result = await database.query(
    `UPDATE dispensing_records SET
       dispensing_status = COALESCE($1, dispensing_status),
       received_by = COALESCE($2, received_by),
       signature_url = COALESCE($3, signature_url),
       notes = COALESCE($4, notes),
       handed_over_at = CASE WHEN $1 = 'handed_over' THEN $5::timestamptz ELSE handed_over_at END,
       updated_at = NOW()
     WHERE id = $6 RETURNING *`,
    [dispensing_status, received_by, signature_url, notes, now, req.params.dispensingId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Dispensing record not found' });
  res.json(result.rows[0]);
}));

// Dispensing history
router.get('/pharmacies/:pharmacyId/dispensing-history', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const result = await database.query(
    `SELECT dr.*, p.medications AS prescription_medications,
            a.name AS animal_name, a.species AS animal_species,
            u.first_name || ' ' || u.last_name AS pharmacist_name,
            po.first_name || ' ' || po.last_name AS owner_name,
            v.first_name || ' ' || v.last_name AS vet_name,
            hp.pharmacy_name, hp.address AS pharmacy_address, hp.phone AS pharmacy_phone,
            (SELECT json_agg(json_build_object('name', pm.name, 'quantity', dli.quantity_dispensed, 'unit', dli.unit, 'unitPrice', dli.unit_price, 'lineTotal', dli.line_total, 'batchNumber', dli.batch_number) ORDER BY dli.created_at)
             FROM dispensing_line_items dli LEFT JOIN pharmacy_medications pm ON pm.id = dli.med_id
             WHERE dli.dispensing_record_id = dr.id) AS line_items
     FROM dispensing_records dr
     JOIN prescriptions p ON dr.prescription_id = p.id
     JOIN animals a ON p.animal_id = a.id
     LEFT JOIN users po ON p.pet_owner_id = po.id
     LEFT JOIN users v ON p.veterinarian_id = v.id
     JOIN users u ON dr.pharmacist_id = u.id
     LEFT JOIN hospital_pharmacies hp ON hp.id = dr.pharmacy_id
     WHERE dr.pharmacy_id = $1
     ORDER BY dr.created_at DESC LIMIT $2`,
    [req.params.pharmacyId, limit]
  );
  res.json(result.rows);
}));

// Vet's own pharmacy stats (dashboard tile) - self-scoped, no guard needed
router.get('/vet/pharmacy-stats', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const result = await database.query(
    `SELECT
       COUNT(*) FILTER (WHERE review_status = 'pending_review') AS pending_review,
       COUNT(*) FILTER (WHERE review_status = 'rejected' AND updated_at >= NOW() - INTERVAL '7 days') AS rejected_this_week,
       COUNT(*) FILTER (WHERE review_status = 'dispensed') AS dispensed_count
     FROM prescriptions
     WHERE veterinarian_id = $1 AND is_network_coordinated = true AND is_active = true`,
    [authReq.userId]
  );
  const r = result.rows[0];
  res.json({
    success: true,
    data: {
      pendingReview: parseInt(r.pending_review, 10),
      rejectedThisWeek: parseInt(r.rejected_this_week, 10),
      dispensedCount: parseInt(r.dispensed_count, 10),
    },
  });
}));

// ── Analytics ────────────────────────────────────────────────

router.get('/pharmacies/:pharmacyId/analytics', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const days = Math.min(Math.max(Number.parseInt(String(req.query.days), 10) || 30, 1), 365);
  const [revenue, volume, topMeds, lowStock, expiring] = await Promise.all([
    database.query(
      `SELECT COALESCE(SUM(total_cost), 0) AS total_revenue, COUNT(*) AS dispensing_count
       FROM dispensing_records WHERE pharmacy_id = $1 AND created_at >= NOW() - ($2::int * INTERVAL '1 day')`,
      [req.params.pharmacyId, days]
    ),
    database.query(
      `SELECT COUNT(*) AS pending_reviews FROM prescriptions p
       WHERE p.network_id = (SELECT network_id FROM hospital_pharmacies WHERE id = $1)
         AND p.review_status = 'pending_review'`,
      [req.params.pharmacyId]
    ),
    database.query(
      `SELECT pm.name AS med_name, SUM(dli.quantity_dispensed) AS total_dispensed, SUM(dli.line_total) AS total_revenue
       FROM dispensing_line_items dli
       JOIN dispensing_records dr ON dli.dispensing_record_id = dr.id
       JOIN pharmacy_medications pm ON dli.med_id = pm.id
       WHERE dr.pharmacy_id = $1 AND dr.created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY pm.name ORDER BY total_dispensed DESC LIMIT 5`,
      [req.params.pharmacyId]
    ),
    database.query(
      `SELECT COUNT(*) AS low_stock_count FROM (
         SELECT pm.id FROM pharmacy_medications pm
         LEFT JOIN pharmacy_inventory pi ON pi.med_id = pm.id AND pi.pharmacy_id = $1 AND pi.is_active = true
         WHERE pm.network_id = (SELECT network_id FROM hospital_pharmacies WHERE id = $1) AND pm.is_active = true
         GROUP BY pm.id, pm.reorder_point HAVING COALESCE(SUM(pi.quantity), 0) <= pm.reorder_point
       ) t`,
      [req.params.pharmacyId]
    ),
    database.query(
      `SELECT COUNT(*) AS expiring_count FROM pharmacy_inventory
       WHERE pharmacy_id = $1 AND is_active = true AND expiry_date IS NOT NULL
         AND expiry_date <= CURRENT_DATE + INTERVAL '90 days'`,
      [req.params.pharmacyId]
    ),
  ]);
  res.json({
    period_days: days,
    total_revenue: revenue.rows[0]?.total_revenue || 0,
    dispensing_count: revenue.rows[0]?.dispensing_count || 0,
    pending_reviews: volume.rows[0]?.pending_reviews || 0,
    top_medications: topMeds.rows,
    low_stock_count: lowStock.rows[0]?.low_stock_count || 0,
    expiring_count: expiring.rows[0]?.expiring_count || 0,
  });
}));

// Network-wide pharmacy report - network members only
router.get('/networks/:networkId/pharmacy-reports', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const days = Math.min(Math.max(Number.parseInt(String(req.query.days), 10) || 30, 1), 365);
  const result = await database.query(
    `SELECT hp.pharmacy_name, hp.id AS pharmacy_id,
            COALESCE(SUM(dr.total_cost), 0) AS revenue,
            COUNT(dr.id) AS dispensing_count
     FROM hospital_pharmacies hp
     LEFT JOIN dispensing_records dr ON dr.pharmacy_id = hp.id
       AND dr.created_at >= NOW() - ($2::int * INTERVAL '1 day')
     WHERE hp.network_id = $1 AND hp.is_active = true
     GROUP BY hp.id, hp.pharmacy_name ORDER BY revenue DESC`,
    [req.params.networkId, days]
  );
  res.json({ period_days: days, pharmacies: result.rows });
}));

// Cross-network pharmacy overview for the admin dashboard
router.get('/admin/pharmacy-overview', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const [dispensing, pendingReview, lowStock, revenue] = await Promise.all([
    database.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS today,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS this_week
       FROM dispensing_records`
    ),
    database.query(
      `SELECT COUNT(*) AS count FROM prescriptions WHERE review_status = 'pending_review' AND is_network_coordinated = true AND is_active = true`
    ),
    database.query(
      `SELECT COUNT(DISTINCT hp.network_id) AS network_count, COUNT(*) AS item_count
       FROM pharmacy_inventory pi JOIN hospital_pharmacies hp ON hp.id = pi.pharmacy_id
       WHERE pi.quantity <= pi.min_stock_level AND hp.is_active = true`
    ),
    database.query(
      `SELECT COALESCE(SUM(total_cost), 0) AS revenue FROM dispensing_records WHERE created_at >= NOW() - INTERVAL '7 days'`
    ),
  ]);
  res.json({
    success: true,
    data: {
      dispensingToday: parseInt(dispensing.rows[0].today, 10),
      dispensingThisWeek: parseInt(dispensing.rows[0].this_week, 10),
      pendingReviewCount: parseInt(pendingReview.rows[0].count, 10),
      lowStockNetworks: parseInt(lowStock.rows[0].network_count, 10),
      lowStockItems: parseInt(lowStock.rows[0].item_count, 10),
      revenueThisWeek: parseFloat(revenue.rows[0].revenue),
    },
  });
}));

// ── Inter-hospital Medication Requests ───────────────────────

router.get('/networks/:networkId/med-requests', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const result = await database.query(
    `SELECT pmr.*, vh_s.name AS source_hospital_name, vh_d.name AS destination_hospital_name,
            u.first_name || ' ' || u.last_name AS created_by_name
     FROM pharmacy_medication_requests pmr
     LEFT JOIN vet_hospitals vh_s ON pmr.source_hospital_id = vh_s.id
     LEFT JOIN vet_hospitals vh_d ON pmr.destination_hospital_id = vh_d.id
     LEFT JOIN users u ON pmr.created_by = u.id
     WHERE pmr.source_network_id = $1
     ORDER BY pmr.created_at DESC`,
    [req.params.networkId]
  );
  res.json(result.rows);
}));

router.post('/networks/:networkId/med-requests', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const { source_hospital_id, destination_hospital_id, prescription_id, requested_medications, notes } = req.body;
  if (!requested_medications || !Array.isArray(requested_medications)) return res.status(400).json({ error: 'requested_medications array is required' });
  const result = await database.query(
    `INSERT INTO pharmacy_medication_requests (source_network_id, source_hospital_id, destination_hospital_id, prescription_id, requested_medications, notes, created_by)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING *`,
    [req.params.networkId, source_hospital_id || null, destination_hospital_id || null, prescription_id || null, JSON.stringify(requested_medications), notes || null, authReq.userId]
  );
  res.status(201).json(result.rows[0]);
}));

router.patch('/networks/:networkId/med-requests/:requestId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const { status, tracking_number, decline_reason, notes } = req.body;
  const result = await database.query(
    `UPDATE pharmacy_medication_requests SET
       status = COALESCE($1, status),
       tracking_number = COALESCE($2, tracking_number),
       decline_reason = COALESCE($3, decline_reason),
       notes = COALESCE($4, notes),
       fulfilled_by = CASE WHEN $1 IN ('fulfilled','shipped') THEN $5 ELSE fulfilled_by END,
       updated_at = NOW()
     WHERE id = $6 AND source_network_id = $7 RETURNING *`,
    [status, tracking_number, decline_reason, notes, authReq.userId, req.params.requestId, req.params.networkId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Medication request not found' });
  res.json(result.rows[0]);
}));

// Pharmacy dashboard summary (tiles)
router.get('/pharmacies/:pharmacyId/dashboard', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const pid = req.params.pharmacyId;
  const networkId = await guardPharmacy(req, res, pid);
  if (!networkId) return;
  const [pending, approved, lowStock, expiring, pendingReorders, todayRevenue] = await Promise.all([
    database.query(`SELECT COUNT(*) FROM prescriptions WHERE network_id = $1 AND (review_status = 'pending_review' OR review_status IS NULL) AND is_active = true`, [networkId]),
    database.query(`SELECT COUNT(*) FROM prescriptions WHERE network_id = $1 AND review_status = 'approved_for_dispensing' AND is_active = true`, [networkId]),
    database.query(
      `SELECT COUNT(*) FROM (SELECT pm.id FROM pharmacy_medications pm LEFT JOIN pharmacy_inventory pi ON pi.med_id = pm.id AND pi.pharmacy_id = $1 AND pi.is_active = true WHERE pm.network_id = $2 AND pm.is_active = true GROUP BY pm.id, pm.reorder_point HAVING COALESCE(SUM(pi.quantity), 0) <= pm.reorder_point) t`,
      [pid, networkId]
    ),
    database.query(`SELECT COUNT(*) FROM pharmacy_inventory WHERE pharmacy_id = $1 AND is_active = true AND expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '90 days'`, [pid]),
    database.query(`SELECT COUNT(*) FROM pharmacy_reorder_requests WHERE pharmacy_id = $1 AND status IN ('pending','sent_to_supplier')`, [pid]),
    database.query(`SELECT COALESCE(SUM(total_cost),0) AS revenue, COUNT(*) AS dispensed FROM dispensing_records WHERE pharmacy_id = $1 AND DATE(created_at) = CURRENT_DATE`, [pid]),
  ]);
  res.json({
    pending_reviews: parseInt(pending.rows[0].count),
    ready_to_dispense: parseInt(approved.rows[0].count),
    low_stock_count: parseInt(lowStock.rows[0].count),
    expiring_soon_count: parseInt(expiring.rows[0].count),
    pending_reorders: parseInt(pendingReorders.rows[0].count),
    todays_revenue: parseFloat(todayRevenue.rows[0]?.revenue ?? '0'),
    todays_dispensed: parseInt(todayRevenue.rows[0]?.dispensed ?? '0'),
  });
}));


export default router;
