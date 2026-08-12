export async function processMessagesIndependently<Item>(
  items: Item[],
  process: (item: Item) => Promise<void>,
  concurrency = 2,
) {
  const failures: Array<{ item: Item; error: string }> = [];
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const item = items[nextIndex++];
      try {
        await process(item);
      } catch (error) {
        failures.push({
          item,
          error: error instanceof Error ? error.message : "message_processing_failed",
        });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker));
  return failures;
}
