import database from '../../src/utils/database';
import reportService from '../../src/services/ReportBuilderService';

jest.mock('../../src/utils/database');

describe('ReportBuilderService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createTemplate', () => {
    it('should create a report template', async () => {
      const tpl = { id: 't1', enterprise_id: 'e1', name: 'Monthly Report' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [tpl] });
      const result = await reportService.createTemplate({ enterprise_id: 'e1', name: 'Monthly Report' });
      expect(result).toEqual(tpl);
    });
  });

  describe('listTemplates', () => {
    it('should list templates for an enterprise', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 't1' }, { id: 't2' }] });
      const result = await reportService.listTemplates('e1');
      expect(result.items).toHaveLength(2);
    });
  });

  describe('updateTemplate', () => {
    it('should update a template', async () => {
      const updated = { id: 't1', name: 'Updated Template' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [updated] });
      const result = await reportService.updateTemplate('t1', { name: 'Updated Template' });
      expect(result).toBeDefined();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await reportService.deleteTemplate('t1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['t1']);
    });
  });

  describe('generateReport', () => {
    it('should generate a report', async () => {
      const report = { id: 'r1', template_id: 't1', report_data: {} };
      (database.query as jest.Mock).mockResolvedValue({ rows: [report] });
      const result = await reportService.generateReport({ enterprise_id: 'e1', template_id: 't1' });
      expect(result).toEqual(report);
    });
  });

  describe('listGeneratedReports', () => {
    it('should list generated reports for an enterprise', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'r1' }, { id: 'r2' }] });
      const result = await reportService.listGeneratedReports('e1');
      expect(result.items).toHaveLength(2);
    });

    it('should filter by reportType', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await reportService.listGeneratedReports('e1', { reportType: 'health' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('getReport', () => {
    it('should return a report by id', async () => {
      const report = { id: 'r1', report_data: {} };
      (database.query as jest.Mock).mockResolvedValue({ rows: [report] });
      const result = await reportService.getReport('r1');
      expect(result).toEqual(report);
    });
  });

  describe('deleteReport', () => {
    it('should delete a report', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await reportService.deleteReport('r1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['r1']);
    });
  });
});
