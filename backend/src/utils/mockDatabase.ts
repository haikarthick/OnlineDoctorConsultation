/**
 * Mock In-Memory Database for Development
 * Simulates PostgreSQL connection without needing actual database
 */

import logger from './logger';
import bcrypt from 'bcryptjs';

class MockDatabase {
  private tables: Map<string, any[]> = new Map();
  private connected: boolean = false;
  private idCounters: Map<string, number> = new Map();

  constructor() {
    this.initializeTables();
  }

  private initializeTables() {
    // Initialize default tables
    const tableNames = [
      'users', 'consultations', 'sessions', 'animals', 'vet_profiles',
      'medical_records', 'notifications', 'payments', 'reviews', 'audit_logs',
      'bookings', 'video_sessions', 'chat_messages', 'vet_schedules',
      'prescriptions', 'system_settings'
    ];
    tableNames.forEach(name => {
      this.tables.set(name, []);
      this.idCounters.set(name, 0);
    });
  }

  private async seedData(): Promise<void> {
    try {
      const passwordHash = await bcrypt.hash('Admin@123', 10);
      const vetPasswordHash = await bcrypt.hash('Doctor@123', 10);
      const ownerPasswordHash = await bcrypt.hash('Owner@123', 10);
      const now = new Date().toISOString();

      // Seed Admin User
      const adminId = 'admin-001-uuid';
      this.tables.get('users')!.push({
        id: adminId,
        email: 'admin@vetcare.com',
        firstName: 'System',
        lastName: 'Admin',
        role: 'admin',
        phone: '+1-555-0100',
        passwordHash: passwordHash,
        isActive: true,
        createdAt: now,
        updatedAt: now
      });

      // Seed Veterinarian Users
      const vets = [
        { id: 'vet-001-uuid', email: 'dr.smith@vetcare.com', firstName: 'James', lastName: 'Smith', phone: '+1-555-0201' },
        { id: 'vet-002-uuid', email: 'dr.johnson@vetcare.com', firstName: 'Sarah', lastName: 'Johnson', phone: '+1-555-0202' },
        { id: 'vet-003-uuid', email: 'dr.williams@vetcare.com', firstName: 'Michael', lastName: 'Williams', phone: '+1-555-0203' },
      ];

      for (const vet of vets) {
        this.tables.get('users')!.push({
          ...vet,
          role: 'veterinarian',
          passwordHash: vetPasswordHash,
          isActive: true,
          createdAt: now,
          updatedAt: now
        });

        // Create vet profiles
        this.tables.get('vet_profiles')!.push({
          id: `profile-${vet.id}`,
          userId: vet.id,
          licenseNumber: `VET-${Math.floor(10000 + Math.random() * 90000)}`,
          specializations: vet.id === 'vet-001-uuid' ? ['General Practice', 'Surgery'] :
            vet.id === 'vet-002-uuid' ? ['Dermatology', 'Internal Medicine'] :
              ['Emergency Care', 'Orthopedics'],
          qualifications: ['DVM', 'Board Certified'],
          experience: vet.id === 'vet-001-uuid' ? 12 : vet.id === 'vet-002-uuid' ? 8 : 15,
          bio: `Dr. ${vet.lastName} is an experienced veterinarian specializing in animal care.`,
          consultationFee: vet.id === 'vet-001-uuid' ? 75 : vet.id === 'vet-002-uuid' ? 85 : 95,
          currency: '$',
          rating: vet.id === 'vet-001-uuid' ? 4.8 : vet.id === 'vet-002-uuid' ? 4.6 : 4.9,
          totalReviews: vet.id === 'vet-001-uuid' ? 124 : vet.id === 'vet-002-uuid' ? 89 : 156,
          totalConsultations: vet.id === 'vet-001-uuid' ? 350 : vet.id === 'vet-002-uuid' ? 210 : 480,
          isAvailable: true,
          acceptsEmergency: vet.id !== 'vet-002-uuid',
          languages: ['English', 'Spanish'],
          clinicName: `${vet.lastName} Veterinary Clinic`,
          createdAt: now,
          updatedAt: now,
          firstName: vet.firstName,
          lastName: vet.lastName,
          email: vet.email
        });
      }

      // Seed Pet Owner User
      const ownerId = 'owner-001-uuid';
      this.tables.get('users')!.push({
        id: ownerId,
        email: 'owner@vetcare.com',
        firstName: 'Emily',
        lastName: 'Davis',
        role: 'pet_owner',
        phone: '+1-555-0301',
        passwordHash: ownerPasswordHash,
        isActive: true,
        createdAt: now,
        updatedAt: now
      });

      // Seed some animals for the pet owner
      this.tables.get('animals')!.push(
        { id: 'animal-001', userId: ownerId, ownerId: ownerId, name: 'Buddy', species: 'Dog', breed: 'Golden Retriever', gender: 'Male', dateOfBirth: '2020-03-15', weight: 32, color: 'Golden', createdAt: now, updatedAt: now },
        { id: 'animal-002', userId: ownerId, ownerId: ownerId, name: 'Whiskers', species: 'Cat', breed: 'Siamese', gender: 'Female', dateOfBirth: '2021-07-20', weight: 4.5, color: 'Cream', createdAt: now, updatedAt: now },
        { id: 'animal-003', userId: ownerId, ownerId: ownerId, name: 'Max', species: 'Dog', breed: 'German Shepherd', gender: 'Male', dateOfBirth: '2019-11-10', weight: 38, color: 'Black and Tan', createdAt: now, updatedAt: now }
      );

      logger.info('Seed data loaded: 1 admin, 3 vets, 1 pet owner, 3 animals');
    } catch (error) {
      logger.error('Failed to seed data', { error });
    }
  }

