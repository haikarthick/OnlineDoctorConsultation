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
import config from '../config';
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
    const dir = path.join(UPLOAD_ROOT, folder);
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
      url: `/uploads/${key}`,
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
    return `/uploads/${key}`;
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

// ── Factory ───────────────────────────────────────────────────

function createStorageDriver(): StorageDriver {
  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  switch (driver) {
    case 's3':
      return new S3Storage();
    case 'local':
    default:
      return new LocalStorage();
  }
}

const storage: StorageDriver = createStorageDriver();
export default storage;
