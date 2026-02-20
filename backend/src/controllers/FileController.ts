/**
 * File Upload Controller
 *
 * Provides endpoints for uploading, listing, and deleting files.
 * Uses the storage abstraction so the backend is S3-ready.
 */

import { Request, Response } from 'express';
import storage, { StoredFile } from '../utils/storage';
import logger from '../utils/logger';

// In-memory file registry (replace with DB table in production)
const fileRegistry: Map<string, StoredFile & { uploadedBy: string; uploadedAt: string }> = new Map();

export class FileController {
  /**
   * POST /api/files/upload
   * Body: multipart/form-data with field "file" (single) and optional "folder"
   */
  static async upload(req: Request, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided. Use field name "file".' });
    }

    const folder = (req.body.folder as string) || 'general';
    const storedFile = await storage.save(req.file, folder);

    // Track in registry
    const record = {
      ...storedFile,
      uploadedBy: (req as any).user?.userId || 'anonymous',
      uploadedAt: new Date().toISOString(),
    };
    fileRegistry.set(storedFile.key, record);

    logger.info(`File uploaded: ${storedFile.key} by ${record.uploadedBy}`);
    return res.status(201).json(record);
  }

  /**
   * POST /api/files/upload-multiple
   * Body: multipart/form-data with field "files" (array, max 10) and optional "folder"
   */
  static async uploadMultiple(req: Request, res: Response) {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided. Use field name "files".' });
    }

    const folder = (req.body.folder as string) || 'general';
    const results: StoredFile[] = [];

    for (const file of files) {
      const storedFile = await storage.save(file, folder);
      const record = {
        ...storedFile,
        uploadedBy: (req as any).user?.userId || 'anonymous',
        uploadedAt: new Date().toISOString(),
      };
      fileRegistry.set(storedFile.key, record);
      results.push(storedFile);
    }

    logger.info(`${results.length} files uploaded to ${folder}`);
    return res.status(201).json({ files: results });
  }

  /**
   * GET /api/files
   * List uploaded files (optionally filter by folder query param)
   */
  static async list(req: Request, res: Response) {
    const folder = req.query.folder as string | undefined;
    let files = Array.from(fileRegistry.values());
    if (folder) {
      files = files.filter(f => f.key.startsWith(`${folder}/`));
    }
    return res.json({ files, total: files.length });
  }

  /**
   * DELETE /api/files/:key(*)
   * Delete a file by its storage key
   */
  static async remove(req: Request, res: Response) {
    const key = req.params[0] || req.params.key;
    if (!key) {
      return res.status(400).json({ error: 'File key is required.' });
    }

    if (!fileRegistry.has(key)) {
      return res.status(404).json({ error: 'File not found.' });
    }

    await storage.delete(key);
    fileRegistry.delete(key);
    logger.info(`File deleted: ${key}`);
    return res.json({ message: 'File deleted successfully.' });
  }
}
