const response = require('../response');
const service = require('../services/mediaLibraryService');

function handlers(db, log, table, createFn) {
  return {
    list(req, res) {
      try {
        const result = service.pageRows(db, table, req.query || {});
        response.successWithPagination(res, result.items, result.total, result.page, result.pageSize);
      } catch (err) { log.error(`${table} list`, { error: err.message }); response.internalError(res, err.message); }
    },
    create(req, res) {
      try { response.created(res, createFn(db, req.body || {})); }
      catch (err) { response.badRequest(res, err.message); }
    },
    get(req, res) {
      const item = service.get(db, table, req.params.id);
      if (!item) return response.notFound(res, '素材不存在');
      response.success(res, item);
    },
    update(req, res) {
      try {
        const item = service.update(db, table, req.params.id, req.body || {});
        if (!item) return response.notFound(res, '素材不存在');
        response.success(res, item);
      } catch (err) { response.badRequest(res, err.message); }
    },
    delete(req, res) {
      if (!service.remove(db, table, req.params.id)) return response.notFound(res, '素材不存在');
      response.success(res, { message: '删除成功' });
    },
  };
}

module.exports = (db, log) => ({
  audio: handlers(db, log, 'audio_libraries', service.createAudio),
  voice: handlers(db, log, 'voice_libraries', service.createVoice),
  bindVoice(req, res) {
    const result = service.bindVoice(
      db,
      req.body?.target_type,
      req.params.id,
      req.body?.audio_library_id ?? req.body?.voice_library_id
    );
    if (!result.ok) return response.badRequest(res, result.error);
    response.success(res, { message: result.voice ? '角色音频已绑定（测试）' : '已解除角色音频绑定', voice: result.voice });
  },
});