  async connect(): Promise<void> {
    try {
      this.connected = true;
      logger.info('Mock database connected successfully');
      await this.seedData();
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
          
          if (cond.includes('id =') && !cond.includes('user_id') && !cond.includes('owner_id') && !cond.includes('veterinarian_id') && !cond.includes('animal_id') && !cond.includes('reviewer_id') && !cond.includes('consultation_id') && !cond.includes('pet_owner_id') && !cond.includes('host_user_id') && !cond.includes('participant_user_id') && !cond.includes('session_id') && !cond.includes('sender_id') && !cond.includes('payer_id') && !cond.includes('payee_id') && !cond.includes('resource_id')) {
            return row.id === paramVal;
          }
          if (cond.includes('email =')) return row.email === paramVal;
          if (cond.includes('user_id =')) return row.userId === paramVal;
          if (cond.includes('owner_id =')) return row.ownerId === paramVal;
          if (cond.includes('pet_owner_id =')) return row.petOwnerId === paramVal;
          if (cond.includes('veterinarian_id =')) return row.veterinarianId === paramVal;
          if (cond.includes('animal_id =')) return row.animalId === paramVal;
          if (cond.includes('consultation_id =')) return row.consultationId === paramVal;
          if (cond.includes('reviewer_id =')) return row.reviewerId === paramVal;
          if (cond.includes('host_user_id =')) return row.hostUserId === paramVal;
          if (cond.includes('participant_user_id =')) return row.participantUserId === paramVal;
          if (cond.includes('session_id =')) return row.sessionId === paramVal;
          if (cond.includes('sender_id =')) return row.senderId === paramVal;
          if (cond.includes('payer_id =')) return row.payerId === paramVal;
          if (cond.includes('payee_id =')) return row.payeeId === paramVal;
          if (cond.includes('resource_id =')) return row.resourceId === paramVal;
          if (cond.includes('room_id =')) return row.roomId === paramVal;
          if (cond.includes('day_of_week =')) return row.dayOfWeek === paramVal;
          if (cond.includes('scheduled_date =')) return row.scheduledDate === paramVal;
          if (cond.includes('time_slot_start =')) return row.timeSlotStart === paramVal;
          if (cond.includes('key =')) return row.key === paramVal;
          if (cond.includes('is_active')) return row.isActive === (paramVal === true || paramVal === 'true');
          if (cond.includes('role =')) return row.role === paramVal;
          if (cond.includes('status =')) return row.status === paramVal;
          if (cond.includes('action =')) return row.action === paramVal;
          if (cond.includes('is_read =')) return row.isRead === (paramVal === true || paramVal === 'true' || paramVal === false || paramVal === 'false' ? paramVal : true);
          if (cond.includes('status IN')) {
            const statusList = cond.match(/\('([^']+)'(?:,\s*'([^']+)')*\)/);
            if (statusList) {
              const statuses = cond.match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) || [];
              return statuses.includes(row.status);
            }
            return true;
          }
          if (cond.includes('status NOT IN')) {
            const statusList = cond.match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) || [];
            return !statusList.includes(row.status);
          }
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

    // Handle COUNT queries - return a single row with count
    const isCountQuery = selectColumns.some(col => col.toUpperCase().includes('COUNT'));
    if (isCountQuery) {
      const countRow: any = {};
      selectColumns.forEach(col => {
        if (col.toUpperCase().includes('COUNT')) {
          const aliasMatch = col.match(/as\s+"?(\w+)"?/i);
          const alias = aliasMatch ? aliasMatch[1] : 'count';
          countRow[alias] = results.length;
        }
      });
      return { rows: [countRow], rowCount: 1 };
    }

    // Format results based on SELECT clause aliases
    const formattedResults = results.map((row: any) => {
      const formattedRow: any = {};
      selectColumns.forEach(col => {
        // Handle "column as alias" syntax
        if (col.includes(' as ')) {
          const [dbCol, alias] = col.split(' as ').map(c => c.trim().replace(/"/g, ''));
          // Strip table alias prefix (e.g., "vp.user_id" → "user_id")
          const cleanDbCol = dbCol.includes('.') ? dbCol.split('.').pop()! : dbCol;
          const camelCol = this._snakeToCamel(cleanDbCol);
          formattedRow[alias] = row[camelCol] !== undefined ? row[camelCol] : (row[cleanDbCol] !== undefined ? row[cleanDbCol] : row[dbCol]);
        } else {
          // Handle plain columns, strip table alias prefix
          const cleanCol = col.includes('.') ? col.split('.').pop()! : col;
          // Skip aggregate functions in non-COUNT queries
          if (col.includes('(')) return;
          const camelCol = this._snakeToCamel(cleanCol);
          formattedRow[camelCol] = row[camelCol] !== undefined ? row[camelCol] : row[cleanCol];
        }
      });
      return Object.keys(formattedRow).length > 0 ? formattedRow : row;
    });

    // Handle LIMIT and OFFSET
    let finalResults = formattedResults;
    const limitMatch = text.match(/LIMIT\s+\$(\d+)/i);
    const offsetMatch = text.match(/OFFSET\s+\$(\d+)/i);
    
    if (offsetMatch && params) {
      const offsetIdx = parseInt(offsetMatch[1]) - 1;
      const offset = parseInt(params[offsetIdx]) || 0;
      finalResults = finalResults.slice(offset);
    }
    if (limitMatch && params) {
      const limitIdx = parseInt(limitMatch[1]) - 1;
      const limit = parseInt(params[limitIdx]) || finalResults.length;
      finalResults = finalResults.slice(0, limit);
    }

    return { rows: finalResults, rowCount: finalResults.length };
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
