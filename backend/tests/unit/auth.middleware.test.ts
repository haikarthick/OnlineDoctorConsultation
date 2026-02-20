/**
 * Auth middleware tests — mock jwt + database.
 */
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { authMiddleware, roleMiddleware, validateBody } from '../../src/middleware/auth'
import database from '../../src/utils/database'
import Joi from 'joi'

// database is already mocked in setup.ts; jwt needs manual mock
jest.mock('jsonwebtoken')

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: {},
    ...overrides,
  } as unknown as Request
}

function mockRes(): Response {
  const res: any = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res as Response
}

const next: NextFunction = jest.fn()

describe('authMiddleware', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls next with UnauthorizedError when no Authorization header', async () => {
    const req = mockReq()
    const res = mockRes()
    await authMiddleware(req, res, next)
    // UnauthorizedError is passed to next()
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }))
  })

  it('returns 401 with invalid JWT (JsonWebTokenError)', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer badtoken' } as any })
    const res = mockRes()
    const jwtError = new jwt.JsonWebTokenError('invalid token')
    ;(jwt.verify as jest.Mock).mockImplementation(() => { throw jwtError })
    await authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('calls next() with valid token and existing user', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer validtoken' } as any })
    const res = mockRes()
    ;(jwt.verify as jest.Mock).mockReturnValue({ userId: 'u1', role: 'pet_owner' })
    ;(database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'u1', role: 'pet_owner', is_active: true }] })

    await authMiddleware(req, res, next)
    expect(next).toHaveBeenCalled()
    expect((req as any).userId).toBe('u1')
    expect((req as any).userRole).toBe('pet_owner')
  })

  it('returns 401 when user not found in database', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer validtoken' } as any })
    const res = mockRes()
    ;(jwt.verify as jest.Mock).mockReturnValue({ userId: 'u1', role: 'pet_owner' })
    ;(database.query as jest.Mock).mockResolvedValue({ rows: [] })

    await authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })
})

describe('roleMiddleware', () => {
  it('calls next() when user role is allowed', () => {
    const middleware = roleMiddleware(['admin', 'veterinarian'])
    const req = mockReq() as any
    req.userRole = 'admin'
    const res = mockRes()
    middleware(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('returns 403 when user role is not allowed', () => {
    const middleware = roleMiddleware(['admin'])
    const req = mockReq() as any
    req.userRole = 'pet_owner'
    const res = mockRes()
    middleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('validateBody', () => {
  const testSchema = Joi.object({
    name: Joi.string().required(),
    age: Joi.number().integer().min(0),
  })

  it('calls next() and cleans body on valid input', async () => {
    const middleware = validateBody(testSchema)
    const req = mockReq({ body: { name: 'Alice', age: 30 } })
    const res = mockRes()
    await middleware(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.body).toEqual({ name: 'Alice', age: 30 })
  })

  it('returns 400 on invalid input', async () => {
    const middleware = validateBody(testSchema)
    const req = mockReq({ body: { age: -5 } })
    const res = mockRes()
    await middleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects unknown fields by default', async () => {
    const middleware = validateBody(testSchema)
    const req = mockReq({ body: { name: 'Bob', extraField: 'hack' } })
    const res = mockRes()
    await middleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(next).not.toHaveBeenCalled()
  })
})
