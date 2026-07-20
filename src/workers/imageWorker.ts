/// <reference lib="webworker" />
import { combineIvAndCiphertext, encrypt as encryptBytes } from '../services/aesGcm';
import { classifyOrientation } from '../services/imageMeta';
import type { AnalyzeResponse, ProcessResponse, WorkerRequest } from './imageWorker.types';

// tsconfig.app.json mixes the "DOM" and "WebWorker" libs (needed because
// most of the app runs on the main thread), which makes the ambient `self`
// type ambiguous between Window and DedicatedWorkerGlobalScope. Re-typing it
// once here avoids sprinkling casts through the rest of the file.
const ctx = self as unknown as DedicatedWorkerGlobalScope;

const DISPLAY_LONG_EDGE = 2560;
const THUMB_LONG_EDGE = 400;
const DISPLAY_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;

let masterKey: CryptoKey | null = null;

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function renderDerivative(
  bitmap: ImageBitmap,
  longEdge: number,
  quality: number,
): Promise<Blob> {
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const drawCtx = canvas.getContext('2d');
  if (!drawCtx) throw new Error('2D canvas context unavailable.');
  drawCtx.drawImage(bitmap, 0, 0, width, height);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error('File does not appear to be a valid image.');
  }
}

async function handleAnalyze(id: string, file: File): Promise<AnalyzeResponse> {
  try {
    const bitmap = await decodeImage(file);
    const { width, height } = bitmap;
    bitmap.close();
    const buffer = await file.arrayBuffer();
    const fingerprint = await sha256Hex(buffer);
    return {
      type: 'analyze-result',
      id,
      ok: true,
      fingerprint,
      width,
      height,
      orientation: classifyOrientation(width, height),
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    };
  } catch (err) {
    return {
      type: 'analyze-result',
      id,
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to analyze file.',
    };
  }
}

async function handleProcess(
  id: string,
  file: File,
): Promise<{ response: ProcessResponse; transfer: ArrayBuffer[] }> {
  if (!masterKey) {
    return {
      response: { type: 'process-result', id, ok: false, error: 'Worker not initialized.' },
      transfer: [],
    };
  }
  try {
    const originalBuffer = await file.arrayBuffer();
    const originalEncrypted = combineIvAndCiphertext(await encryptBytes(masterKey, originalBuffer));

    const bitmap = await decodeImage(file);
    const [displayBlob, thumbBlob] = await Promise.all([
      renderDerivative(bitmap, DISPLAY_LONG_EDGE, DISPLAY_QUALITY),
      renderDerivative(bitmap, THUMB_LONG_EDGE, THUMB_QUALITY),
    ]);
    bitmap.close();

    const [displayBuffer, thumbBuffer] = await Promise.all([
      displayBlob.arrayBuffer(),
      thumbBlob.arrayBuffer(),
    ]);
    const displayEncrypted = combineIvAndCiphertext(await encryptBytes(masterKey, displayBuffer));
    const thumbEncrypted = combineIvAndCiphertext(await encryptBytes(masterKey, thumbBuffer));

    return {
      response: {
        type: 'process-result',
        id,
        ok: true,
        original: originalEncrypted,
        display: displayEncrypted,
        thumb: thumbEncrypted,
      },
      transfer: [originalEncrypted, displayEncrypted, thumbEncrypted],
    };
  } catch (err) {
    return {
      response: {
        type: 'process-result',
        id,
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to process file.',
      },
      transfer: [],
    };
  }
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === 'init') {
    // A CryptoKey survives structured clone as a fully usable key in this
    // realm — no re-import needed. See ARCHITECTURE.md §4.2 (Web Worker
    // encryption) and §7.1 (non-extractable-key hardening uses this same
    // clone-to-worker property).
    masterKey = message.key;
    return;
  }
  if (message.type === 'analyze') {
    const response = await handleAnalyze(message.id, message.file);
    ctx.postMessage(response);
    return;
  }
  if (message.type === 'process') {
    const { response, transfer } = await handleProcess(message.id, message.file);
    ctx.postMessage(response, transfer);
  }
};
