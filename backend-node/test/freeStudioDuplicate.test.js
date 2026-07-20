const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { duplicateAsStoryboard } = require('../src/services/videoService');

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE storyboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL,
      storyboard_number INTEGER DEFAULT 0,
      title TEXT,
      duration REAL,
      video_prompt TEXT,
      creation_mode TEXT,
      video_url TEXT,
      local_path TEXT,
      status TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
    CREATE TABLE video_generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drama_id INTEGER,
      storyboard_id INTEGER,
      provider TEXT,
      prompt TEXT,
      model TEXT,
      image_url TEXT,
      first_frame_url TEXT,
      last_frame_url TEXT,
      reference_image_urls TEXT,
      generation_mode TEXT,
      reference_assets TEXT,
      generation_config TEXT,
      voice_reference_url TEXT,
      duration REAL,
      aspect_ratio TEXT,
      resolution TEXT,
      seed INTEGER,
      camera_fixed INTEGER,
      watermark INTEGER,
      video_url TEXT,
      local_path TEXT,
      status TEXT,
      created_at TEXT,
      updated_at TEXT,
      completed_at TEXT,
      deleted_at TEXT
    );
  `);
  return db;
}

describe('free studio video duplication', () => {
  it('copies the completed video together with its prompt, references and generation settings', () => {
    const db = createDb();
    const now = new Date().toISOString();
    const refs = JSON.stringify([{ type: 'character', id: 7, name: 'Husky', url: '/static/husky.png' }]);
    const config = JSON.stringify({ duration: 8, aspect_ratio: '16:9', resolution: '720p' });
    const sb = db.prepare(`INSERT INTO storyboards
      (episode_id, storyboard_number, title, duration, creation_mode, status, created_at, updated_at)
      VALUES (3, 1, '火箭发射', 8, 'custom_multi_reference', 'completed', ?, ?)`
    ).run(now, now);
    const source = db.prepare(`INSERT INTO video_generations
      (drama_id, storyboard_id, provider, prompt, model, reference_image_urls, generation_mode,
       reference_assets, generation_config, duration, aspect_ratio, resolution, video_url, local_path,
       status, created_at, updated_at, completed_at)
      VALUES (4, ?, 'volces', 'Husky 走向发射台', 'doubao-seedance-2-0-mini-260615', ?,
       'omni_reference', ?, ?, 8, '16:9', '720p', '/static/result.mp4', '/tmp/result.mp4',
       'completed', ?, ?, ?)`
    ).run(sb.lastInsertRowid, JSON.stringify(['/static/husky.png']), refs, config, now, now, now);

    const result = duplicateAsStoryboard(db, { info() {} }, source.lastInsertRowid);
    const copiedStoryboard = db.prepare('SELECT * FROM storyboards WHERE id = ?').get(result.storyboard_id);
    const copiedVideo = db.prepare('SELECT * FROM video_generations WHERE id = ?').get(result.video_generation_id);

    assert.equal(copiedStoryboard.creation_mode, 'custom_multi_reference');
    assert.equal(copiedStoryboard.video_prompt, 'Husky 走向发射台');
    assert.equal(copiedVideo.prompt, 'Husky 走向发射台');
    assert.equal(copiedVideo.reference_assets, refs);
    assert.equal(copiedVideo.generation_config, config);
    assert.equal(copiedVideo.model, 'doubao-seedance-2-0-mini-260615');
    assert.equal(copiedVideo.status, 'completed');
  });
});
