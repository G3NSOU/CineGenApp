const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const service = require('../src/services/mediaLibraryService');
const characterLibraryService = require('../src/services/characterLibraryService');

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE audio_libraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, drama_id INTEGER, name TEXT, category TEXT,
      description TEXT, audio_url TEXT, local_path TEXT, mime_type TEXT, duration REAL,
      source_type TEXT, source_id TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT
    );
    CREATE TABLE voice_libraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, collection_name TEXT, name TEXT, description TEXT,
      audio_url TEXT, local_path TEXT, mime_type TEXT, duration REAL, version_name TEXT,
      metadata TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT
    );
    CREATE TABLE characters (
      id INTEGER PRIMARY KEY, voice_library_id INTEGER, seedance2_voice_asset TEXT,
      updated_at TEXT, deleted_at TEXT
    );
    CREATE TABLE character_libraries (
      id INTEGER PRIMARY KEY, drama_id INTEGER, name TEXT, category TEXT, image_url TEXT, local_path TEXT,
      description TEXT, tags TEXT, source_type TEXT, source_id TEXT, voice_library_id INTEGER,
      tos_url TEXT, tos_object_key TEXT, tos_synced_at TEXT, tos_expires_at TEXT,
      created_at TEXT, updated_at TEXT, deleted_at TEXT
    );
  `);
  db.prepare('INSERT INTO characters (id) VALUES (1)').run();
  db.prepare('INSERT INTO character_libraries (id) VALUES (2)').run();
  return db;
}

test('any unified audio library item can bind a project character voice', () => {
  const db = createDb();
  const audio = service.createAudio(db, { name: 'Hero voice', audio_url: '/static/hero.wav', mime_type: 'audio/wav' });
  const result = service.bindVoice(db, 'character', 1, audio.id);

  assert.equal(result.ok, true);
  assert.equal(result.voice.id, audio.id);
  const character = db.prepare('SELECT * FROM characters WHERE id = 1').get();
  assert.equal(character.voice_library_id, audio.id);
  const asset = JSON.parse(character.seedance2_voice_asset);
  assert.equal(asset.source, 'audio_library');
  assert.equal(asset.url, '/static/hero.wav');
});

test('unified audio library item can bind and unbind a global character', () => {
  const db = createDb();
  const audio = service.createAudio(db, { name: 'Narrator', audio_url: '/static/narrator.mp3' });

  assert.equal(service.bindVoice(db, 'library-character', 2, audio.id).ok, true);
  assert.equal(db.prepare('SELECT voice_library_id FROM character_libraries WHERE id = 2').get().voice_library_id, audio.id);
  assert.equal(service.bindVoice(db, 'library-character', 2, null).ok, true);
  assert.equal(db.prepare('SELECT voice_library_id FROM character_libraries WHERE id = 2').get().voice_library_id, null);
});

test('global character DTO preserves the persisted voice binding and TOS state', () => {
  const db = createDb();
  const audio = service.createAudio(db, { name: 'Chickie voice', audio_url: '/static/chickie.wav' });
  assert.equal(service.bindVoice(db, 'library-character', 2, audio.id).ok, true);
  db.prepare(`UPDATE character_libraries SET name = 'Chickie', tos_url = ?, tos_expires_at = ? WHERE id = 2`)
    .run('https://tos.example/chickie.png', '2099-01-01T00:00:00.000Z');

  const item = characterLibraryService.getLibraryItem(db, 2);
  assert.equal(item.voice_library_id, audio.id);
  assert.equal(item.tos_url, 'https://tos.example/chickie.png');
  assert.equal(item.tos_expires_at, '2099-01-01T00:00:00.000Z');
});
