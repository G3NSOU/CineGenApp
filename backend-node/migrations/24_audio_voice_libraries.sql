CREATE TABLE IF NOT EXISTS audio_libraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drama_id INTEGER,
  name TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'audio',
  description TEXT,
  audio_url TEXT NOT NULL DEFAULT '',
  local_path TEXT,
  mime_type TEXT,
  duration REAL,
  source_type TEXT DEFAULT 'upload',
  source_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS voice_libraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_name TEXT DEFAULT '默认音色集',
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  audio_url TEXT NOT NULL DEFAULT '',
  local_path TEXT,
  mime_type TEXT,
  duration REAL,
  version_name TEXT DEFAULT '主音色',
  metadata TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

ALTER TABLE characters ADD COLUMN voice_library_id INTEGER;
ALTER TABLE character_libraries ADD COLUMN voice_library_id INTEGER;
ALTER TABLE video_generations ADD COLUMN voice_reference_url TEXT;

CREATE INDEX IF NOT EXISTS idx_audio_libraries_drama ON audio_libraries(drama_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_voice_libraries_collection ON voice_libraries(collection_name, deleted_at);
