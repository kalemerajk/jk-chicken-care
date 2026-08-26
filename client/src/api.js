const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }

  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name, email, password) =>
    request('/auth/register', { method: 'POST', body: { name, email, password } }),
  getStockTypes: (token) => request('/stock-types', { token }),
  updateStockType: (id, quantity, token) =>
    request(`/stock-types/${id}`, { method: 'PUT', body: { quantity }, token }),
  createStockType: (name, quantity, token) =>
    request('/stock-types', { method: 'POST', body: { name, quantity }, token }),
  createOrder: (order, token) => request('/orders', { method: 'POST', body: order, token }),
  getMyOrders: (token) => request('/orders/mine', { token }),
  getAllOrders: (token) => request('/orders', { token }),
  acceptOrder: (id, token) => request(`/orders/${id}/accept`, { method: 'POST', token }),
  rejectOrder: (id, reason, token) =>
    request(`/orders/${id}/reject`, { method: 'POST', body: { reason }, token }),
};
