const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('uses DATA_DIR override for bookings storage', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'homestay-csvdb-'));
  process.env.DATA_DIR = tempDir;

  delete require.cache[require.resolve('./csvDb')];
  const csvDb = require('./csvDb');

  assert.ok(csvDb.CSV_FILE.startsWith(tempDir));
  assert.ok(fs.existsSync(csvDb.CSV_FILE));
  assert.ok(fs.existsSync(csvDb.BACKUPS_DIR));

  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});
