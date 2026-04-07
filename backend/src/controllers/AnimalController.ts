import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import AnimalService from '../services/AnimalService';
import { ValidationError, ForbiddenError } from '../utils/errors';
import database from '../utils/database';

export class AnimalController {
  async createAnimal(req: AuthRequest, res: Response): Promise<void> {
    const { name, species, breed, dateOfBirth, gender, weight, color, microchipId,
            earTagId, registrationNumber, isNeutered, insuranceProvider, insurancePolicyNumber,
            insuranceExpiry, medicalNotes, enterpriseId, groupId } = req.body;
    if (!name || !species) throw new ValidationError('Name and species are required');

    const animal = await AnimalService.createAnimal(req.userId!, {
      name, species, breed, dateOfBirth, gender, weight, color, microchipId,
      earTagId, registrationNumber, isNeutered, insuranceProvider, insurancePolicyNumber,
      insuranceExpiry, medicalNotes, enterpriseId: enterpriseId || undefined,
      groupId: groupId || undefined,
    });

    // If assigned to a group, update the group's count
    if (groupId) {
      try {
        await database.query(
          `UPDATE animal_groups SET current_count = (SELECT COUNT(*) FROM animals WHERE group_id = $1 AND is_active = true), updated_at = NOW() WHERE id = $1`,
          [groupId]
        );
      } catch { /* non-critical */ }
    }

    res.status(201).json({ success: true, data: animal });
  }

  async getAnimal(req: AuthRequest, res: Response): Promise<void> {
    const animal = await AnimalService.getAnimal(req.params.id);
    if (animal.ownerId !== req.userId && req.userRole !== 'admin' && req.userRole !== 'veterinarian') {
      throw new ForbiddenError('You do not have permission to view this animal');
    }
    res.json({ success: true, data: animal });
  }

  async listAnimals(req: AuthRequest, res: Response): Promise<void> {
    const isAdminOrVet = req.userRole === 'admin' || req.userRole === 'veterinarian';
    const limit = Math.min(parseInt(req.query.limit as string) || 20, isAdminOrVet ? 500 : 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const ownerId = req.query.ownerId as string;

    // Vets/admins can request animals for a specific owner (for standalone prescription)
    if (ownerId && isAdminOrVet) {
      const result = await AnimalService.listAnimalsByOwner(ownerId, limit, offset);
      res.json({ success: true, data: result });
      return;
    }

    let result;
    if (req.userRole === 'veterinarian') {
      const view = req.query.view as string;
      if (view === 'patients') {
        // Vets see animals they've consulted with
        result = await AnimalService.listAnimalsByVeterinarian(req.userId!, limit, offset);
        if (result.total === 0) {
          result = await AnimalService.listAllAnimals(limit, offset);
        }
      } else {
        // Default: vet's own personal pets
        result = await AnimalService.listAnimalsByOwner(req.userId!, limit, offset);
      }
    } else if (req.userRole === 'admin') {
      // Admins see all animals
      result = await AnimalService.listAllAnimals(limit, offset);
    } else {
      // Pet owners/farmers see their own animals
      result = await AnimalService.listAnimalsByOwner(req.userId!, limit, offset);
    }
    res.json({ success: true, data: result });
  }

  async searchByUniqueId(req: AuthRequest, res: Response): Promise<void> {
    const uid = (req.query.uid as string || '').trim();
    if (!uid) {
      res.status(400).json({ success: false, error: 'uid query parameter is required' });
      return;
    }
    const animal = await AnimalService.searchByUniqueId(uid);
    if (!animal) {
      res.status(404).json({ success: false, error: `No animal found with ID ${uid}` });
      return;
    }
    res.json({ success: true, data: animal });
  }

  async updateAnimal(req: AuthRequest, res: Response): Promise<void> {
    const animal = await AnimalService.getAnimal(req.params.id);
    if (animal.ownerId !== req.userId && req.userRole !== 'admin') {
      throw new ForbiddenError('You do not have permission to update this animal');
    }
    // Veterinarians can only update their own animals (ownerId check above covers this)
    const updated = await AnimalService.updateAnimal(req.params.id, req.body);
    res.json({ success: true, data: updated });
  }

  async deleteAnimal(req: AuthRequest, res: Response): Promise<void> {
    const animal = await AnimalService.getAnimal(req.params.id);
    if (animal.ownerId !== req.userId && req.userRole !== 'admin') {
      throw new ForbiddenError('You do not have permission to delete this animal');
    }
    // Veterinarians can only delete their own animals (ownerId check above covers this)
    await AnimalService.deleteAnimal(req.params.id);
    res.json({ success: true, message: 'Animal removed' });
  }
}

export default new AnimalController();
