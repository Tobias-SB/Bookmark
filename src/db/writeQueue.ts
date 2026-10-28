import type { Db, SqlParams } from './Db';
import { guardDb } from './dbError';

type Enqueue = <T>(task: () => Promise<T>) => Promise<T>;

// One promise chain: each task starts after the previous settles, and a failure rejects only its own caller.
export function createWriteQueue(): Enqueue {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  };
}

/**
 * Wraps an unqueued connection into the `Db` port (spec §5.3): writes and transactions go through
 * one queue, reads run freely, and every failure becomes an AppError.
 */
export function withWriteQueue(connection: Db): Db {
  return wrap(connection, createWriteQueue());
}

// Inside a transaction there is no queue: the tx handle must not wait behind its own transaction.
function wrap(connection: Db, enqueue: Enqueue | null): Db {
  const write = <T>(task: () => Promise<T>) => (enqueue ? enqueue(() => guardDb(task)) : guardDb(task));
  const db: Db = {
    run: (sql, params) => write(() => connection.run(sql, params)),
    exec: (sql) => write(() => connection.exec(sql)),
    all: <T>(sql: string, params?: SqlParams) => guardDb(() => connection.all<T>(sql, params)),
    first: <T>(sql: string, params?: SqlParams) => guardDb(() => connection.first<T>(sql, params)),
    transaction: <T>(fn: (tx: Db) => Promise<T>) =>
      enqueue
        ? write(() => connection.transaction((tx) => fn(wrap(tx, null))))
        : // Nested transactions join the outer one.
          guardDb(() => fn(db)),
  };
  return db;
}
