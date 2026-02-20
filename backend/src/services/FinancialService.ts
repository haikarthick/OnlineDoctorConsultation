import database from '../utils/database';
import logger from '../utils/logger';

class FinancialService {

  async create(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO financial_records (enterprise_id, record_type, category, description, amount, currency,
        transaction_date, reference_id, reference_type, animal_id, group_id, recorded_by,
        payment_method, vendor, invoice_number, tags, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [data.enterpriseId, data.recordType, data.category, data.description || null,
       data.amount, data.currency || 'USD', data.transactionDate || new Date().toISOString().split('T')[0],
       data.referenceId || null, data.referenceType || null,
       data.animalId || null, data.groupId || null, data.recordedBy,
       data.paymentMethod || null, data.vendor || null, data.invoiceNumber || null,
       data.tags || null, data.notes || null]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, data: any): Promise<any> {
    const result = await database.query(
      `UPDATE financial_records SET
        category = COALESCE($2, category), description = COALESCE($3, description),
        amount = COALESCE($4, amount), transaction_date = COALESCE($5, transaction_date),
        payment_method = COALESCE($6, payment_method), vendor = COALESCE($7, vendor),
        invoice_number = COALESCE($8, invoice_number), notes = COALESCE($9, notes),
        tags = COALESCE($10, tags), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, data.category, data.description, data.amount, data.transactionDate,
       data.paymentMethod, data.vendor, data.invoiceNumber, data.notes, data.tags]
    );
    return this.mapRow(result.rows[0]);
  }

  async list(enterpriseId: string, filters: any = {}): Promise<any> {
    const conditions = ['fr.enterprise_id = $1'];
    const params: any[] = [enterpriseId];
    let idx = 2;
    if (filters.recordType) { conditions.push(`fr.record_type = $${idx++}`); params.push(filters.recordType); }
    if (filters.category) { conditions.push(`fr.category = $${idx++}`); params.push(filters.category); }
    if (filters.fromDate) { conditions.push(`fr.transaction_date >= $${idx++}`); params.push(filters.fromDate); }
    if (filters.toDate) { conditions.push(`fr.transaction_date <= $${idx++}`); params.push(filters.toDate); }

    params.push(Math.min(Math.max(parseInt(filters.limit) || 50, 1), 200));
    params.push(Math.max(parseInt(filters.offset) || 0, 0));
    const result = await database.query(
      `SELECT fr.*, u.first_name || ' ' || u.last_name as recorded_by_name
       FROM financial_records fr LEFT JOIN users u ON u.id = fr.recorded_by
       WHERE ${conditions.join(' AND ')} ORDER BY fr.transaction_date DESC
       LIMIT $${idx++} OFFSET $${idx++}`, params
    );
    return { items: result.rows.map((r: any) => this.mapRow(r)) };
  }

  async delete(id: string): Promise<void> {
    await database.query(`DELETE FROM financial_records WHERE id = $1`, [id]);
  }

  /** Financial analytics dashboard */
  async getFinancialDashboard(enterpriseId: string, months: number = 12): Promise<any> {
    // Revenue vs Expense summary
    const summary = await database.query(
      `SELECT record_type, SUM(amount) as total
       FROM financial_records WHERE enterprise_id = $1 AND transaction_date > NOW() - ($2::int || ' months')::interval
       GROUP BY record_type`, [enterpriseId, months]
    );

    // Monthly breakdown
    const monthly = await database.query(
      `SELECT date_trunc('month', transaction_date) as month, record_type, SUM(amount) as total
       FROM financial_records WHERE enterprise_id = $1 AND transaction_date > NOW() - ($2::int || ' months')::interval
       GROUP BY month, record_type ORDER BY month`, [enterpriseId, months]
    );

    // Top expense categories
    const topExpenses = await database.query(
      `SELECT category, SUM(amount) as total, COUNT(*) as tx_count
       FROM financial_records WHERE enterprise_id = $1 AND record_type = 'expense'
         AND transaction_date > NOW() - ($2::int || ' months')::interval
       GROUP BY category ORDER BY total DESC LIMIT 10`, [enterpriseId, months]
    );

    // Revenue by category
    const revenueByCategory = await database.query(
      `SELECT category, SUM(amount) as total
       FROM financial_records WHERE enterprise_id = $1 AND record_type = 'income'
         AND transaction_date > NOW() - ($2::int || ' months')::interval
       GROUP BY category ORDER BY total DESC`, [enterpriseId, months]
    );

    // Recent transactions
    const recent = await database.query(
      `SELECT fr.*, u.first_name || ' ' || u.last_name as recorded_by_name
       FROM financial_records fr LEFT JOIN users u ON u.id = fr.recorded_by
       WHERE fr.enterprise_id = $1 ORDER BY fr.transaction_date DESC LIMIT 10`, [enterpriseId]
    );

    const totalIncome = summary.rows.find((r: any) => r.record_type === 'income')?.total || 0;
    const totalExpense = summary.rows.find((r: any) => r.record_type === 'expense')?.total || 0;

    return {
      totalIncome: parseFloat(totalIncome),
      totalExpense: parseFloat(totalExpense),
      netProfit: parseFloat(totalIncome) - parseFloat(totalExpense),
      monthlyBreakdown: monthly.rows,
      topExpenseCategories: topExpenses.rows,
      revenueByCategory: revenueByCategory.rows,
      recentTransactions: recent.rows.map((r: any) => this.mapRow(r)),
    };
  }

  private mapRow(row: any): any {
    if (!row) return null;
    return {
      id: row.id, enterpriseId: row.enterprise_id, recordType: row.record_type,
      category: row.category, description: row.description,
      amount: parseFloat(row.amount), currency: row.currency,
      transactionDate: row.transaction_date, referenceId: row.reference_id,
      referenceType: row.reference_type, animalId: row.animal_id, groupId: row.group_id,
      recordedBy: row.recorded_by, paymentMethod: row.payment_method,
      vendor: row.vendor, invoiceNumber: row.invoice_number,
      receiptUrl: row.receipt_url, tags: row.tags, notes: row.notes,
      createdAt: row.created_at, updatedAt: row.updated_at,
      recordedByName: row.recorded_by_name,
    };
  }
}

export default new FinancialService();
