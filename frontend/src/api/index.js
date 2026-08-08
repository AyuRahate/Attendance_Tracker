import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://attendance-tracker-api-t13p.onrender.com',
  timeout: 15000,
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  // Pass timezone offset so backend uses correct local date
  const tz = -new Date().getTimezoneOffset(); // minutes ahead of UTC
  if (config.method === 'get' && !config.params?.date) {
    config.params = { ...config.params, tz };
  }
  if (config.method === 'post' && config.data) {
    // Skip FormData — spreading it destroys the multipart payload (e.g. image uploads)
    if (!(config.data instanceof FormData) && typeof config.data === 'object' && !config.data.date) {
      config.data = { ...config.data, tz };
    }
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  me:       ()     => api.get('/auth/me'),
};

// ── Subjects ──────────────────────────────────────────────────────────────
export const subjectsApi = {
  list:        ()       => api.get('/subjects'),
  create:      (data)   => api.post('/subjects', data),
  update:      (id, d)  => api.put(`/subjects/${id}`, d),
  delete:      (id)     => api.delete(`/subjects/${id}`),
  deduplicate: ()       => api.post('/subjects/deduplicate'),
};

// ── Settings ──────────────────────────────────────────────────────────────
export const settingsApi = {
  get:    ()     => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

// ── Timetable ─────────────────────────────────────────────────────────────
export const timetableApi = {
  get:            ()             => api.get('/timetable'),
  save:           (data)         => api.post('/timetable', data),
  deleteSlot:     (id)           => api.delete(`/timetable/${id}`),
  uploadScreenshot: (formData)   => api.post('/timetable/upload-screenshot', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000, // 60s — Tesseract OCR can be slow on CPU
  }),
};

// ── Lectures ──────────────────────────────────────────────────────────────
export const lecturesApi = {
  today:        (date) => api.get('/today', { params: date ? { date } : undefined }),
  mark:         (slotId, data) => api.post(`/lectures/${slotId}/mark`, data),
  markSubject:  (data) => api.post('/lectures/mark-subject', data),
  monthSummary: (year, month) => api.get('/lectures/month-summary', { params: { year, month } }),
};

// ── Summary ───────────────────────────────────────────────────────────────
export const summaryApi = {
  get: () => api.get('/summary'),
};

export default api;
