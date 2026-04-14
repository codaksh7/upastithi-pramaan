// src/api/index.js
// 100% feature parity with web api.js
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:8000';

// ── Token storage (SecureStore = encrypted native keychain) ───────────────────
export const getToken   = async () => { try { return await SecureStore.getItemAsync('up_token'); } catch { return null; } };
export const getRole    = async () => { try { return await SecureStore.getItemAsync('up_role');  } catch { return null; } };
export const getProfile = async () => { try { const s = await SecureStore.getItemAsync('up_profile'); return s ? JSON.parse(s) : null; } catch { return null; } };

export const saveAuth = async (token, role, profile) => {
  await SecureStore.setItemAsync('up_token',   token);
  await SecureStore.setItemAsync('up_role',    role);
  await SecureStore.setItemAsync('up_profile', JSON.stringify(profile));
};

export const clearAuth = async () => {
  await SecureStore.deleteItemAsync('up_token');
  await SecureStore.deleteItemAsync('up_role');
  await SecureStore.deleteItemAsync('up_profile');
};

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function request(method, path, body = null, isBlob = false) {
  const token = await getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const isFormData = body instanceof FormData;
  if (!isFormData && body !== null) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); detail = j.detail || detail; } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;

  // CSV / blob response
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/csv') || isBlob) return res.text();

  return res.json();
}

// ── Helper: download CSV and share via native share sheet ────────────────────
export const downloadAndShareCSV = async (csvText, filename) => {
  const uri = FileSystem.documentDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, csvText, { encoding: 'utf8' });
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: `Export: ${filename}` });
};

const api = {
  get:    (path)       => request('GET',    path),
  post:   (path, body) => request('POST',   path, body),
  put:    (path, body) => request('PUT',    path, body),
  patch:  (path, body) => request('PATCH',  path, body),
  delete: (path)       => request('DELETE', path),
  getCSV: (path)       => request('GET',    path, null, true),
};

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:  (role, id, password, division) =>
    api.post('/auth/login', { role, id, password, division }),
  logout: () => api.post('/auth/logout'),
};

// ── STUDENT ───────────────────────────────────────────────────────────────────
export const studentApi = {
  getProfile:       () => api.get('/students/me'),
  getAttendance:    () => api.get('/students/me/attendance'),
  getActiveSession: () => api.get('/students/me/active-session'),
  markAttendance:   (body) => api.post('/students/me/attendance', body),
  getCalendar:      (month, year) => api.get(`/students/me/calendar?month=${month}&year=${year}`),
  getSubjects:      () => api.get('/students/me/subjects'),
  getDevice:        () => api.get('/students/me/device'),
  requestDevice:    (body) => api.post('/students/me/device-request', body),
  getNotifications: () => api.get('/students/me/notifications'),
  markRead:         (id) => api.patch(`/students/me/notifications/${id}/read`),
  submitDispute:    (body) => api.post('/students/me/disputes', body),
  getDisputes:      () => api.get('/students/me/disputes'),
  // ✅ CSV Export (was missing)
  exportCSV: async () => {
    const csv = await api.getCSV('/students/me/export');
    await downloadAndShareCSV(csv, 'my_attendance.csv');
  },
};

// ── FACULTY ───────────────────────────────────────────────────────────────────
export const facultyApi = {
  getProfile:         () => api.get('/faculty/me'),
  getSubjects:        () => api.get('/faculty/subjects'),
  getActiveSession:   () => api.get('/faculty/sessions/active'),
  startSession:       (subjectId) => api.post('/faculty/sessions/start', { subject_id: subjectId }),
  endSession:         (id) => api.post(`/faculty/sessions/${id}/end`),
  getSessionStudents: (id) => api.get(`/faculty/sessions/${id}/students`),
  overrideAttendance: (id, studentId, present) =>
    api.patch(`/faculty/sessions/${id}/override`, { student_id: studentId, present }),
  getAnalytics:       () => api.get('/faculty/analytics'),
  refreshCode:        (sessionId) => api.post(`/faculty/sessions/${sessionId}/refresh-code`),
  // ✅ Export Report with date range (was missing)
  exportReport: async (type, fromDate, toDate) => {
    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate)   params.append('to_date',   toDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const csv = await api.getCSV(`/faculty/reports/${type}${qs}`);
    await downloadAndShareCSV(csv, `${type}_report.csv`);
  },
};

// ── ADMIN ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  getOverview:  () => api.get('/admin/overview'),
  getAnalytics: () => api.get('/admin/analytics'),

  // Students
  getStudents:   (q = '') => api.get(`/admin/students${q ? `?query=${encodeURIComponent(q)}` : ''}`),
  enrollStudent: (body)   => api.post('/admin/students', body),
  updateStudent: (id, body) => api.put(`/admin/students/${id}`, body),
  deleteStudent: (id)     => api.delete(`/admin/students/${id}`),
  // ✅ Mass enroll via FormData (was missing)
  massEnrollStudents: (formData) => request('POST', '/admin/students/upload', formData),

  // Faculty
  getFaculty:    () => api.get('/admin/faculty'),
  addFaculty:    (body)     => api.post('/admin/faculty', body),
  updateFaculty: (id, body) => api.put(`/admin/faculty/${id}`, body),
  deleteFaculty: (id)       => api.delete(`/admin/faculty/${id}`),
  // ✅ Mass add faculty via FormData (was missing)
  massAddFaculty: (formData) => request('POST', '/admin/faculty/upload', formData),

  // Devices
  getDevices:   () => api.get('/admin/devices'),
  approveDevice:(mac) => api.patch(`/admin/devices/${encodeURIComponent(mac)}/approve`),
  flagDevice:   (mac) => api.patch(`/admin/devices/${encodeURIComponent(mac)}/flag`),

  // Logs
  getLogs: (type) => api.get(`/admin/logs${type && type !== 'all' ? `?event_type=${type}` : ''}`),
  // ✅ Export logs CSV (was missing)
  exportLogs: async () => {
    const csv = await api.getCSV('/admin/logs/export');
    await downloadAndShareCSV(csv, 'audit_logs.csv');
  },

  // Disputes
  getDisputes:    () => api.get('/admin/disputes'),
  resolveDispute: (id) => api.patch(`/admin/disputes/${id}/resolve`),
  rejectDispute:  (id) => api.patch(`/admin/disputes/${id}/reject`),

  // ✅ Face Model (was missing)
  getFaceModel: () => api.get('/admin/face-model'),
  retrain:      () => api.post('/admin/face-model/retrain'),
};

// ── NOTIFICATIONS (generic standalone — was missing) ──────────────────────────
export const notifApi = {
  list:     () => api.get('/notifications/'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  delete:   (id) => api.delete(`/notifications/${id}`),
};

export default api;
