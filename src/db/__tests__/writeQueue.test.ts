import { createWriteQueue } from '../writeQueue';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('createWriteQueue', () => {
  it('runs tasks one at a time, in submission order', async () => {
    const enqueue = createWriteQueue();
    const log: string[] = [];
    const task = (name: string, ms: number) => async () => {
      log.push(`start ${name}`);
      await tick(ms);
      log.push(`end ${name}`);
      return name;
    };

    const results = await Promise.all([enqueue(task('a', 30)), enqueue(task('b', 1)), enqueue(task('c', 10))]);

    expect(results).toEqual(['a', 'b', 'c']);
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('rejects only the failing caller and keeps going', async () => {
    const enqueue = createWriteQueue();
    const first = enqueue(async () => 1);
    const failing = enqueue(async () => {
      throw new Error('boom');
    });
    const after = enqueue(async () => 3);

    await expect(first).resolves.toBe(1);
    await expect(failing).rejects.toThrow('boom');
    await expect(after).resolves.toBe(3);
  });
});
