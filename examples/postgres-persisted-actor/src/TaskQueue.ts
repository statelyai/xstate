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

  async addTask(task: () => Promise<void>): Promise<void> {
    this.taskQueue.push(task);
    await this.processQueue();
  }
}
