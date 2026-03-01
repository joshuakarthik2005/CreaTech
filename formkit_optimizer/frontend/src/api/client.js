// In production, set VITE_API_URL to your Render backend URL (e.g. https://formkit-api.onrender.com)
// In development, falls back to '/api' which is proxied by Vite to localhost:8000
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Projects
  getProjects: () => request('/projects'),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),

  // Dashboard
  getDashboard: (projectId) => request(`/projects/${projectId}/dashboard`),

  // Pours
  getPours: (projectId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/projects/${projectId}/pours${qs ? '?' + qs : ''}`);
  },
  getPour: (id) => request(`/pours/${id}`),
  createPour: (projectId, data) => request(`/projects/${projectId}/pours`, { method: 'POST', body: JSON.stringify(data) }),

  // Kits
  getKits: (projectId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/projects/${projectId}/kits${qs ? '?' + qs : ''}`);
  },
  getKit: (id) => request(`/kits/${id}`),
  approveKit: (id) => request(`/kits/${id}/approve`, { method: 'POST' }),

  // Inventory
  getInventory: (projectId) => request(`/projects/${projectId}/inventory`),
  upsertInventory: (projectId, data) => request(`/projects/${projectId}/inventory`, { method: 'POST', body: JSON.stringify(data) }),

  // Optimization
  getOptimizationRuns: (projectId) => request(`/projects/${projectId}/optimization-runs`),
  runOptimization: (data) => request('/optimize', { method: 'POST', body: JSON.stringify(data) }),

  // Analytics
  getCostTimeline: (projectId) => request(`/projects/${projectId}/analytics/cost-timeline`),
  getFloorCosts: (projectId) => request(`/projects/${projectId}/analytics/floor-costs`),
  getComponentUsage: (projectId) => request(`/projects/${projectId}/analytics/component-usage`),
  getPourTimeline: (projectId) => request(`/projects/${projectId}/analytics/pour-timeline`),
  getActivity: (projectId) => request(`/projects/${projectId}/activity`),

  // Components
  getComponents: () => request('/components'),

  // Health
  health: () => request('/health'),
};
