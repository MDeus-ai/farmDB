import { describe, expect, it } from 'vitest';
import {
  convertQuestionPlaceholdersToDollar,
  createFarmDbSession,
  extractProjectedColumns,
  LivestockValidationError,
  mapRowObjectToValues,
  runMigrations,
} from '../src/index';
import { createNodeSqliteDriver } from './nodeSqliteDriver';

describe('@farmdb/db SQL helpers', () => {
  it('converts positional ? placeholders to $n outside quoted literals', () => {
    const converted = convertQuestionPlaceholdersToDollar(
      `SELECT * FROM livestock WHERE tag_number = ? AND notes != 'why?' AND "col?" = ?`
    );
    expect(converted).toBe(
      `SELECT * FROM livestock WHERE tag_number = $1 AND notes != 'why?' AND "col?" = $2`
    );
  });

  it('extracts projected column names and maps row objects regardless of key order', () => {
    const sql = `select "id", "species", "tag_number", "name" from "livestock" where "id" = ?`;
    const cols = extractProjectedColumns(sql);
    expect(cols).toEqual(['id', 'species', 'tag_number', 'name']);

    // Simulate serde_json alphabetical key ordering
    const alphabeticallyOrderedRow = {
      id: '1',
      name: 'Bessie',
      species: 'cow',
      tag_number: 'COW-402',
    };

    expect(mapRowObjectToValues(alphabeticallyOrderedRow, cols)).toEqual([
      '1',
      'cow',
      'COW-402',
      'Bessie',
    ]);
  });
});

describe('@farmdb/db migrations and livestock repository', () => {
  it('applies migrations idempotently and enforces foreign keys', async () => {
    const { driver, raw } = createNodeSqliteDriver(':memory:');

    const first = await runMigrations(driver);
    expect(first).toEqual(['0001_initial_schema']);

    const second = await runMigrations(driver);
    expect(second).toEqual([]);

    const tables = raw
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`
      )
      .all() as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'alerts',
        'financial_logs',
        'livestock',
        'medical_records',
        'product_records',
        'schema_migrations',
      ])
    );

    raw.close();
  });

  it('creates, lists, filters, updates, and deletes livestock with reactive events', async () => {
    const { driver, raw } = createNodeSqliteDriver(':memory:');
    await runMigrations(driver);
    const session = createFarmDbSession(driver);

    const emittedEvents: string[][] = [];
    session.events.subscribe((ev) => {
      emittedEvents.push([...ev.scopes]);
    });

    const cow = await session.livestock.create({
      tagNumber: 'cow 402',
      name: 'Bessie',
      breed: 'Holstein',
      dob: '2022-05-10',
    });

    expect(cow.species).toBe('cow');
    expect(cow.tagNumber).toBe('COW-402');
    expect(cow.status).toBe('active');
    expect(emittedEvents).toEqual([['livestock']]);

    await session.livestock.create({
      species: 'goat',
      tagNumber: 'GT-101',
      name: 'Clover',
      breed: 'Alpine',
    });

    await expect(
      session.livestock.create({ tagNumber: 'cow-402', name: 'Duplicate' })
    ).rejects.toBeInstanceOf(LivestockValidationError);

    const filteredCows = await session.livestock.list({
      species: 'cow',
      search: 'bess',
    });
    expect(filteredCows).toHaveLength(1);
    expect(filteredCows[0]?.id).toBe(cow.id);

    const updated = await session.livestock.update(cow.id, {
      status: 'sold',
      name: 'Bessie II',
    });
    expect(updated.status).toBe('sold');
    expect(updated.name).toBe('Bessie II');

    const summary = await session.livestock.getSummary();
    expect(summary).toEqual({
      totalLivestock: 2,
      activeLivestock: 1,
      soldLivestock: 1,
      deceasedLivestock: 0,
      cowCount: 1,
      productRecordCount: 0,
      medicalRecordCount: 0,
      financialLogCount: 0,
      openAlertCount: 0,
    });

    const deleted = await session.livestock.remove(cow.id);
    expect(deleted).toBe(true);
    expect(await session.livestock.getById(cow.id)).toBeNull();

    raw.close();
  });
});
