import { expect, test } from 'vitest';
import sqlite3Worker1Promiser from '../bin/sqlite3-worker1-promiser.mjs';

test('Promiser API sanity check (browser)', async () => {
  const promiser = await sqlite3Worker1Promiser();

  // 1. Config Get
  const config = await promiser('config-get', {});
  expect(typeof config.result.version.libVersion).toBe('string');

  // 2. Open database
  const open = await promiser('open', { filename: ':memory:' });
  const dbId = open.dbId;
  expect(dbId).toBeDefined();

  try {
    // 3. Exec: Create table
    await promiser('exec', {
      sql: 'CREATE TABLE test(id INTEGER PRIMARY KEY, name TEXT)',
    });

    // 4. Exec: Insert data
    await promiser('exec', {
      sql: 'INSERT INTO test (name) VALUES (?), (?)',
      bind: ['Alice', 'Bob'],
    });

    // 5. Exec: Query data with callback
    const rows = [];
    await promiser('exec', {
      sql: 'SELECT * FROM test ORDER BY id',
      rowMode: 'object',
      callback: (row) => {
        if (row.row) {
          rows.push(row.row);
        }
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: 1, name: 'Alice' });
    expect(rows[1]).toEqual({ id: 2, name: 'Bob' });

    // 6. Math functions
    await promiser('exec', {
      sql: 'SELECT cos(0) AS c, log2(8) AS l',
      rowMode: 'object',
      callback: (row) => {
        if (row.row) {
          expect(row.row.c).toBe(1);
          expect(row.row.l).toBe(3);
        }
      },
    });

    // 7. Joins
    await promiser('exec', {
      sql: 'CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, product TEXT)',
    });
    await promiser('exec', {
      sql: "INSERT INTO orders (user_id, product) VALUES (2, 'Laptop'), (2, 'Mouse')",
    });

    const joinedRows = [];
    await promiser('exec', {
      sql: 'SELECT test.name, orders.product FROM test INNER JOIN orders ON test.id = orders.user_id ORDER BY orders.product',
      rowMode: 'object',
      callback: (row) => {
        if (row.row) joinedRows.push(row.row);
      },
    });
    expect(joinedRows).toHaveLength(2);
    expect(joinedRows[0].name).toBe('Bob');

    // 8. CTE
    let cteVal = 0;
    await promiser('exec', {
      sql: 'WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt LIMIT 5) SELECT count(*) AS count FROM cnt',
      rowMode: 'object',
      callback: (row) => {
        if (row.row) cteVal = row.row.count;
      },
    });
    expect(cteVal).toBe(5);
  } finally {
    // 9. Close
    await promiser('close', {});
  }
});
