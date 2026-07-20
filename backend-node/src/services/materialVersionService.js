const SPECS = Object.freeze({
  character: { table: 'character_libraries' },
  scene: { table: 'scene_libraries' },
  prop: { table: 'prop_libraries' },
});

function specFor(type) {
  return SPECS[String(type || '').toLowerCase()] || null;
}

function normalizeMedia(value) {
  return value == null ? null : String(value);
}

function mediaChanged(current, next) {
  const imageUrl = next.image_url !== undefined ? next.image_url : current.image_url;
  const localPath = next.local_path !== undefined ? next.local_path : current.local_path;
  return normalizeMedia(imageUrl) !== normalizeMedia(current.image_url)
    || normalizeMedia(localPath) !== normalizeMedia(current.local_path);
}

function getMaterial(db, type, id) {
  const spec = specFor(type);
  if (!spec) throw new Error('不支持的素材版本类型');
  return db.prepare(`SELECT * FROM ${spec.table} WHERE id = ? AND deleted_at IS NULL`).get(Number(id)) || null;
}

function insertVersion(db, type, id, versionNumber, media, isCurrent, now) {
  return db.prepare(`INSERT INTO material_versions (
    material_type, material_id, version_number, image_url, local_path,
    tos_url, tos_object_key, tos_synced_at, tos_expires_at,
    is_current, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      type, Number(id), versionNumber,
      media.image_url || null, media.local_path || null,
      media.tos_url || null, media.tos_object_key || null,
      media.tos_synced_at || null, media.tos_expires_at || null,
      isCurrent ? 1 : 0, now, now
    );
}

function ensureInitialVersion(db, type, id, material = null) {
  const current = material || getMaterial(db, type, id);
  if (!current) return null;
  const existing = db.prepare(`SELECT * FROM material_versions
    WHERE material_type = ? AND material_id = ? AND is_current = 1
    ORDER BY version_number DESC LIMIT 1`).get(type, Number(id));
  if (existing) return existing;
  const now = current.created_at || new Date().toISOString();
  const maxRow = db.prepare(`SELECT MAX(version_number) AS max_version FROM material_versions
    WHERE material_type = ? AND material_id = ?`).get(type, Number(id));
  const versionNumber = Number(maxRow?.max_version || 0) + 1;
  db.prepare(`UPDATE material_versions SET is_current = 0, updated_at = ?
    WHERE material_type = ? AND material_id = ?`).run(now, type, Number(id));
  const info = insertVersion(db, type, id, versionNumber, current, true, now);
  return db.prepare('SELECT * FROM material_versions WHERE id = ?').get(info.lastInsertRowid);
}

function recordReplacement(db, type, id, current, next) {
  if (!mediaChanged(current, next)) return false;
  const tx = db.transaction(() => {
    ensureInitialVersion(db, type, id, current);
    const now = new Date().toISOString();
    db.prepare(`UPDATE material_versions SET is_current = 0, updated_at = ?
      WHERE material_type = ? AND material_id = ?`).run(now, type, Number(id));
    const maxRow = db.prepare(`SELECT MAX(version_number) AS max_version FROM material_versions
      WHERE material_type = ? AND material_id = ?`).get(type, Number(id));
    insertVersion(db, type, id, Number(maxRow?.max_version || 0) + 1, {
      image_url: next.image_url !== undefined ? next.image_url : current.image_url,
      local_path: next.local_path !== undefined ? next.local_path : current.local_path,
    }, true, now);
  });
  tx();
  return true;
}

function listVersions(db, type, id) {
  const material = getMaterial(db, type, id);
  if (!material) return null;
  ensureInitialVersion(db, type, id, material);
  return db.prepare(`SELECT * FROM material_versions
    WHERE material_type = ? AND material_id = ?
    ORDER BY version_number DESC`).all(type, Number(id));
}

function activateVersion(db, type, id, versionId) {
  const spec = specFor(type);
  const material = getMaterial(db, type, id);
  if (!spec || !material) return null;
  const version = db.prepare(`SELECT * FROM material_versions
    WHERE id = ? AND material_type = ? AND material_id = ?`).get(Number(versionId), type, Number(id));
  if (!version) return null;
  const tx = db.transaction(() => {
    const now = new Date().toISOString();
    ensureInitialVersion(db, type, id, material);
    db.prepare(`UPDATE material_versions SET is_current = CASE WHEN id = ? THEN 1 ELSE 0 END, updated_at = ?
      WHERE material_type = ? AND material_id = ?`).run(Number(versionId), now, type, Number(id));
    db.prepare(`UPDATE ${spec.table} SET
      image_url = ?, local_path = ?, tos_url = ?, tos_object_key = ?,
      tos_synced_at = ?, tos_expires_at = ?, updated_at = ? WHERE id = ?`)
      .run(
        version.image_url || null, version.local_path || null,
        version.tos_url || null, version.tos_object_key || null,
        version.tos_synced_at || null, version.tos_expires_at || null,
        now, Number(id)
      );
  });
  tx();
  return getMaterial(db, type, id);
}

function updateCurrentTos(db, type, id, fields) {
  const material = getMaterial(db, type, id);
  if (!material) return;
  const current = ensureInitialVersion(db, type, id, material);
  if (!current) return;
  db.prepare(`UPDATE material_versions SET
    tos_url = ?, tos_object_key = ?, tos_synced_at = ?, tos_expires_at = ?, updated_at = ?
    WHERE id = ?`).run(
      fields.tos_url || null, fields.tos_object_key || null,
      fields.tos_synced_at || null, fields.tos_expires_at || null,
      fields.updated_at || new Date().toISOString(), current.id
    );
}

module.exports = {
  specFor,
  mediaChanged,
  ensureInitialVersion,
  recordReplacement,
  listVersions,
  activateVersion,
  updateCurrentTos,
};
