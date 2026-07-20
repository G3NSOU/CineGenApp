const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const dramaService = require('../src/services/dramaService');

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE dramas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      description TEXT,
      genre TEXT,
      style TEXT,
      metadata TEXT,
      status TEXT,
      thumbnail TEXT,
      tags TEXT,
      total_episodes INTEGER DEFAULT 1,
      total_duration INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
  `);
  return db;
}

const log = { info() {} };

describe('drama workflow mode', () => {
  it('normalizes missing and invalid modes to pipeline', () => {
    assert.equal(dramaService.normalizeWorkflowMode(), 'pipeline');
    assert.equal(dramaService.normalizeWorkflowMode('unknown'), 'pipeline');
    assert.equal(dramaService.normalizeWorkflowMode('FREE_STUDIO'), 'free_studio');
  });

  it('creates a free studio project and exposes the mode in metadata and DTO', () => {
    const db = createTestDb();
    const drama = dramaService.createDrama(db, log, {
      title: '自由项目',
      metadata: { aspect_ratio: '16:9', workflow_mode: 'free_studio' },
    });

    assert.equal(drama.workflow_mode, 'free_studio');
    assert.equal(drama.metadata.workflow_mode, 'free_studio');
    assert.equal(drama.metadata.aspect_ratio, '16:9');
  });

  it('treats historical projects without a mode as pipeline projects', () => {
    const db = createTestDb();
    const now = new Date().toISOString();
    const info = db.prepare(`
      INSERT INTO dramas (title, metadata, status, created_at, updated_at)
      VALUES (?, ?, 'draft', ?, ?)
    `).run('历史项目', JSON.stringify({ aspect_ratio: '9:16' }), now, now);

    const drama = dramaService.getDramaById(db, info.lastInsertRowid);
    assert.equal(drama.workflow_mode, 'pipeline');
    assert.equal(drama.metadata.workflow_mode, 'pipeline');
    assert.equal(drama.metadata.aspect_ratio, '9:16');
  });
});
