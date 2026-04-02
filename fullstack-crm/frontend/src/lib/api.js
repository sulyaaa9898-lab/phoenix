const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export const api = {
  getOwnerSnapshot() {
    return request('/owner/snapshot');
  },
  createTariff(payload) {
    return request('/owner/tariffs', { method: 'POST', body: JSON.stringify(payload) });
  },
  createTeacher(payload) {
    return request('/owner/teachers', { method: 'POST', body: JSON.stringify(payload) });
  },
  createRoom(payload) {
    return request('/owner/rooms', { method: 'POST', body: JSON.stringify(payload) });
  },
  getMatchingResources(language, level) {
    return request(`/manager/matching-resources?language=${encodeURIComponent(language)}&level=${encodeURIComponent(level)}`);
  },
  registerStudent(payload) {
    return request('/manager/register', { method: 'POST', body: JSON.stringify(payload) });
  },
  markAttendance(payload) {
    return request('/manager/attendance', { method: 'POST', body: JSON.stringify(payload) });
  },
};
