import type { AnalyzeResponse, ProcessResponse, WorkerRequest, WorkerResponse } from './imageWorker.types';

interface PendingTask {
  resolve: (value: WorkerResponse) => void;
}

/**
 * A small fixed pool of imageWorker.ts instances. The pool size doubles as
 * the upload pipeline's concurrency limit — see uploadService.ts.
 */
export class ImageWorkerPool {
  private workers: Worker[];
  private idle: Worker[];
  private queue: Array<() => void> = [];
  private pending = new Map<string, PendingTask>();
  private nextId = 0;

  constructor(size = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2))) {
    this.workers = Array.from({ length: size }, () => this.createWorker());
    this.idle = [...this.workers];
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL('./imageWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handleMessage(worker, event.data);
    return worker;
  }

  init(key: CryptoKey): void {
    this.workers.forEach((worker) => worker.postMessage({ type: 'init', key }));
  }

  analyze(file: File): Promise<AnalyzeResponse> {
    return this.dispatch((id) => ({ type: 'analyze', id, file })) as Promise<AnalyzeResponse>;
  }

  process(file: File): Promise<ProcessResponse> {
    return this.dispatch((id) => ({ type: 'process', id, file })) as Promise<ProcessResponse>;
  }

  private dispatch(build: (id: string) => WorkerRequest): Promise<WorkerResponse> {
    return new Promise((resolve) => {
      const id = String(this.nextId++);
      this.pending.set(id, { resolve });
      const send = () => {
        const worker = this.idle.pop();
        if (!worker) return;
        worker.postMessage(build(id));
      };
      if (this.idle.length > 0) send();
      else this.queue.push(send);
    });
  }

  private handleMessage(worker: Worker, data: WorkerResponse): void {
    const task = this.pending.get(data.id);
    this.pending.delete(data.id);
    this.idle.push(worker);
    const next = this.queue.shift();
    if (next) next();
    task?.resolve(data);
  }

  terminate(): void {
    this.workers.forEach((worker) => worker.terminate());
  }
}
