/**
 * ConsultationService unit tests — mock database.
 */
import ConsultationService from '../../src/services/ConsultationService'
import database from '../../src/utils/database'

jest.mock('../../src/utils/database')

describe('ConsultationService', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('createConsultation', () => {
    it('inserts and returns a new consultation', async () => {
      const mockRow = {
        id: 'c1',
        user_id: 'u1',
        veterinarian_id: 'v1',
        status: 'pending',
        animal_type: 'Dog',
        symptom_description: 'Limping',
      }
      ;(database.query as jest.Mock).mockResolvedValue({ rows: [mockRow] })

      const result = await ConsultationService.createConsultation('u1', 'v1', {
        animalType: 'Dog',
        symptomDescription: 'Limping',
      })

      expect(result).toBeDefined()
      expect(database.query).toHaveBeenCalledTimes(1)
      const sql = (database.query as jest.Mock).mock.calls[0][0]
      expect(sql).toContain('INSERT INTO consultations')
    })
  })

  describe('getConsultation', () => {
    it('returns consultation when found', async () => {
      const mockRow = { id: 'c1', status: 'pending' }
      ;(database.query as jest.Mock).mockResolvedValue({ rows: [mockRow] })

      const result = await ConsultationService.getConsultation('c1')
      expect(result).toEqual(mockRow)
    })

    it('throws NotFoundError when consultation is missing', async () => {
      ;(database.query as jest.Mock).mockResolvedValue({ rows: [] })

      await expect(ConsultationService.getConsultation('missing')).rejects.toThrow()
    })
  })

  describe('listConsultations', () => {
    it('returns paginated results', async () => {
      const rows = [{ id: 'c1' }, { id: 'c2' }]
      ;(database.query as jest.Mock).mockResolvedValue({ rows })

      const result = await ConsultationService.listConsultations('u1', undefined, 10, 0)
      expect(result).toBeDefined()
      expect(database.query).toHaveBeenCalled()
    })

    it('applies status filter', async () => {
      ;(database.query as jest.Mock).mockResolvedValue({ rows: [] })

      await ConsultationService.listConsultations('u1', undefined, 10, 0, 'completed')
      const sql = (database.query as jest.Mock).mock.calls[0][0]
      expect(sql.toLowerCase()).toContain('status')
    })
  })

  describe('updateConsultation', () => {
    it('updates and returns modified consultation', async () => {
      const updated = { id: 'c1', status: 'completed' }
      ;(database.query as jest.Mock).mockResolvedValue({ rows: [updated] })

      const result = await ConsultationService.updateConsultation('c1', { status: 'completed' })
      expect(result).toBeDefined()
      expect(database.query).toHaveBeenCalled()
    })
  })
})
