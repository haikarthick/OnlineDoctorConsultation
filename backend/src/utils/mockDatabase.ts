/**
 * Mock In-Memory Database for Development
 * Simulates PostgreSQL connection without needing actual database
 */

import logger from './logger';

class MockDatabase {
  private tables: Map<string, any[]> = new Map();
  private connected: boolean = false;
  private idCounters: Map<string, number> = new Map();

  constructor() {
    this.initializeTables();
  }

  private initializeTables() {
    // Initialize default tables
    this.tables.set('users', []);
    this.tables.set('consultations', []);
    this.tables.set('sessions', []);
    this.tables.set('animals', []);
    this.tables.set('vet_profiles', []);
    this.tables.set('medical_records', []);
    this.tables.set('notifications', []);
    this.tables.set('payments', []);
    this.tables.set('reviews', []);
    this.tables.set('audit_logs', []);
    this.idCounters.set('users', 0);
    this.idCounters.set('consultations', 0);
    this.idCounters.set('sessions', 0);
    this.idCounters.set('animals', 0);
    this.idCounters.set('vet_profiles', 0);
    this.idCounters.set('medical_records', 0);
    this.idCounters.set('notifications', 0);
    this.idCounters.set('payments', 0);
    this.idCounters.set('reviews', 0);
    this.idCounters.set('audit_logs', 0);
  }

  async connect(): Promise<void> {
    try {
      this.connected = true;
      logger.info('Mock database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to mock database', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.connected = false;
      this.tables.clear();
      logger.info('Mock database disconnected');
    } catch (error) {
      logger.error('Error disconnecting from mock database', { error });
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      // Simple query parser for common SQL operations
      const upperText = text.toUpperCase();

      if (upperText.includes('INSERT INTO')) {
        return this.handleInsert(text, params);
      } else if (upperText.includes('SELECT')) {
        return this.handleSelect(text, params);
      } else if (upperText.includes('UPDATE')) {
        return this.handleUpdate(text, params);
      } else if (upperText.includes('DELETE')) {
        return this.handleDelete(text, params);
      } else if (upperText.includes('CREATE TABLE')) {
        return { rows: [] };
      }

      return { rows: [] };
    } catch (error) {
      logger.error('Query execution failed', { error, query: text });
      throw error;
    } finally {
      const duration = Date.now() - start;
      if (duration > 100) {
        logger.warn('Slow query detected', { query: text, duration });
      }
    }
  }

  private handleInsert(text: string, params?: any[]): any {
    // Extract table name
    const tableMatch = text.match(/INSERT INTO\s+(\w+)/i);
    if (!tableMatch) return { rows: [], rowCount: 0 };

    const tableName = tableMatch[1].toLowerCase();
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, []);
    }

