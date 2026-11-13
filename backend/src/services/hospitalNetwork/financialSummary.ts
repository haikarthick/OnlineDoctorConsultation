import database from '../../utils/database';
import { DatabaseError } from '../../utils/errors';
  // ─── Financial Summary ────────────────────────────────────────
  export async function getNetworkFinancialSummary(networkId: string): Promise<any> {
    try {
      // Get branch hospital IDs
      const hospitalsResult = await database.query(
        `SELECT hospital_id FROM hospital_network_hospitals WHERE network_id = $1`,
        [networkId]
      );
      const hospitalIds = hospitalsResult.rows.map((r: any) => r.hospital_id);

      if (hospitalIds.length === 0) {
        return {
          totalConsultations: 0, totalBookings: 0, monthlyConsultations: [],
          hospitalBreakdown: [], staffCounts: {}
        };
      }

      const placeholders = hospitalIds.map((_: any, i: number) => `$${i + 1}`).join(',');
      // A hospital's own pre-existing platform activity (from before it joined this
      // network as a standalone practice) must never count toward the network's own
      // financial summary -- it isn't this network's activity, and surfacing it here
      // would leak a hospital's prior independent business volume to the network.
      // hospital_network_hospitals.joined_at is the boundary.
      const joinedAtIdx = hospitalIds.length + 1;

      const [consultations, bookings, monthly, perHospital, staffByRole] = await Promise.all([
        database.query(
          `SELECT COUNT(*) as count FROM consultations c
           JOIN bookings b ON b.consultation_id = c.id
           JOIN hospital_network_hospitals hnh ON hnh.hospital_id = b.hospital_id AND hnh.network_id = $${joinedAtIdx}
           WHERE b.hospital_id IN (${placeholders}) AND b.created_at >= hnh.joined_at`,
          [...hospitalIds, networkId]
        ),
        database.query(
          `SELECT COUNT(*) as count FROM bookings b
           JOIN hospital_network_hospitals hnh ON hnh.hospital_id = b.hospital_id AND hnh.network_id = $${joinedAtIdx}
           WHERE b.hospital_id IN (${placeholders}) AND b.created_at >= hnh.joined_at`,
          [...hospitalIds, networkId]
        ),
        database.query(
          `SELECT DATE_TRUNC('month', c.created_at) as month, COUNT(*) as count
           FROM consultations c
           JOIN bookings b ON b.consultation_id = c.id
           JOIN hospital_network_hospitals hnh ON hnh.hospital_id = b.hospital_id AND hnh.network_id = $${joinedAtIdx}
           WHERE b.hospital_id IN (${placeholders})
             AND b.created_at >= hnh.joined_at
             AND c.created_at >= NOW() - INTERVAL '6 months'
           GROUP BY DATE_TRUNC('month', c.created_at)
           ORDER BY month DESC`,
          [...hospitalIds, networkId]
        ),
        database.query(
          `SELECT vh.id, vh.name,
                  (SELECT COUNT(*) FROM bookings WHERE hospital_id = vh.id AND created_at >= hnh.joined_at) as booking_count,
                  (SELECT COUNT(*) FROM appointment_queue WHERE hospital_id = vh.id AND created_at >= hnh.joined_at) as queue_count,
                  (SELECT COUNT(*) FROM inpatient_admissions WHERE hospital_id = vh.id AND created_at >= hnh.joined_at) as inpatient_count
           FROM vet_hospitals vh
           JOIN hospital_network_hospitals hnh ON hnh.hospital_id = vh.id AND hnh.network_id = $${joinedAtIdx}
           WHERE vh.id IN (${placeholders})`,
          [...hospitalIds, networkId]
        ),
        database.query(
          `SELECT network_role, COUNT(*) as count
           FROM hospital_network_members
           WHERE network_id = $1 AND is_active = true
           GROUP BY network_role`,
          [networkId]
        ),
      ]);

      const staffCounts: Record<string, number> = {};
      for (const row of staffByRole.rows) {
        staffCounts[row.network_role] = parseInt(row.count);
      }

      return {
        totalConsultations: parseInt(consultations.rows[0]?.count || '0'),
        totalBookings: parseInt(bookings.rows[0]?.count || '0'),
        monthlyConsultations: monthly.rows.map((r: any) => ({
          month: r.month,
          count: parseInt(r.count),
        })),
        hospitalBreakdown: perHospital.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          bookings: parseInt(r.booking_count || '0'),
          queueVisits: parseInt(r.queue_count || '0'),
          inpatients: parseInt(r.inpatient_count || '0'),
        })),
        staffCounts,
      };
    } catch (error) {
      throw new DatabaseError('Error fetching network financial summary', { originalError: error });
    }
  }

