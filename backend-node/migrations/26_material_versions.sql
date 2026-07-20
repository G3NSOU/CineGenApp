CREATE TABLE IF NOT EXISTS material_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_type TEXT NOT NULL,
  material_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  image_url TEXT,
  local_path TEXT,
  tos_url TEXT,
  tos_object_key TEXT,
  tos_synced_at TEXT,
  tos_expires_at TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(material_type, material_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_material_versions_lookup
  ON material_versions(material_type, material_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_material_versions_current
  ON material_versions(material_type, material_id, is_current);
