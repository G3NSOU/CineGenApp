const response = require('../response');
const service = require('../services/materialVersionService');

module.exports = function materialVersionRoutes(db, log) {
  return {
    list(req, res) {
      try {
        const versions = service.listVersions(db, req.params.type, req.params.id);
        if (!versions) return response.notFound(res, '素材不存在');
        response.success(res, versions);
      } catch (error) {
        log.warn('material versions list failed', { error: error.message });
        response.badRequest(res, error.message);
      }
    },
    activate(req, res) {
      try {
        const item = service.activateVersion(db, req.params.type, req.params.id, req.params.versionId);
        if (!item) return response.notFound(res, '素材版本不存在');
        response.success(res, item);
      } catch (error) {
        log.warn('material version activate failed', { error: error.message });
        response.badRequest(res, error.message);
      }
    },
  };
};
