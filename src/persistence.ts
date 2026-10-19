/** Serializes writes and retains failed operations for an explicit retry. */
export class PersistenceQueue {
  private tail: Promise<void> = Promise.resolve();
  private failed = new Map<string, () => Promise<void>>();

  constructor(private onFailureChange: (failed: boolean) => void) {}

  write(key: string, task: () => Promise<void>): Promise<void> {
    const pending = this.tail
      .catch(() => {})
      .then(async () => {
        try {
          await task();
          this.failed.delete(key);
        } catch (error) {
          this.failed.set(key, task);
          throw error;
        } finally {
          this.onFailureChange(this.failed.size > 0);
        }
      });
    this.tail = pending;
    return pending;
  }

  async flush(): Promise<void> {
    await this.tail;
    if (this.failed.size)
      throw new Error("Some changes have not been saved. Retry saving first.");
  }

  async retry(): Promise<void> {
    await this.settled();
    const retries = [...this.failed].map(([key, task]) =>
      this.write(key, task),
    );
    await Promise.all(retries);
    await this.flush();
  }

  async settled(): Promise<void> {
    let observed: Promise<void>;
    do {
      observed = this.tail;
      await observed.catch(() => {});
    } while (observed !== this.tail);
  }

  reset(): void {
    this.failed.clear();
    this.tail = Promise.resolve();
    this.onFailureChange(false);
  }
}
