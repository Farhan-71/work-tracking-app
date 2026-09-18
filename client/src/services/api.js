import axios from 'axios'

const API_BASE_URL = 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Tasks API
export const tasksApi = {
  getAll: () => api.get('/tasks'),
  getById: (id) => api.get(`/tasks/${id}`),
  create: (task) => api.post('/tasks', task),
  update: (id, task) => api.put(`/tasks/${id}`, task),
  delete: (id) => api.delete(`/tasks/${id}`),
}

// User API
export const userApi = {
  get: () => api.get('/user'),
  update: (user) => api.put('/user', user),
}

// Achievements API
export const achievementsApi = {
  getAll: () => api.get('/achievements'),
  update: (id, achievement) => api.put(`/achievements/${id}`, achievement),
}

// Stats API
export const statsApi = {
  get: () => api.get('/stats'),
}

export default api
