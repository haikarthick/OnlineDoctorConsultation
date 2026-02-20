/**
 * AnimalService unit tests — mock database.
 */
import AnimalService from '../../src/services/AnimalService'
import database from '../../src/utils/database'

jest.mock('../../src/utils/database')

describe('AnimalService', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('createAnimal', () => {
    it('inserts and returns a new animal', async () => {
      const mockAnimal = {
        id: 'a1',
        name: 'Buddy',
        species: 'Dog',
        ownerId: 'u1',
        uniqueId: 'PET-00001',
      }
      // 3 queries: generateTrackingNumber count, uniqueId count, INSERT
      ;(database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // tracking number
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // unique id
        .mockResolvedValueOnce({ rows: [mockAnimal] }) // insert

      const result = await AnimalService.createAnimal('u1', { name: 'Buddy', species: 'Dog' })
      expect(result).toBeDefined()
      expect(result.name).toBe('Buddy')
    })
  })

  describe('getAnimal', () => {
    it('returns animal when found', async () => {
      const mockAnimal = { id: 'a1', name: 'Luna', species: 'Cat' }
      ;(database.query as jest.Mock).mockResolvedValue({ rows: [mockAnimal] })

      const result = await AnimalService.getAnimal('a1')
      expect(result).toEqual(mockAnimal)
    })

    it('throws NotFoundError when animal is missing', async () => {
      ;(database.query as jest.Mock).mockResolvedValue({ rows: [] })
      await expect(AnimalService.getAnimal('missing')).rejects.toThrow()
    })
  })

  describe('listAnimalsByOwner', () => {
    it('returns paginated list', async () => {
      ;(database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'a1' }, { id: 'a2' }] })

      const result = await AnimalService.listAnimalsByOwner('u1', 10, 0)
      expect(result).toBeDefined()
    })
  })

  describe('updateAnimal', () => {
    it('updates and returns the animal', async () => {
      const updated = { id: 'a1', name: 'Buddy Jr.', species: 'Dog' }
      ;(database.query as jest.Mock).mockResolvedValue({ rows: [updated] })

      const result = await AnimalService.updateAnimal('a1', { name: 'Buddy Jr.' })
      expect(result).toBeDefined()
    })
  })

  describe('deleteAnimal', () => {
    it('soft-deletes without throwing', async () => {
      ;(database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'a1' }] })
      await expect(AnimalService.deleteAnimal('a1')).resolves.not.toThrow()
    })
  })
})
