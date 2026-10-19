import test from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "../src/async";
import { PersistenceQueue } from "../src/persistence";

test("timeout helper preserves results and original failures", async () => {
  assert.equal(await withTimeout(Promise.resolve(42), 1000, "Timed out"), 42);
  const error = new Error("Original failure");
  await assert.rejects(
    withTimeout(Promise.reject(error), 1000, "Timed out"),
    (e) => e === error,
  );
});

test("timeout helper rejects stalled operations", async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), 1, "Location timed out"),
    /Location timed out/,
  );
});

test("failed saves are retryable and retain failures across unrelated successful writes", async () => {
  const notices: boolean[] = [];
  const queue = new PersistenceQueue((failed) => notices.push(failed));
  let available = false;
  let saved = "";
  await assert.rejects(
    queue.write("report", async () => {
      if (!available) throw new Error("Full storage");
      saved = "report";
    }),
  );
  await queue.write("profile", async () => {});
  await assert.rejects(queue.flush(), /not been saved/);
  available = true;
  await queue.retry();
  assert.equal(saved, "report");
  assert.equal(notices.at(-1), false);
});

test("a newer successful save supersedes a failed snapshot", async () => {
  const queue = new PersistenceQueue(() => {});
  let attempts = 0;
  await assert.rejects(
    queue.write("report", async () => {
      attempts++;
      throw new Error("Offline");
    }),
  );
  await queue.write("report", async () => {
    attempts++;
  });
  await queue.retry();
  assert.equal(attempts, 2);
});

test("writes are serialized and clearing removes failed retry operations", async () => {
  const queue = new PersistenceQueue(() => {});
  const order: number[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = queue.write("one", async () => {
    await gate;
    order.push(1);
  });
  const second = queue.write("two", async () => {
    order.push(2);
  });
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, [1, 2]);
  await assert.rejects(
    queue.write("failed", async () => {
      throw new Error("Full");
    }),
  );
  await queue.settled();
  queue.reset();
  await queue.retry();
  await queue.flush();
});
