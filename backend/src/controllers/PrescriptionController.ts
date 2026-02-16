import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PrescriptionService from '../services/PrescriptionService';
import { ForbiddenError, ValidationError } from '../utils/errors';

class PrescriptionController {
  async createPrescription(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'veterinarian' && authReq.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians can create prescriptions');
    }

    const prescription = await PrescriptionService.createPrescription(authReq.userId!, req.body);
    res.status(201).json({ success: true, data: prescription });
  }

  async getPrescription(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const prescription = await PrescriptionService.getPrescription(req.params.id);

    // Allow vet, pet owner, or admin
    if (prescription.veterinarianId !== authReq.userId && 
        prescription.petOwnerId !== authReq.userId && 
        authReq.userRole !== 'admin') {
      throw new ForbiddenError('Not authorized to view this prescription');
    }

    res.json({ success: true, data: prescription });
  }

  async listByConsultation(req: Request, res: Response) {
    const prescriptions = await PrescriptionService.listByConsultation(req.params.consultationId);
    res.json({ success: true, data: prescriptions });
  }

  async listMyPrescriptions(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const params = {
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0
    };

    let prescriptions;
    if (authReq.userRole === 'veterinarian') {
      prescriptions = await PrescriptionService.listByVeterinarian(authReq.userId!, params);
    } else {
      prescriptions = await PrescriptionService.listByPetOwner(authReq.userId!, params);
    }
    res.json({ success: true, data: prescriptions });
  }

  async deactivatePrescription(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'veterinarian' && authReq.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians can deactivate prescriptions');
    }

    const prescription = await PrescriptionService.deactivatePrescription(req.params.id);
    res.json({ success: true, data: prescription });
  }
}

export default new PrescriptionController();
