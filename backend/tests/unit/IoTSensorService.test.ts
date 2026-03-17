import database from '../../src/utils/database';
import iotService from '../../src/services/IoTSensorService';

jest.mock('../../src/utils/database');

describe('IoTSensorService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createSensor', () => {
    it('should create a sensor', async () => {
      const sensor = { id: 's1', enterprise_id: 'e1', name: 'Temp Sensor', sensor_type: 'temperature' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [sensor] });
      const result = await iotService.createSensor({ enterprise_id: 'e1', name: 'Temp Sensor', sensor_type: 'temperature' });
      expect(result).toEqual(sensor);
    });
  });

  describe('listSensors', () => {
    it('should list sensors for an enterprise', async () => {
      const sensors = [{ id: 's1' }, { id: 's2' }];
      (database.query as jest.Mock).mockResolvedValue({ rows: sensors, rowCount: 2 });
      const result = await iotService.listSensors('e1');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by sensorType', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await iotService.listSensors('e1', { sensorType: 'humidity' });
      expect(database.query).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await iotService.listSensors('e1', { status: 'active' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('updateSensor', () => {
    it('should update a sensor', async () => {
      const updated = { id: 's1', name: 'Updated Sensor' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [updated] });
      const result = await iotService.updateSensor('s1', { name: 'Updated Sensor' });
      expect(result).toBeDefined();
    });
  });

  describe('deleteSensor', () => {
    it('should delete a sensor', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await iotService.deleteSensor('s1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['s1']);
    });
  });

  describe('recordReading', () => {
    it('should record a sensor reading', async () => {
      const reading = { id: 'r1', sensor_id: 's1', value: 25.5 };
      (database.query as jest.Mock).mockResolvedValue({ rows: [reading] });
      const result = await iotService.recordReading({ sensor_id: 's1', value: 25.5 });
      expect(result).toEqual(reading);
    });
  });

  describe('listReadings', () => {
    it('should list readings for a sensor', async () => {
      const readings = [{ id: 'r1', value: 25.5 }, { id: 'r2', value: 26 }];
      (database.query as jest.Mock).mockResolvedValue({ rows: readings, rowCount: 2 });
      const result = await iotService.listReadings('s1');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by date range', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await iotService.listReadings('s1', { from: '2024-01-01', to: '2024-12-31' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('getSensorDashboard', () => {
    it('should return sensor dashboard', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '5', active: '3' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await iotService.getSensorDashboard('e1');
      expect(result).toBeDefined();
    });
  });
});
