/** Tasks run in submission order. A failure rejects that task without blocking later tasks. */
export class TaskQueue {
  private tail = Promise.resolve();

  addTask(task: () => Promise<void>): Promise<void> {
    const result = this.tail.then(task);
    this.tail = result.catch(() => {});
    return result;
  }

  flush(): Promise<void> {
    return this.tail;
  }
}
