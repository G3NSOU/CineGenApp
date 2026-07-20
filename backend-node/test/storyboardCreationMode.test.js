const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const storyboardService = require('../src/services/storyboardService');

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE storyboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL,
      scene_id INTEGER,
      storyboard_number INTEGER DEFAULT 0,
      title TEXT,
      description TEXT,
      location TEXT,
      time TEXT,
      duration REAL,
      dialogue TEXT,
      narration TEXT,
      action TEXT,
      result TEXT,
      atmosphere TEXT,
      image_prompt TEXT,
      polished_prompt TEXT,
      video_prompt TEXT,
      creation_mode TEXT DEFAULT 'classic',
      universal_segment_text TEXT,
      layout_description TEXT,
      first_frame_image_id INTEGER,
      last_frame_image_id INTEGER,
      last_frame_image_url TEXT,
      last_frame_local_path TEXT,
      characters TEXT,
      composed_image TEXT,
      image_url TEXT,
      local_path TEXT,
      main_panel_idx INTEGER,
      video_url TEXT,
      audio_local_path TEXT,
      narration_audio_local_path TEXT,
      status TEXT,
      deleted_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE storyboard_props (storyboard_id INTEGER, prop_id INTEGER);
  `);
  return db;
}

describe('storyboard custom multi-reference mode', () => {
  it('round-trips custom_multi_reference instead of folding it to classic', () => {
    const db = createTestDb();
    const created = storyboardService.createStoryboard(db, { info() {} }, {
      episode_id: 12,
      storyboard_number: 1,
      title: '自由视频 1',
      duration: 5,
      creation_mode: 'custom_multi_reference',
    });

    assert.equal(created.creation_mode, 'custom_multi_reference');
    assert.equal(created.title, '自由视频 1');
  });
});
