import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import sqlite3InitModule from '../bin/sqlite3-node.mjs';

test('Node.js build sanity check', async () => {
  // Mock fetch because Emscripten's Node.js loader still uses it, and it fails on file:// URLs
  vi.stubGlobal('fetch', async (url) => {
    if (url.endsWith('.wasm')) {
      const buffer = readFileSync(
        new URL('../bin/sqlite3.wasm', import.meta.url),
      );
      return new Response(buffer, {
        headers: { 'Content-Type': 'application/wasm' },
      });
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });

  const sqlite3 = await sqlite3InitModule();

  expect(typeof sqlite3.version.libVersion).toBe('string');

  // 1. Create a database
  const db = new sqlite3.oo1.DB(':memory:');
  expect(db.isOpen()).toBe(true);

  try {
    // 2. Create a table
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');

    // 3. Insert data
    db.exec({
      sql: 'INSERT INTO test (name) VALUES (?), (?)',
      bind: ['Alice', 'Bob'],
    });

    // 4. Query data
    const rows = [];
    db.exec({
      sql: 'SELECT * FROM test ORDER BY id',
      rowMode: 'object',
      callback: (row) => {
        rows.push(row);
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: 1, name: 'Alice' });
    expect(rows[1]).toEqual({ id: 2, name: 'Bob' });

    // 5. Delete data
    db.exec('DELETE FROM test WHERE id = 1');
    const rowsAfterDelete = db.selectArrays('SELECT count(*) FROM test');
    expect(rowsAfterDelete[0][0]).toBe(1);

    // 6. Joins
    db.exec(
      'CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, product TEXT)',
    );
    db.exec(
      "INSERT INTO orders (user_id, product) VALUES (2, 'Laptop'), (2, 'Mouse')",
    );

    const joinedRows = [];
    db.exec({
      sql: `
        SELECT test.name, orders.product
        FROM test
        INNER JOIN orders ON test.id = orders.user_id
        ORDER BY orders.product
      `,
      rowMode: 'object',
      callback: (row) => joinedRows.push(row),
    });
    expect(joinedRows).toHaveLength(2);
    expect(joinedRows[0]).toEqual({ name: 'Bob', product: 'Laptop' });
    expect(joinedRows[1]).toEqual({ name: 'Bob', product: 'Mouse' });

    // 7. Common Table Expressions (CTE)
    const cteRows = db.selectArrays(`
      WITH RECURSIVE cnt(x) AS (
        SELECT 1
        UNION ALL
        SELECT x+1 FROM cnt LIMIT 5
      )
      SELECT x FROM cnt
    `);
    expect(cteRows).toHaveLength(5);
    expect(cteRows[4][0]).toBe(5);

    // 8. Virtual Tables (FTS5)
    // Most SQLite builds include FTS5 by default
    db.exec('CREATE VIRTUAL TABLE documents USING fts5(content)');
    db.exec(
      "INSERT INTO documents (content) VALUES ('The quick brown fox'), ('Jumped over the lazy dog')",
    );
    const ftsRows = db.selectArrays(
      "SELECT content FROM documents WHERE documents MATCH 'fox'",
    );
    expect(ftsRows).toHaveLength(1);
    expect(ftsRows[0][0]).toBe('The quick brown fox');

    // 9. Transactions
    db.transaction(() => {
      db.exec("INSERT INTO test (name) VALUES ('Charlie')");
      // Verify inside transaction
      expect(
        db.selectValue("SELECT count(*) FROM test WHERE name = 'Charlie'"),
      ).toBe(1);
    });
    expect(
      db.selectValue("SELECT count(*) FROM test WHERE name = 'Charlie'"),
    ).toBe(1);

    // 10. Subqueries
    const subqueryResult = db.selectValue(`
      SELECT name FROM test WHERE id = (SELECT user_id FROM orders WHERE product = 'Laptop')
    `);
    expect(subqueryResult).toBe('Bob');

    // 12. Feature Functionality Tests
    // Math functions
    expect(db.selectValue('SELECT cos(0)')).toBe(1);
    expect(db.selectValue('SELECT log2(8)')).toBe(3);

    // Percentile
    db.exec(
      'CREATE TABLE p_percentile(x); INSERT INTO p_percentile VALUES (1),(2),(3),(4),(5);',
    );
    expect(db.selectValue('SELECT percentile(x, 50) FROM p_percentile')).toBe(
      3,
    );

    // DQS=0
    expect(() => {
      db.exec('SELECT "non_existent_column"');
    }).toThrow(/no such column/);

    // Virtual Tables and special functions
    expect(
      db.selectArrays('SELECT * FROM sqlite_dbpage LIMIT 1').length,
    ).toBeGreaterThanOrEqual(0);

    db.exec(
      'CREATE VIRTUAL TABLE rtree_test USING rtree(id, minX, maxX, minY, maxY)',
    );
    db.exec('INSERT INTO rtree_test VALUES (1, 0, 10, 0, 10)');
    expect(db.selectValue('SELECT id FROM rtree_test')).toBe(1);

    db.exec('CREATE TABLE off_test(id); INSERT INTO off_test VALUES (1);');
    expect(
      typeof db.selectValue('SELECT sqlite_offset(id) FROM off_test'),
    ).toBe('number');
  } finally {
    // 11. Close the database
    db.close();
    expect(db.isOpen()).toBe(false);
  }
});
