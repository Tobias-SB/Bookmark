import { isAppError } from '@/shared/types/errors';

import type { Db } from '../Db';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const values = (db: Db) => db.all<{ v: string }>('SELECT v FROM t ORDER BY rowid').then((rows) => rows.map((r) => r.v));

/** Behaviour every `Db` implementation must share (spec §5.3). */
export function describeDbContract(name: string, create: () => Promise<Db>) {
  describe(`${name} satisfies the Db port`, () => {
    let db: Db;

    beforeEach(async () => {
      db = await create();
      await db.exec('CREATE TABLE t (v TEXT NOT NULL)');
    });

    it('runs, reads and counts changes', async () => {
      await expect(db.run('INSERT INTO t (v) VALUES (?), (?)', ['a', 'b'])).resolves.toEqual({ changes: 2 });
      await expect(db.all('SELECT v FROM t ORDER BY v')).resolves.toEqual([{ v: 'a' }, { v: 'b' }]);
      await expect(db.first('SELECT v FROM t WHERE v = ?', ['b'])).resolves.toEqual({ v: 'b' });
      await expect(db.first('SELECT v FROM t WHERE v = ?', ['z'])).resolves.toBeNull();
    });

    it('binds named params written expo-sqlite style', async () => {
      await db.run('INSERT INTO t (v) VALUES ($v)', { $v: 'named' });
      await expect(db.first('SELECT v FROM t WHERE v = $v', { $v: 'named' })).resolves.toEqual({ v: 'named' });
    });

    it('commits a transaction and returns its value', async () => {
      const result = await db.transaction(async (tx) => {
        await tx.run('INSERT INTO t (v) VALUES (?)', ['in-tx']);
        return 42;
      });
      expect(result).toBe(42);
      await expect(values(db)).resolves.toEqual(['in-tx']);
    });

    it('rolls back a throwing transaction and keeps the queue running', async () => {
      await expect(
        db.transaction(async (tx) => {
          await tx.run('INSERT INTO t (v) VALUES (?)', ['lost']);
          throw new Error('boom');
        }),
      ).rejects.toMatchObject({ code: 'db' });
      await db.run('INSERT INTO t (v) VALUES (?)', ['after']);
      await expect(values(db)).resolves.toEqual(['after']);
    });

    it('passes an AppError thrown inside a transaction through unchanged', async () => {
      const validation = { code: 'validation', message: 'bad input' };
      await expect(
        db.transaction(async () => {
          throw validation;
        }),
      ).rejects.toEqual(validation);
    });

    it('joins a nested transaction to the outer one', async () => {
      await expect(
        db.transaction(async (tx) => {
          await tx.transaction((inner) => inner.run('INSERT INTO t (v) VALUES (?)', ['nested']));
          throw new Error('outer fails');
        }),
      ).rejects.toMatchObject({ code: 'db' });
      await expect(values(db)).resolves.toEqual([]);
    });

    it('maps driver errors to AppError without leaking SQL', async () => {
      const error: unknown = await db.run('INSERT INTO missing_table VALUES (1)').catch((e: unknown) => e);
      expect(isAppError(error)).toBe(true);
      expect(error).toMatchObject({ code: 'db' });
      expect(JSON.stringify(error)).not.toMatch(/missing_table|INSERT/);
      await expect(db.all('SELEC nonsense')).rejects.toMatchObject({ code: 'db' });
    });

    it('runs writes in submission order, even behind a slow transaction', async () => {
      const gate = deferred();
      const slow = db.transaction(async (tx) => {
        await tx.run('INSERT INTO t (v) VALUES (?)', ['first']);
        await gate.promise;
      });
      let laterDone = false;
      const later = db.run('INSERT INTO t (v) VALUES (?)', ['second']).then(() => {
        laterDone = true;
      });

      await new Promise((r) => setTimeout(r, 20));
      expect(laterDone).toBe(false);

      gate.resolve();
      await Promise.all([slow, later]);
      await expect(values(db)).resolves.toEqual(['first', 'second']);
    });

    it('does not block reads behind a slow write', async () => {
      await db.run('INSERT INTO t (v) VALUES (?)', ['existing']);
      const gate = deferred();
      const slow = db.transaction(async () => {
        await gate.promise;
      });

      await expect(db.first('SELECT count(*) AS n FROM t')).resolves.toEqual({ n: 1 });

      gate.resolve();
      await slow;
    });
  });
}
