import { Request, Response } from 'express';
import CertificateService from '../services/CertificateService';
import logger from '../utils/logger';

class CertificateController {
  async createCertificate(req: Request, res: Response): Promise<void> {
    try {
      const vetId = (req as any).user?.id;
      const role = (req as any).user?.role;
      if (role !== 'veterinarian' && role !== 'admin') {
        res.status(403).json({ success: false, error: 'Only veterinarians can create certificates' });
        return;
      }
      const cert = await CertificateService.create(vetId, req.body);
      res.status(201).json({ success: true, data: cert });
    } catch (err: any) {
      logger.error('createCertificate error', { error: err.message });
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async getMyCertificates(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const role = (req as any).user?.role;
      const params = {
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0,
        type: req.query.type as string | undefined,
        status: req.query.status as string | undefined,
        animalId: req.query.animalId as string | undefined,
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
        // pet_owner or farmer
        result = await CertificateService.listByOwner(userId, params);
      }

      res.json({ success: true, data: result });
    } catch (err: any) {
      logger.error('getMyCertificates error', { error: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getCertificatesByAnimal(req: Request, res: Response): Promise<void> {
    try {
      const { animalId } = req.params;
      const result = await CertificateService.listByAnimal(animalId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      logger.error('getCertificatesByAnimal error', { error: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getCertificate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const role = (req as any).user?.role;

      const cert = await CertificateService.getById(id);
      if (!cert) {
        res.status(404).json({ success: false, error: 'Certificate not found' });
        return;
      }

      // Access control: vet who created it, owner it was issued to, or admin
      const isVet = cert.veterinarianId === userId;
      const isOwner = cert.petOwnerId === userId;
      const isAdmin = role === 'admin';
      if (!isVet && !isOwner && !isAdmin) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      res.json({ success: true, data: cert });
    } catch (err: any) {
      logger.error('getCertificate error', { error: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async updateCertificate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const vetId = (req as any).user?.id;
      const role = (req as any).user?.role;
      if (role !== 'veterinarian' && role !== 'admin') {
        res.status(403).json({ success: false, error: 'Only veterinarians can update certificates' });
        return;
      }
      const cert = await CertificateService.update(id, vetId, role, req.body);
      res.json({ success: true, data: cert });
    } catch (err: any) {
      logger.error('updateCertificate error', { error: err.message });
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async issueCertificate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const vetId = (req as any).user?.id;
      const role = (req as any).user?.role;
      if (role !== 'veterinarian' && role !== 'admin') {
        res.status(403).json({ success: false, error: 'Only veterinarians can issue certificates' });
        return;
      }
      const cert = await CertificateService.issue(id, vetId, role);
      res.json({ success: true, data: cert });
    } catch (err: any) {
      logger.error('issueCertificate error', { error: err.message });
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async revokeCertificate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const vetId = (req as any).user?.id;
      const role = (req as any).user?.role;
      if (role !== 'veterinarian' && role !== 'admin') {
        res.status(403).json({ success: false, error: 'Only veterinarians can revoke certificates' });
        return;
      }
      const { reason } = req.body;
      if (!reason) {
        res.status(400).json({ success: false, error: 'Revocation reason is required' });
        return;
      }
      const cert = await CertificateService.revoke(id, vetId, role, reason);
      res.json({ success: true, data: cert });
    } catch (err: any) {
      logger.error('revokeCertificate error', { error: err.message });
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async deleteCertificate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const vetId = (req as any).user?.id;
      const role = (req as any).user?.role;
      if (role !== 'veterinarian' && role !== 'admin') {
        res.status(403).json({ success: false, error: 'Only veterinarians can delete certificates' });
        return;
      }
      await CertificateService.deleteDraft(id, vetId, role);
      res.json({ success: true, message: 'Certificate draft deleted' });
    } catch (err: any) {
      logger.error('deleteCertificate error', { error: err.message });
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

export default new CertificateController();
