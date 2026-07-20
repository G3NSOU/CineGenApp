function pageRows(db, table, query = {}) {
  const where = ['deleted_at IS NULL'];
  const params = [];
  if (table === 'audio_libraries') {
    if (query.global === '1' || query.global === 1) where.push('drama_id IS NULL');
    else if (query.drama_id != null && query.drama_id !== '') {
      where.push('(drama_id IS NULL OR drama_id = ?)');
      params.push(Number(query.drama_id));
    }
    if (query.category) { where.push('category = ?'); params.push(query.category); }
  } else if (query.collection_name) {
    where.push('collection_name = ?');
    params.push(query.collection_name);
  }
  if (query.keyword) {
    where.push('(name LIKE ? OR description LIKE ?)');
    const keyword = `%${query.keyword}%`;
    params.push(keyword, keyword);
  }
  const clause = `FROM ${table} WHERE ${where.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) total ${clause}`).get(...params).total || 0;
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 20));
  const rows = db.prepare(`SELECT * ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);
  return { items: rows.map(parseRow), total, page, pageSize };
}

function parseRow(row) {
  if (!row) return null;
  const out = { ...row };
  if (Object.prototype.hasOwnProperty.call(out, 'metadata')) {
    try { out.metadata = out.metadata ? JSON.parse(out.metadata) : {}; } catch (_) { out.metadata = {}; }
  }
  return out;
}

function get(db, table, id) {
  return parseRow(db.prepare(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(Number(id)));
}

function createAudio(db, body = {}) {
  if (!String(body.name || '').trim()) throw new Error('音频名称必填');
  if (!String(body.audio_url || '').trim()) throw new Error('音频文件必填');
  const now = new Date().toISOString();
  const info = db.prepare(`INSERT INTO audio_libraries
    (drama_id, name, category, description, audio_url, local_path, mime_type, duration, source_type, source_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(body.drama_id ?? null, body.name.trim(), body.category || 'audio', body.description || null,
      body.audio_url, body.local_path || null, body.mime_type || null, body.duration ?? null,
      body.source_type || 'upload', body.source_id || null, now, now);
  return get(db, 'audio_libraries', info.lastInsertRowid);
}

function createVoice(db, body = {}) {
  if (!String(body.name || '').trim()) throw new Error('音色名称必填');
  if (!String(body.audio_url || '').trim()) throw new Error('主音色文件必填');
  const now = new Date().toISOString();
  const info = db.prepare(`INSERT INTO voice_libraries
    (collection_name, name, description, audio_url, local_path, mime_type, duration, version_name, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(body.collection_name || '默认音色集', body.name.trim(), body.description || null, body.audio_url,
      body.local_path || null, body.mime_type || null, body.duration ?? null, body.version_name || '主音色',
      JSON.stringify(body.metadata || {}), now, now);
  return get(db, 'voice_libraries', info.lastInsertRowid);
}

function update(db, table, id, body = {}) {
  const allowed = table === 'audio_libraries'
    ? ['name', 'category', 'description', 'audio_url', 'local_path', 'mime_type', 'duration']
    : ['collection_name', 'name', 'description', 'audio_url', 'local_path', 'mime_type', 'duration', 'version_name', 'metadata'];
  const fields = [];
  const params = [];
  for (const key of allowed) {
    if (body[key] === undefined) continue;
    fields.push(`${key} = ?`);
    params.push(key === 'metadata' ? JSON.stringify(body[key] || {}) : body[key]);
  }
  if (!fields.length) return get(db, table, id);
  fields.push('updated_at = ?'); params.push(new Date().toISOString(), Number(id));
  const result = db.prepare(`UPDATE ${table} SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`).run(...params);
  return result.changes ? get(db, table, id) : null;
}

function remove(db, table, id) {
  const now = new Date().toISOString();
  const result = db.prepare(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
    .run(now, now, Number(id));
  if (result.changes && (table === 'voice_libraries' || table === 'audio_libraries')) {
    db.prepare('UPDATE characters SET voice_library_id = NULL, updated_at = ? WHERE voice_library_id = ?').run(now, Number(id));
    db.prepare('UPDATE character_libraries SET voice_library_id = NULL, updated_at = ? WHERE voice_library_id = ?').run(now, Number(id));
  }
  return result.changes > 0;
}

function bindVoice(db, target, targetId, audioId) {
  const config = target === 'character'
    ? { table: 'characters', asset: true }
    : target === 'library-character'
      ? { table: 'character_libraries', asset: false }
      : null;
  if (!config) return { ok: false, error: '不支持的角色类型' };
  const row = db.prepare(`SELECT * FROM ${config.table} WHERE id = ? AND deleted_at IS NULL`).get(Number(targetId));
  if (!row) return { ok: false, error: '角色不存在' };
  const now = new Date().toISOString();
  if (audioId == null || audioId === '') {
    if (config.asset) {
      let oldAsset = null;
      try { oldAsset = row.seedance2_voice_asset ? JSON.parse(row.seedance2_voice_asset) : null; } catch (_) {}
      const asset = oldAsset?.source === 'voice_library' ? null : row.seedance2_voice_asset;
      db.prepare('UPDATE characters SET voice_library_id = NULL, seedance2_voice_asset = ?, updated_at = ? WHERE id = ?')
        .run(asset, now, Number(targetId));
    } else {
      db.prepare('UPDATE character_libraries SET voice_library_id = NULL, updated_at = ? WHERE id = ?').run(now, Number(targetId));
    }
    return { ok: true, voice: null };
  }
  // 新版统一从音频库绑定；旧音色表仅作为已有数据的兼容回退。
  const audio = get(db, 'audio_libraries', audioId);
  const legacyVoice = audio ? null : get(db, 'voice_libraries', audioId);
  const voice = audio || legacyVoice;
  if (!voice) return { ok: false, error: '音频素材不存在' };
  if (config.asset) {
    const asset = {
      status: 'active', url: voice.audio_url, local_path: voice.local_path || null,
      format: String(voice.mime_type || '').split('/').pop() || null,
      source: audio ? 'audio_library' : 'voice_library', voice_library_id: voice.id, certified_at: now,
    };
    db.prepare('UPDATE characters SET voice_library_id = ?, seedance2_voice_asset = ?, updated_at = ? WHERE id = ?')
      .run(voice.id, JSON.stringify(asset), now, Number(targetId));
  } else {
    db.prepare('UPDATE character_libraries SET voice_library_id = ?, updated_at = ? WHERE id = ?')
      .run(voice.id, now, Number(targetId));
  }
  return { ok: true, voice };
}

module.exports = { pageRows, get, createAudio, createVoice, update, remove, bindVoice };
