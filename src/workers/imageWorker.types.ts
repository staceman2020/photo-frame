import type { Orientation } from '../services/imageMeta';

export interface InitRequest {
  type: 'init';
  key: CryptoKey;
}

export interface AnalyzeRequest {
  type: 'analyze';
  id: string;
  file: File;
}

export interface ProcessRequest {
  type: 'process';
  id: string;
  file: File;
}

export type WorkerRequest = InitRequest | AnalyzeRequest | ProcessRequest;

export interface AnalyzeSuccess {
  type: 'analyze-result';
  id: string;
  ok: true;
  fingerprint: string;
  width: number;
  height: number;
  orientation: Orientation;
  mimeType: string;
  size: number;
}

export interface AnalyzeFailure {
  type: 'analyze-result';
  id: string;
  ok: false;
  error: string;
}

export type AnalyzeResponse = AnalyzeSuccess | AnalyzeFailure;

export interface ProcessSuccess {
  type: 'process-result';
  id: string;
  ok: true;
  original: ArrayBuffer;
  display: ArrayBuffer;
  thumb: ArrayBuffer;
}

export interface ProcessFailure {
  type: 'process-result';
  id: string;
  ok: false;
  error: string;
}

export type ProcessResponse = ProcessSuccess | ProcessFailure;

export type WorkerResponse = AnalyzeResponse | ProcessResponse;
