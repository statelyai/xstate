export class TaskQueue {
  private taskQueue: (() => Promise<void>)[] = [];
  private status: 'idle' | 'processing' = 'idle';

  private async processQueue(): Promise<void> {
    if (this.status === 'processing') return;
    this.status = 'processing';

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (task) await task();
    }
    this.status = 'idle';
  }

  // Returns `void`: callers enqueue from synchronous subscriber callbacks and
  // never await the drain.
  addTask(task: () => Promise<void>): void {
    this.taskQueue.push(task);
    void this.processQueue();
  }
}
