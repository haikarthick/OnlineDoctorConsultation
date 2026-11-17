import { Pool } from 'pg';
import logger from '../logger';

export async function syncBookingStatuses(pool: Pool): Promise<void> {
    try {
      const result = await pool.query(
        `UPDATE bookings SET status = 'completed', updated_at = NOW()
         WHERE consultation_id IN (SELECT id FROM consultations WHERE status = 'completed')
         AND status != 'completed'`
      );
      if (result.rowCount && result.rowCount > 0) {
        logger.info(`Synced ${result.rowCount} booking(s) to completed status`);
      }
    } catch (error: any) {
      logger.warn('Failed to sync booking statuses', { error: error.message });
    }
}