    // Extract column names from INSERT statement
    const columnsMatch = text.match(/\(([^)]+)\)/);
    const columns = columnsMatch ? columnsMatch[1].split(',').map(c => c.trim()) : [];

    // Extract RETURNING clause
    const returningMatch = text.match(/RETURNING\s+(.+?)(?:$|;)/i);
    const returningColumns = returningMatch ? returningMatch[1].split(',').map(c => c.trim()) : columns;

    const table = this.tables.get(tableName)!;
    
    // Create new row by mapping params to column names
    const newRow: any = {};
    
    // If id column exists and not in params, generate it
    if (columns.includes('id') && !params?.[columns.indexOf('id')]) {
      const counter = (this.idCounters.get(tableName) || 0) + 1;
      this.idCounters.set(tableName, counter);
      newRow.id = counter;
    }

    // Map parameters to column names
    if (params) {
      columns.forEach((col, idx) => {
        newRow[this._snakeToCamel(col)] = params[idx];
      });
    }

    table.push(newRow);

    // Format return based on RETURNING clause
    const returnRow: any = {};
    returningColumns.forEach(col => {
      const camelCol = this._snakeToCamel(col);
      returnRow[camelCol] = newRow[camelCol];
    });

    return { rows: [returnRow], rowCount: 1 };
  }

  private handleSelect(text: string, params?: any[]): any {
    const tableMatch = text.match(/FROM\s+(\w+)/i);
    if (!tableMatch) return { rows: [] };

    const tableName = tableMatch[1].toLowerCase();
    const table = this.tables.get(tableName) || [];

    // Extract RETURNING/SELECT clause for column mapping
    const selectMatch = text.match(/SELECT\s+(.+?)\s+FROM/i);
    const selectColumns = selectMatch ? selectMatch[1].split(',').map(c => c.trim()) : [];

    // Simple WHERE clause handling
    let results = [...table];
    
    if (text.includes('WHERE') && params && params.length > 0) {
      const whereClause = text.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/is)?.[1] || '';
      
      results = results.filter((row: any) => {
        // Handle multiple AND conditions
        const conditions = whereClause.split(/\s+AND\s+/i);
        return conditions.every((cond: string) => {
          const paramMatch = cond.match(/\$(\d+)/);
          if (!paramMatch) return true;
          const paramIdx = parseInt(paramMatch[1]) - 1;
          if (paramIdx >= params.length) return true;
          
          const paramVal = params[paramIdx];
          
          if (cond.includes('id =') && !cond.includes('user_id') && !cond.includes('owner_id') && !cond.includes('veterinarian_id') && !cond.includes('animal_id') && !cond.includes('reviewer_id') && !cond.includes('consultation_id')) {
            return row.id === paramVal;
          }
          if (cond.includes('email =')) return row.email === paramVal;
          if (cond.includes('user_id =')) return row.userId === paramVal;
          if (cond.includes('owner_id =')) return row.ownerId === paramVal;
          if (cond.includes('veterinarian_id =')) return row.veterinarianId === paramVal;
          if (cond.includes('animal_id =')) return row.animalId === paramVal;
          if (cond.includes('consultation_id =')) return row.consultationId === paramVal;
          if (cond.includes('reviewer_id =')) return row.reviewerId === paramVal;
          if (cond.includes('is_active')) return row.isActive === (paramVal === true || paramVal === 'true');
          if (cond.includes('role =')) return row.role === paramVal;
          if (cond.includes('is_read =')) return row.isRead === (paramVal === true || paramVal === 'true' || paramVal === false || paramVal === 'false' ? paramVal : true);
          if (cond.includes('ILIKE')) {
            const searchVal = String(paramVal).replace(/%/g, '');
            const field = cond.split('.').pop()?.split(' ')[0] || '';
            const camelField = field.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase());
            return String(row[camelField] || '').toLowerCase().includes(searchVal.toLowerCase());
          }
          return true;
        });
      });
    }

    // Format results based on SELECT clause aliases
    const formattedResults = results.map((row: any) => {
      const formattedRow: any = {};
      selectColumns.forEach(col => {
        // Handle "column as alias" syntax
        if (col.includes(' as ')) {
          const [dbCol, alias] = col.split(' as ').map(c => c.trim().replace(/"/g, ''));
          const camelCol = this._snakeToCamel(dbCol);
          formattedRow[alias] = row[camelCol] || row[dbCol];
        } else {
          const camelCol = this._snakeToCamel(col);
          formattedRow[camelCol] = row[camelCol] || row[col];
        }
      });
      return Object.keys(formattedRow).length > 0 ? formattedRow : row;
    });

    return { rows: formattedResults, rowCount: formattedResults.length };
  }

  private handleUpdate(text: string, params?: any[]): any {
    const tableMatch = text.match(/UPDATE\s+(\w+)/i);
    if (!tableMatch || !params) return { rows: [], rowCount: 0 };

    const tableName = tableMatch[1].toLowerCase();
    const table = this.tables.get(tableName) || [];

    // Find the id parameter (usually $1 for WHERE id = $1)
    const whereIdMatch = text.match(/WHERE\s+(?:\w+\.)?id\s*=\s*\$(\d+)/i);
    const whereUserIdMatch = text.match(/WHERE\s+(?:\w+\.)?user_id\s*=\s*\$(\d+)/i);
    
    let targetIdx: number | undefined;
    let targetField: string | undefined;
    let targetValue: any;

    if (whereIdMatch) {
      targetIdx = parseInt(whereIdMatch[1]) - 1;
      targetField = 'id';
      targetValue = params[targetIdx];
    } else if (whereUserIdMatch) {
      targetIdx = parseInt(whereUserIdMatch[1]) - 1;
      targetField = 'userId';
      targetValue = params[targetIdx];
    }

    // Extract SET clause assignments
    const setMatch = text.match(/SET\s+(.+?)\s+WHERE/is);
    const setClause = setMatch ? setMatch[1] : '';
    const assignments = setClause.split(',').map(s => s.trim()).filter(s => s);

    let updated = 0;
    const updatedRows: any[] = [];

    table.forEach((row: any) => {
      const match = targetField ? row[targetField] === targetValue : false;
      if (match) {
        // Apply each SET assignment
        assignments.forEach(assignment => {
          const eqMatch = assignment.match(/(\w+)\s*=\s*\$(\d+)/);
          if (eqMatch) {
            const colName = eqMatch[1];
            const pIdx = parseInt(eqMatch[2]) - 1;
            const camelCol = this._snakeToCamel(colName);
            row[camelCol] = params[pIdx];
          }
        });
        row.updatedAt = new Date();
        updated++;
        updatedRows.push({ ...row });
      }
    });

    return { rows: updatedRows, rowCount: updated };
  }

  private handleDelete(text: string, params?: any[]): any {
    const tableMatch = text.match(/FROM\s+(\w+)/i);
    if (!tableMatch) return { rows: [], rowCount: 0 };

    const tableName = tableMatch[1].toLowerCase();
    const table = this.tables.get(tableName) || [];
    const initialLength = table.length;

    if (text.includes('id =') && params) {
      const filtered = table.filter((row: any) => row.id !== params[0]);
      this.tables.set(tableName, filtered);
      return { rows: [], rowCount: initialLength - filtered.length };
    }

    return { rows: [], rowCount: 0 };
  }

  private _snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  }

  // Helper methods
  async getConnection(): Promise<any> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }
    return this;
  }

  async end(): Promise<void> {
    await this.disconnect();
  }
}

export default new MockDatabase();
