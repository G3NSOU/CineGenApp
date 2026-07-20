const response = require('../response');
const materialTosService = require('../services/materialTosService');

module.exports = function materialTosRoutes(db, cfg, log) {
  return {
    sync: async (req, res) => {
      try {
        const item = await materialTosService.syncMaterial(db, cfg, log, {
          source: req.params.source,
          type: req.params.type,
          id: req.params.id,
        });
        response.success(res, item);
      } catch (error) {
        log.warn('material TOS sync failed', { source: req.params.source, type: req.params.type, id: req.params.id, error: error.message });
        response.badRequest(res, error.message || '同步到 TOS 失败');
      }
    },
  };
};
