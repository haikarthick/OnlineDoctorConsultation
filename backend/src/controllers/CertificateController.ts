import { Request, Response } from 'express';
import CertificateService from '../services/CertificateService';
import { ForbiddenError, ValidationError, NotFoundError } from '../utils/errors';

// CertificateService throws plain Error('Certificate not found' | 'Unauthorized' | <validation
// message>) rather than AppError subclasses — translate to the right status/shape here so
// asyncHandler's generic 500 fallback doesn't swallow the real message.
function rethrowServiceError(err: any): never {
  if (err instanceof Error && err.message === 'Certificate not found') throw new NotFoundError('Certificate');
  if (err instanceof Error && err.message === 'Unauthorized') throw new ForbiddenError(err.message);
  throw new ValidationError(err?.message || 'Certificate operation failed');
}

class CertificateController {
  async createCertificate(req: Request, res: Response): Promise<void> {
    const vetId = (req as any).userId;
    const role = (req as any).userRole;
    if (role !== 'veterinarian' && role !== 'admin') {
      throw new ForbiddenError('Only veterinarians can create certificates');
    }
    try {
      const cert = await CertificateService.create(vetId, req.body);
      res.status(201).json({ success: true, data: cert });
    } catch (err: any) {
      rethrowServiceError(err);
    }
  }

  async getMyCertificates(req: Request, res: Response): Promise<void> {
    const userId = (req as any).userId;
    const role = (req as any).userRole;
    const params = {
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
      type: req.query.type as string | undefined,
      status: req.query.status as string | undefined,
      animalId: req.query.animalId as string | undefined,
      enterpriseId: req.query.enterpriseId as string | undefined,
    };

    let result: any;
    if (role === 'veterinarian') {
      result = await CertificateService.listByVet(userId, params);
    } else if (role === 'admin') {
      result = await CertificateService.listAll({
        ...params,
        search: req.query.search as string | undefined,
      });
    } else {
      // pet_owner or farmer — pass enterpriseId filter
      result = await CertificateService.listByOwner(userId, params);
    }

    res.json({ success: true, data: result });
  }

  async getCertificatesByAnimal(req: Request, res: Response): Promise<void> {
    const { animalId } = req.params;
    const result = await CertificateService.listByAnimal(animalId);
    res.json({ success: true, data: result });
  }

  async getCertificate(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = (req as any).userId;
    const role = (req as any).userRole;

    const cert = await CertificateService.getById(id);
    if (!cert) {
      throw new NotFoundError('Certificate', id);
    }

    // Access control: vet who created it, owner it was issued to, or admin
    const isVet = cert.veterinarianId === userId;
    const isOwner = cert.petOwnerId === userId;
    const isAdmin = role === 'admin';
    if (!isVet && !isOwner && !isAdmin) {
      throw new ForbiddenError('Access denied');
    }

    res.json({ success: true, data: cert });
  }

  async updateCertificate(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const vetId = (req as any).userId;
    const role = (req as any).userRole;
    if (role !== 'veterinarian' && role !== 'admin') {
      throw new ForbiddenError('Only veterinarians can update certificates');
    }
    try {
      const cert = await CertificateService.update(id, vetId, role, req.body);
      res.json({ success: true, data: cert });
    } catch (err: any) {
      rethrowServiceError(err);
    }
  }

  async issueCertificate(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const vetId = (req as any).userId;
    const role = (req as any).userRole;
    if (role !== 'veterinarian' && role !== 'admin') {
      throw new ForbiddenError('Only veterinarians can issue certificates');
    }
    try {
      const cert = await CertificateService.issue(id, vetId, role);
      res.json({ success: true, data: cert });
    } catch (err: any) {
      rethrowServiceError(err);
    }
  }

  async revokeCertificate(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const vetId = (req as any).userId;
    const role = (req as any).userRole;
    if (role !== 'veterinarian' && role !== 'admin') {
      throw new ForbiddenError('Only veterinarians can revoke certificates');
    }
    const { reason } = req.body;
    if (!reason) {
      throw new ValidationError('Revocation reason is required');
    }
    try {
      const cert = await CertificateService.revoke(id, vetId, role, reason);
      res.json({ success: true, data: cert });
    } catch (err: any) {
      rethrowServiceError(err);
    }
  }

  async deleteCertificate(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const vetId = (req as any).userId;
    const role = (req as any).userRole;
    if (role !== 'veterinarian' && role !== 'admin') {
      throw new ForbiddenError('Only veterinarians can delete certificates');
    }
    try {
      await CertificateService.deleteDraft(id, vetId, role);
      res.json({ success: true, message: 'Certificate draft deleted' });
    } catch (err: any) {
      rethrowServiceError(err);
    }
  }
}

export default new CertificateController();
