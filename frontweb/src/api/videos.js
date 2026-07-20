import request from '@/utils/request'

export const videosAPI = {
  list(params) {
    return request.get('/videos', { params: params || {} })
  },
  /** 创建单条分镜视频生成任务，body: { drama_id, storyboard_id, prompt, image_url?, model?, ... } */
  create(body) {
    return request.post('/videos', body)
  },
  cancel(id) {
    return request.post(`/videos/${id}/cancel`)
  },
  duplicate(id) {
    return request.post(`/videos/${id}/duplicate`)
  },
  providerTasks(params) {
    return request.get('/videos/provider-tasks', { params: params || {} })
  },
  deleteProviderTask(taskId, params) {
    return request.delete(`/videos/provider-tasks/${encodeURIComponent(taskId)}`, { params: params || {} })
  }
}
