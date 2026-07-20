import request from '@/utils/request'

function crud(prefix) {
  return {
    list(params) { return request.get(prefix, { params }) },
    get(id) { return request.get(`${prefix}/${id}`) },
    create(data) { return request.post(prefix, data) },
    update(id, data) { return request.put(`${prefix}/${id}`, data) },
    delete(id) { return request.delete(`${prefix}/${id}`) },
  }
}

export const audioLibraryAPI = crud('/audio-library')
export const voiceLibraryAPI = crud('/voice-library')

export const voiceBindingAPI = {
  bind(id, targetType, audioLibraryId) {
    return request.put(`/voice-bindings/${id}`, {
      target_type: targetType,
      audio_library_id: audioLibraryId || null,
    })
  },
}

export const materialTosAPI = {
  sync(source, type, id) {
    return request.post(`/materials/${source}/${type}/${id}/sync-tos`)
  },
}

export const materialVersionAPI = {
  list(type, id) {
    return request.get(`/materials/global/${type}/${id}/versions`)
  },
  activate(type, id, versionId) {
    return request.put(`/materials/global/${type}/${id}/versions/${versionId}/activate`)
  },
}
