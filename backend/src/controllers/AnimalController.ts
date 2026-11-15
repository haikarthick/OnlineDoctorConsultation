import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import AnimalService from '../services/AnimalService';
import { ValidationError, ForbiddenError } from '../utils/errors';
import database from '../utils/database';
import AnimalGroupService from '../services/AnimalGroupService';
import logger from '../utils/logger';

export class AnimalController {
  /**
   * A farm and a group are tenant data. The caller must own the farm or be an active member of it
   * (or be a platform admin), and a group must belong to the farm it is paired with. Before this
   * check anyone could file an animal under any farm or group id they knew.
   */
  private async assertPlacementAllowed(req: AuthRequest, enterpriseId?: string | null, groupId?: string | null): Promise<void> {
    if (!enterpriseId && !groupId) return;
    if (req.userRole === 'admin') return;
    const access = `(e.owner_id = $2 OR EXISTS (SELECT 1 FROM enterprise_members em
                       WHERE em.enterprise_id = e.id AND em.user_id = $2 AND em.is_active = true))`;
    if (enterpriseId) {
      const ent = await database.query(`SELECT 1 FROM enterprises e WHERE e.id = $1 AND ${access} LIMIT 1`, [enterpriseId, req.userId]);
      if (ent.rows.length === 0) throw new ForbiddenError('You do not have access to that farm');
    }
    if (groupId) {
      const grp = await database.query(
        `SELECT ag.enterprise_id FROM animal_groups ag JOIN enterprises e ON e.id = ag.enterprise_id
          WHERE ag.id = $1 AND ${access} LIMIT 1`,
        [groupId, req.userId]
      );
      if (grp.rows.length === 0) throw new ForbiddenError('You do not have access to that group');
      if (enterpriseId && grp.rows[0].enterprise_id !== enterpriseId) {
        throw new ValidationError('That group belongs to a different farm. Choose a group from the selected farm.');
      }
    }
  }

  async createAnimal(req: AuthRequest, res: Response): Promise<void> {
    // The body has been through createAnimalSchema (unknown keys stripped), so the whole of it is
    // passed on. This used to copy a fixed subset, which silently dropped the animal's class,
    // sire, dam and breeding status - and would have dropped every production field too.
    const body = req.body;
    if (!body.name || !body.species) throw new ValidationError('Name and species are required');
    await this.assertPlacementAllowed(req, body.enterpriseId, body.groupId);

    const animal = await AnimalService.createAnimal(req.userId!, {
      ...body,
      enterpriseId: body.enterpriseId || undefined,
      groupId: body.groupId || undefined,
    });

    // Placing the animal in a group also opens its batch-membership window (batch groups) and
    // refreshes the head count the right way for the group's mode. The previous inline SQL
    // recounted animal rows, which resets a batch flock's headcount to zero.
    if (body.groupId) {
      try {
        await AnimalGroupService.assignAnimal(body.groupId, animal.id);
      } catch (err: any) {
        logger.warn('Animal created but group assignment follow-up failed', { animalId: animal.id, groupId: body.groupId, error: err.message });
      }
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
      result = await AnimalService.listAllAnimals(limit, offset);
    } else if (req.userRole === 'hospital_staff' || req.userRole === 'corporate_admin') {
      result = await AnimalService.listAnimalsForNetworkStaff(req.userId!, limit, offset);
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
    const placementTouched = req.body.groupId !== undefined || req.body.enterpriseId !== undefined;
    let previousGroupId: string | null = null;
    if (placementTouched) {
      await this.assertPlacementAllowed(req, req.body.enterpriseId || undefined, req.body.groupId || undefined);
      const prev = await database.query('SELECT group_id FROM animals WHERE id = $1', [req.params.id]);
      previousGroupId = prev.rows[0]?.group_id ?? null;
    }
    const updated = await AnimalService.updateAnimal(req.params.id, req.body);
    if (placementTouched) {
      const newGroupId: string | null = req.body.groupId || null;
      try {
        if (newGroupId) await AnimalGroupService.assignAnimal(newGroupId, req.params.id);
        // The group it left must recount too.
        if (previousGroupId && previousGroupId !== newGroupId) await AnimalGroupService.removeAnimal(previousGroupId, req.params.id);
      } catch (err: any) {
        logger.warn('Animal updated but group follow-up failed', { animalId: req.params.id, error: err.message });
      }
    }
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
