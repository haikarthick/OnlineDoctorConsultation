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

// Hard cap on listing video length — keeps a single upload's Cloudinary
// storage+bandwidth credits small and matches what a farmer can realistically
// capture/upload on a mobile connection to show an animal's condition.
const MAX_VIDEO_DURATION_SECONDS = 60;

export class FileController {
  /**
   * POST /api/files/upload
   * Body: multipart/form-data with field "file" (single) and optional "folder"
   */
  static async upload(req: Request, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided. Use field name "file".' });
    }

    const folder = String(req.body.folder || 'general');
    if (!/^[a-z0-9_/-]{1,80}$/i.test(folder) || folder.includes('..')) {
      return res.status(400).json({ error: 'Invalid folder name' });
    }
    const storedFile = await storage.save(req.file, folder);

    // Track in registry
    const record = {
      ...storedFile,
      uploadedBy: (req as any).userId || 'anonymous',
      uploadedAt: new Date().toISOString(),
    };
    fileRegistry.set(storedFile.key, record);

    logger.info(`File uploaded: ${storedFile.key} by ${record.uploadedBy}`);
    return res.status(201).json(record);
  }

  /**
   * POST /api/files/upload-video
   * Body: multipart/form-data with field "file" (single) and optional "folder"
   * Enforces a max duration server-side (multer can only bound file size,
   * not length) — if the uploaded video is too long, it's deleted from
   * storage immediately and the request is rejected, so we never bill
   * storage/bandwidth credits for a rejected upload.
   */
  static async uploadVideo(req: Request, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No file provided. Use field name "file".' } });
    }

    const folder = String(req.body.folder || 'general');
    if (!/^[a-z0-9_/-]{1,80}$/i.test(folder) || folder.includes('..')) {
      return res.status(400).json({ error: { message: 'Invalid folder name' } });
    }

    const storedFile = await storage.save(req.file, `${folder}/video`);

    if (typeof storedFile.duration === 'number' && storedFile.duration > MAX_VIDEO_DURATION_SECONDS) {
      const deleted = await storage.delete(storedFile.key);
      if (!deleted) {
        // storage.delete() already warn-logs the underlying error — this is a distinct,
        // higher-severity log specifically for "an oversized video is now permanently
        // parked in storage consuming credits with nothing left to retry the delete,"
        // since the client only ever sees a generic 400 and has no reason to retry.
        logger.error(`Orphaned rejected video left in storage — delete failed for key=${storedFile.key}, duration=${storedFile.duration}s, uploadedBy=${(req as any).userId || 'anonymous'}`);
      }
      return res.status(400).json({
        error: {
          code: 'VIDEO_TOO_LONG',
          message: `Video is ${Math.round(storedFile.duration)}s — max allowed is ${MAX_VIDEO_DURATION_SECONDS}s.`,
          maxSeconds: MAX_VIDEO_DURATION_SECONDS,
        },
      });
    }

    const record = {
      ...storedFile,
      uploadedBy: (req as any).userId || 'anonymous',
      uploadedAt: new Date().toISOString(),
    };
    fileRegistry.set(storedFile.key, record);

    logger.info(`Video uploaded: ${storedFile.key} by ${record.uploadedBy} (${storedFile.duration ?? '?'}s)`);
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

    const folder = String(req.body.folder || 'general');
    if (!/^[a-z0-9_/-]{1,80}$/i.test(folder) || folder.includes('..')) {
      return res.status(400).json({ error: 'Invalid folder name' });
    }
    const results: StoredFile[] = [];

    for (const file of files) {
      const storedFile = await storage.save(file, folder);
      const record = {
        ...storedFile,
        uploadedBy: (req as any).userId || 'anonymous',
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
