/**
 * File Upload Middleware
 *
 * Configures multer with memory storage (works with both local and S3 drivers).
 * Provides pre-configured upload middlewares for common use-cases.
 */

import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import path from 'path';

// ── Allowed MIME types ────────────────────────────────────────

// SVG intentionally excluded - served via /uploads without content-type override,
// making it a stored XSS vector when opened directly in the browser.
const IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
];

const VIDEO_MIMES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const ALL_ALLOWED = [...IMAGE_MIMES, ...DOCUMENT_MIMES];

// ── File filter factory ───────────────────────────────────────

function createFileFilter(allowedMimes: string[]) {
  return (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}. Allowed: ${allowedMimes.join(', ')}`));
    }
  };
}

// ── Multer instances ──────────────────────────────────────────

const memoryStorage = multer.memoryStorage();

/** General file upload - images & documents, max 10 MB */
export const uploadAny = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: createFileFilter(ALL_ALLOWED),
});

/** Image-only upload, max 5 MB */
export const uploadImage = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: createFileFilter(IMAGE_MIMES),
});

/** Document-only upload, max 20 MB */
export const uploadDocument = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: createFileFilter(DOCUMENT_MIMES),
});

/**
 * Video-only upload, max 100 MB.
 * 100 MB is a coarse pre-gate against obviously oversized files - the real
 * limit is duration (60s), checked server-side after upload since multer
 * can't read a video's length from the raw bytes.
 */
export const uploadVideo = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: createFileFilter(VIDEO_MIMES),
});

export { IMAGE_MIMES, DOCUMENT_MIMES, VIDEO_MIMES, ALL_ALLOWED };
