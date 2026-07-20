import request from '@/utils/request'

export const storageSettingsAPI = {
  getTos() {
    return request.get('/settings/storage/tos')
  },
  updateTos(data) {
    return request.put('/settings/storage/tos', data)
  },
  testTos(data) {
    return request.post('/settings/storage/tos/test', data)
  },
}
