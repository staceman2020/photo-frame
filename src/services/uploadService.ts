import { createPhoto, getPhotoExists } from './firestore/photoService';
import { uploadEncryptedVariant } from './storage/photoStorage';
import type { ImageWorkerPool } from '../workers/workerPool';

export type UploadStage = 'analyzing' | 'checking' | 'processing' | 'uploading' | 'finalizing';

export interface UploadOutcome {
  status: 'duplicate' | 'rejected' | 'done' | 'failed';
  photoId?: string;
  reason?: string;
}

export interface RunUploadOptions {
  uid: string;
  secure: boolean;
  pool: ImageWorkerPool;
  onStage: (stage: UploadStage) => void;
}

/** Mirrors ARCHITECTURE.md §6.1's upload pipeline steps 2–8. */
export async function runUpload(file: File, options: RunUploadOptions): Promise<UploadOutcome> {
  const { uid, secure, pool, onStage } = options;

  onStage('analyzing');
  const analysis = await pool.analyze(file);
  if (!analysis.ok) {
    return { status: 'rejected', reason: analysis.error };
  }

  onStage('checking');
  const exists = await getPhotoExists(uid, analysis.fingerprint);
  if (exists) {
    return { status: 'duplicate', photoId: analysis.fingerprint };
  }

  onStage('processing');
  const processed = await pool.process(file);
  if (!processed.ok) {
    return { status: 'failed', reason: processed.error };
  }

  onStage('uploading');
  try {
    await Promise.all([
      uploadEncryptedVariant(uid, analysis.fingerprint, 'original', processed.original),
      uploadEncryptedVariant(uid, analysis.fingerprint, 'display', processed.display),
      uploadEncryptedVariant(uid, analysis.fingerprint, 'thumb', processed.thumb),
    ]);

    onStage('finalizing');
    await createPhoto(uid, analysis.fingerprint, {
      fingerprint: analysis.fingerprint,
      fileName: file.name,
      mimeType: analysis.mimeType,
      bytes: analysis.size,
      width: analysis.width,
      height: analysis.height,
      orientation: analysis.orientation,
      secure,
    });
  } catch (err) {
    return { status: 'failed', reason: err instanceof Error ? err.message : 'Upload failed.' };
  }

  return { status: 'done', photoId: analysis.fingerprint };
}
