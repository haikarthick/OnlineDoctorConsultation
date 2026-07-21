/**
 * Storage Abstraction Layer
 *
 * Provides a unified interface for file storage with two backends:
 * 1. LocalStorage  – saves to disk (default, development)
 * 2. S3Storage     – ready for AWS S3 / MinIO (production)
 *
 * Switch backends via the STORAGE_DRIVER env var ('local' | 's3').
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import config, { getBackendUrl } from '../config';
import logger from './logger';

// ── Types ─────────────────────────────────────────────────────

export interface StoredFile {
  /** Original client filename */
  originalName: string;
  /** Server-side filename (unique) */
  fileName: string;
  /** MIME type */
  mimeType: string;
  /** Size in bytes */
  size: number;
  /** Public URL or relative path to reach the file */
  url: string;
  /** Storage key (path or S3 key) */
  key: string;
  /** Video duration in seconds — only set by drivers that can report it (Cloudinary) */
  duration?: number;
}

export interface StorageDriver {
  save(file: Express.Multer.File, folder: string): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

// ── Local Storage Driver ──────────────────────────────────────

const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')
);

class LocalStorage implements StorageDriver {
  constructor() {
    // Ensure base upload directory exists
    if (!fs.existsSync(UPLOAD_ROOT)) {
      fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    }
  }

  async save(file: Express.Multer.File, folder: string): Promise<StoredFile> {
    const dir = path.resolve(UPLOAD_ROOT, folder);
    // Guard against path traversal — resolved dir must stay inside UPLOAD_ROOT
    if (!dir.startsWith(UPLOAD_ROOT + path.sep) && dir !== UPLOAD_ROOT) {
      throw new Error('Invalid upload path');
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const destPath = path.join(dir, uniqueName);

    // multer memory-storage: file.buffer is available
    if (file.buffer) {
      fs.writeFileSync(destPath, file.buffer);
    } else if (file.path) {
      // disk-storage: move from temp to permanent location
      fs.renameSync(file.path, destPath);
    }

    const key = `${folder}/${uniqueName}`;
    return {
      originalName: file.originalname,
      fileName: uniqueName,
      mimeType: file.mimetype,
      size: file.size,
      url: `${getBackendUrl()}/uploads/${key}`,
      key,
    };
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(UPLOAD_ROOT, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  getUrl(key: string): string {
    return `${getBackendUrl()}/uploads/${key}`;
  }
}

// ── S3 Storage Driver (stub – wire up aws-sdk when ready) ─────

class S3Storage implements StorageDriver {
  private bucket: string;
  private region: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'vetcare-uploads';
    this.region = process.env.S3_REGION || 'us-east-1';
    logger.info(`S3 storage driver initialised – bucket=${this.bucket}, region=${this.region}`);
  }

  async save(file: Express.Multer.File, folder: string): Promise<StoredFile> {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const key = `${folder}/${uniqueName}`;

    // TODO: Replace with actual aws-sdk S3.putObject when ready
    // const s3 = new AWS.S3({ region: this.region });
    // await s3.putObject({ Bucket: this.bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }).promise();

    logger.warn('S3Storage.save() stub – file NOT uploaded. Install aws-sdk and implement putObject.');

    return {
      originalName: file.originalname,
      fileName: uniqueName,
      mimeType: file.mimetype,
      size: file.size,
      url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`,
      key,
    };
  }

  async delete(key: string): Promise<void> {
    // TODO: Replace with actual aws-sdk S3.deleteObject
    logger.warn(`S3Storage.delete() stub – key=${key} NOT deleted.`);
  }

  getUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

// ── Cloudinary Storage Driver ──────────────────────────────────
// Free-tier friendly: images are auto-optimized (format/quality/size-capped)
// on upload, videos are stored with auto quality so delivery adapts to the
// viewer's connection. Resource type (image vs video) is inferred from the
// upload folder — callers append '/video' for video uploads — so delete()
// knows which Cloudinary API to call without changing the StorageDriver
// interface.

const VIDEO_FOLDER_MARKER = '/video';

class CloudinaryStorage implements StorageDriver {
  private cloudinary: typeof import('cloudinary').v2;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { v2 } = require('cloudinary');
    this.cloudinary = v2;

    if (process.env.CLOUDINARY_URL) {
      // SDK auto-parses CLOUDINARY_URL (cloudinary://key:secret@cloud_name) — nothing else to do.
      this.cloudinary.config({ secure: true });
    } else {
      this.cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }
    logger.info(`Cloudinary storage driver initialised — cloud=${this.cloudinary.config().cloud_name || '(from CLOUDINARY_URL)'}`);
  }

  private isVideo(folder: string, mimetype: string): boolean {
    return folder.endsWith(VIDEO_FOLDER_MARKER) || mimetype.startsWith('video/');
  }

  async save(file: Express.Multer.File, folder: string): Promise<StoredFile> {
    const isVideo = this.isVideo(folder, file.mimetype);
    const resourceType = isVideo ? 'video' : 'image';

    const uploadOptions: Record<string, any> = {
      folder,
      resource_type: resourceType,
      // Unique, filesystem-safe public_id — Cloudinary would otherwise derive
      // one from the original filename, which can collide or leak PII.
      public_id: `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
    };
    if (isVideo) {
      // q_auto adapts bitrate/quality to the viewer's connection on delivery.
      uploadOptions.transformation = [{ quality: 'auto', fetch_format: 'auto' }];
    } else {
      // Cap the longest side at 1600px (matches the resize target proven out
      // by Craigslist/Facebook for user-submitted photos) and auto-optimize
      // format/quality so mobile viewers on slow connections aren't stuck
      // downloading full-resolution originals.
      uploadOptions.transformation = [
        { width: 1600, height: 1600, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' },
      ];
    }

    const result: any = await new Promise((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(uploadOptions, (err: any, res: any) => {
        if (err) reject(err); else resolve(res);
      });
      uploadStream.end(file.buffer);
    });

    return {
      originalName: file.originalname,
      fileName: `${result.public_id}.${result.format}`,
      mimeType: file.mimetype,
      size: result.bytes,
      url: result.secure_url,
      key: result.public_id,
      duration: typeof result.duration === 'number' ? result.duration : undefined,
    };
  }

  async delete(key: string): Promise<void> {
    const resourceType = key.includes(VIDEO_FOLDER_MARKER) ? 'video' : 'image';
    try {
      await this.cloudinary.uploader.destroy(key, { resource_type: resourceType });
    } catch (err: any) {
      logger.warn(`Cloudinary delete failed for key=${key}: ${err.message}`);
    }
  }

  getUrl(key: string): string {
    const resourceType = key.includes(VIDEO_FOLDER_MARKER) ? 'video' : 'image';
    return this.cloudinary.url(key, { resource_type: resourceType, secure: true });
  }
}

// ── Factory ───────────────────────────────────────────────────

function createStorageDriver(): StorageDriver {
  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  switch (driver) {
    case 'cloudinary':
      return new CloudinaryStorage();
    case 's3':
      return new S3Storage();
    case 'local':
    default:
      return new LocalStorage();
  }
}

const storage: StorageDriver = createStorageDriver();
export default storage;
