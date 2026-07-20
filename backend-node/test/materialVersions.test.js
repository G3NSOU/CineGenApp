const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const versions = require('../src/services/materialVersionService');
const characterLibrary = require('../src/services/characterLibraryService');
const sceneLibrary = require('../src/services/sceneLibraryService');
const propLibrary = require('../src/services/propLibraryService');

const log = { info() {}, warn() {}, error() {} };

function createDb() {
  const db = new Database(':memory:');
  for (const table of ['character_libraries', 'scene_libraries', 'prop_libraries']) {
    db.exec(`CREATE TABLE ${table} (
      id INTEGER PRIMARY KEY, drama_id INTEGER, name TEXT, location TEXT, time TEXT,
      description TEXT, prompt TEXT, category TEXT, tags TEXT, source_type TEXT, source_id TEXT,
      image_url TEXT, local_path TEXT, voice_library_id INTEGER,
      tos_url TEXT, tos_object_key TEXT, tos_synced_at TEXT, tos_expires_at TEXT,
      created_at TEXT, updated_at TEXT, deleted_at TEXT
    )`);
  }
  db.exec(`CREATE TABLE material_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, material_type TEXT NOT NULL, material_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL, image_url TEXT, local_path TEXT,
    tos_url TEXT, tos_object_key TEXT, tos_synced_at TEXT, tos_expires_at TEXT,
    is_current INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(material_type, material_id, version_number)
  )`);
  return db;
}

for (const [type, table, service, nameColumn] of [
  ['character', 'character_libraries', characterLibrary, 'name'],
  ['scene', 'scene_libraries', sceneLibrary, 'location'],
  ['prop', 'prop_libraries', propLibrary, 'name'],
]) {
  test(`${type} replacement creates an independently timed unsynced version`, () => {
    const db = createDb();
    const created = '2026-07-20T00:00:00.000Z';
    db.prepare(`INSERT INTO ${table}
      (id, ${nameColumn}, image_url, local_path, tos_url, tos_object_key, tos_synced_at, tos_expires_at, created_at, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(type, '/old.png', 'uploads/old.png', 'https://tos/old.png', 'old-key', created, '2026-07-27T00:00:00.000Z', created, created);

    const updated = service.updateLibraryItem(db, log, 1, { image_url: '/new.png', local_path: 'uploads/new.png' });
    assert.equal(updated.image_url, '/new.png');
    assert.equal(updated.tos_url, null);

    const history = versions.listVersions(db, type, 1);
    assert.equal(history.length, 2);
    assert.equal(history[0].version_number, 2);
    assert.equal(history[0].is_current, 1);
    assert.equal(history[0].tos_url, null);
    assert.equal(history[1].image_url, '/old.png');
    assert.equal(history[1].tos_url, 'https://tos/old.png');
    assert.equal(history[1].tos_expires_at, '2026-07-27T00:00:00.000Z');

    const restored = versions.activateVersion(db, type, 1, history[1].id);
    assert.equal(restored.image_url, '/old.png');
    assert.equal(restored.tos_url, 'https://tos/old.png');
    assert.equal(restored.tos_expires_at, '2026-07-27T00:00:00.000Z');
  });
}

test('TOS refresh updates only the active material version', () => {
  const db = createDb();
  const now = '2026-07-21T00:00:00.000Z';
  db.prepare(`INSERT INTO character_libraries
    (id, name, image_url, created_at, updated_at) VALUES (1, 'Chickie', '/chickie.png', ?, ?)`).run(now, now);
  versions.ensureInitialVersion(db, 'character', 1);
  versions.updateCurrentTos(db, 'character', 1, {
    tos_url: 'https://tos/chickie-v1.png', tos_object_key: 'v1',
    tos_synced_at: now, tos_expires_at: '2026-07-28T00:00:00.000Z', updated_at: now,
  });
  const current = versions.listVersions(db, 'character', 1)[0];
  assert.equal(current.tos_url, 'https://tos/chickie-v1.png');
  assert.equal(current.tos_expires_at, '2026-07-28T00:00:00.000Z');
});
