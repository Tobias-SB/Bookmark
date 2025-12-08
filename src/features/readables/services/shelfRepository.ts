// src/features/readables/services/shelfRepository.ts
import { getAllAsync, getFirstAsync, runAsync } from '@src/db/sqlite';
import type { SmartShelfRow } from '@src/db/schema/smartShelves.schema';
import {
  buildSmartShelfInsertRow,
  buildSmartShelfUpdateRow,
  mapSmartShelfRowToDomain,
  type CreateSmartShelfInput,
  type SmartShelf,
  type SmartShelfId,
  type UpdateSmartShelfInput,
} from '../types/smartShelves';

/**
 * Generate a simple unique ID. Same idea as readableRepository, good enough for local-only data.
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getAll(): Promise<SmartShelf[]> {
  const rows = await getAllAsync<SmartShelfRow>(
    `
    SELECT *
    FROM smart_shelves
    ORDER BY created_at ASC;
  `,
  );

  return rows.map(mapSmartShelfRowToDomain);
}

async function getById(id: SmartShelfId): Promise<SmartShelf | null> {
  const row = await getFirstAsync<SmartShelfRow>(
    `
    SELECT *
    FROM smart_shelves
    WHERE id = ?
    LIMIT 1;
  `,
    [id],
  );

  return row ? mapSmartShelfRowToDomain(row) : null;
}

async function insert(input: CreateSmartShelfInput): Promise<SmartShelf> {
  const now = new Date().toISOString();
  const id = generateId();

  const row = buildSmartShelfInsertRow(input, id, now);

  await runAsync(
    `
    INSERT INTO smart_shelves (
      id,
      name,
      filter_json,
      created_at,
      updated_at
    ) VALUES (
      ?, ?, ?, ?, ?
    );
  `,
    [row.id, row.name, row.filter_json, row.created_at, row.updated_at],
  );

  return mapSmartShelfRowToDomain(row);
}

async function update(input: UpdateSmartShelfInput): Promise<SmartShelf | null> {
  const existing = await getFirstAsync<SmartShelfRow>(
    `
    SELECT *
    FROM smart_shelves
    WHERE id = ?
    LIMIT 1;
  `,
    [input.id],
  );

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const updatedRow = buildSmartShelfUpdateRow(existing, input, now);

  await runAsync(
    `
    UPDATE smart_shelves
    SET
      name = ?,
      filter_json = ?,
      updated_at = ?
    WHERE id = ?;
  `,
    [updatedRow.name, updatedRow.filter_json, updatedRow.updated_at, updatedRow.id],
  );

  return mapSmartShelfRowToDomain(updatedRow);
}

async function remove(id: SmartShelfId): Promise<void> {
  await runAsync(
    `
    DELETE FROM smart_shelves
    WHERE id = ?;
  `,
    [id],
  );
}

export const shelfRepository = {
  getAll,
  getById,
  insert,
  update,
  delete: remove,
};
