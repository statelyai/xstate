/** An ordered queue whose entries can be removed without retaining cancelled work. @internal */
export class IndexedHeap<T extends object> {
  private readonly entries: T[] = [];
  private readonly indices = new Map<T, number>();

  constructor(private readonly before: (a: T, b: T) => boolean) {}

  push(entry: T) {
    this.entries.push(entry);
    this.up(this.entries.length - 1, entry);
  }

  peek(): T | undefined {
    return this.entries[0];
  }

  pop(): T | undefined {
    const first = this.peek();
    if (first) this.remove(first);
    return first;
  }

  remove(entry: T) {
    const index = this.indices.get(entry);
    if (index === undefined) return;
    const last = this.entries.pop()!;
    this.indices.delete(entry);
    if (index === this.entries.length) return;
    if (index > 0 && this.before(last, this.entries[(index - 1) >> 1])) {
      this.up(index, last);
    } else {
      this.down(index, last);
    }
  }

  private up(index: number, entry: T) {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.before(entry, this.entries[parent])) break;
      this.place(index, this.entries[parent]);
      index = parent;
    }
    this.place(index, entry);
  }

  private down(index: number, entry: T) {
    while (index * 2 + 1 < this.entries.length) {
      let child = index * 2 + 1;
      if (
        child + 1 < this.entries.length &&
        this.before(this.entries[child + 1], this.entries[child])
      )
        child++;
      if (!this.before(this.entries[child], entry)) break;
      this.place(index, this.entries[child]);
      index = child;
    }
    this.place(index, entry);
  }

  private place(index: number, entry: T) {
    this.entries[index] = entry;
    this.indices.set(entry, index);
  }
}
