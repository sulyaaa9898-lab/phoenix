const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const DEFAULT_CONTEXT = {
  userId: '00000000-0000-0000-0000-000000000003',
  role: 'manager',
  centerId: '11111111-1111-1111-1111-111111111111',
};

export function setApiContext({ userId, role, centerId }) {
  if (userId !== undefined) {
    localStorage.setItem('saas_user_id', userId || '');
  }
  if (role !== undefined) {
    localStorage.setItem('saas_role', role || '');
  }
  if (centerId !== undefined) {
    localStorage.setItem('saas_center_id', centerId || '');
  }
}

function getApiContext() {
  return {
    userId: localStorage.getItem('saas_user_id') || DEFAULT_CONTEXT.userId,
    role: localStorage.getItem('saas_role') || DEFAULT_CONTEXT.role,
    centerId: localStorage.getItem('saas_center_id') || DEFAULT_CONTEXT.centerId,
  };
}

async function request(path, options = {}) {
  const context = getApiContext();

  const contextHeaders = {
    'x-user-id': context.userId,
    'x-role': context.role,
  };

  if (context.centerId) {
    contextHeaders['x-center-id'] = context.centerId;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...contextHeaders,
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
  platformListCenters() {
    return request('/platform/centers');
  },
  platformCreateCenter(payload) {
    return request('/platform/centers', { method: 'POST', body: JSON.stringify(payload) });
  },
  platformInviteOwner(centerId) {
    return request(`/platform/centers/${centerId}/invite-owner`, { method: 'POST' });
  },
  activateInvite(payload) {
    return request('/auth/activate', { method: 'POST', body: JSON.stringify(payload) });
  },
  centerInviteManager(centerId) {
    return request(`/center/${centerId}/invite-manager`, { method: 'POST' });
  },
  centerManagers(centerId) {
    return request(`/center/${centerId}/managers`);
  },
  centerAnalyticsOverview(centerId, periodDays = 30) {
    return request(`/center/${centerId}/analytics/overview?periodDays=${periodDays}`);
  },
  centerAnalyticsManagers(centerId, periodDays = 30) {
    return request(`/center/${centerId}/analytics/managers?periodDays=${periodDays}`);
  },
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
