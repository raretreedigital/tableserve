const BASE = '/api'

// ─── Table Session (in-memory only) ──────────
// Stored in a module-level variable so it is never written to localStorage,
// disk, or any persistent store. It is lost on page close/refresh, which is
// intentional — the customer must scan the NFC tag again to start a new session.

let _tableSession: string | null = null

export function setTableSession(token: string) {
  _tableSession = token
}

function tableSessionHeader(): HeadersInit {
  return _tableSession ? { 'x-table-session': _tableSession } : {}
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      ...options,
    })

    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      return { data: null, error: json.error ?? `Request failed with status ${res.status}` }
    }

    return { data: json as T, error: null }
  } catch (err: any) {
    return { data: null, error: err.message ?? 'Network error. Please try again.' }
  }
}

function orgHeaders(orgId?: string): HeadersInit {
  return orgId ? { 'x-organization-id': orgId } : {}
}

// ─── Auth ─────────────────────────────────────

export const authApi = {
  signIn: (email: string, password: string) =>
    request('/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signOut: () =>
    request('/auth/sign-out', { method: 'POST' }),

  getSession: () =>
    request<{ user: any; session: any }>('/auth/get-session'),
}

// ─── Super Admin ──────────────────────────────

export const superAdminApi = {
  register: (data: { name: string; email: string; password: string; masterPassword: string }) =>
    request('/superadmin/register', { method: 'POST', body: JSON.stringify(data) }),

  getStats: () =>
    request('/superadmin/stats'),

  getOrganizations: () =>
    request('/superadmin/organizations'),

  createOrganization: (data: object) =>
    request('/superadmin/organizations', { method: 'POST', body: JSON.stringify(data) }),

  getOrganization: (id: string) =>
    request(`/superadmin/organizations/${id}`),

  suspendOrganization: (id: string, reason: string) =>
    request(`/superadmin/organizations/${id}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  activateOrganization: (id: string) =>
    request(`/superadmin/organizations/${id}/activate`, { method: 'PATCH' }),

  updateSubscription: (id: string, data: { plan: string; expiryDays?: number }) =>
    request(`/superadmin/organizations/${id}/subscription`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteOrganization: (id: string) =>
    request(`/superadmin/organizations/${id}`, { method: 'DELETE' }),

  getAnalytics: (period?: string) =>
    request(`/superadmin/analytics${period ? `?period=${period}` : ''}`),

  getUsers: () =>
    request('/superadmin/users'),

  banUser: (id: string, reason?: string) =>
    request(`/superadmin/users/${id}/ban`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

  unbanUser: (id: string) =>
    request(`/superadmin/users/${id}/unban`, { method: 'PATCH' }),
}

// ─── Admin ────────────────────────────────────

export const adminApi = {
  register: (data: object) =>
    request('/admin/register', { method: 'POST', body: JSON.stringify(data) }),

  getDashboard: (orgId: string) =>
    request('/admin/dashboard', { headers: orgHeaders(orgId) }),

  getProfile: (orgId: string) =>
    request('/admin/profile', { headers: orgHeaders(orgId) }),

  updateProfile: (orgId: string, data: object) =>
    request('/admin/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: orgHeaders(orgId),
    }),

  // Categories
  getCategories: (orgId: string) =>
    request('/admin/categories', { headers: orgHeaders(orgId) }),

  createCategory: (orgId: string, data: object) =>
    request('/admin/categories', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: orgHeaders(orgId),
    }),

  updateCategory: (orgId: string, id: string, data: object) =>
    request(`/admin/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: orgHeaders(orgId),
    }),

  deleteCategory: (orgId: string, id: string) =>
    request(`/admin/categories/${id}`, { method: 'DELETE', headers: orgHeaders(orgId) }),

  // Menu Items
  getMenuItems: (orgId: string) =>
    request('/admin/menu', { headers: orgHeaders(orgId) }),

  createMenuItem: (orgId: string, data: object) =>
    request('/admin/menu', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: orgHeaders(orgId),
    }),

  updateMenuItem: (orgId: string, id: string, data: object) =>
    request(`/admin/menu/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: orgHeaders(orgId),
    }),

  deleteMenuItem: (orgId: string, id: string) =>
    request(`/admin/menu/${id}`, { method: 'DELETE', headers: orgHeaders(orgId) }),

  // Tables
  getTables: (orgId: string) =>
    request('/admin/tables', { headers: orgHeaders(orgId) }),

  createTable: (orgId: string, data: object) =>
    request('/admin/tables', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: orgHeaders(orgId),
    }),

  updateTable: (orgId: string, id: string, data: object) =>
    request(`/admin/tables/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: orgHeaders(orgId),
    }),

  deleteTable: (orgId: string, id: string) =>
    request(`/admin/tables/${id}`, { method: 'DELETE', headers: orgHeaders(orgId) }),

  // Orders
  getOrders: (orgId: string, status?: string) =>
    request(`/admin/orders${status ? `?status=${status}` : ''}`, { headers: orgHeaders(orgId) }),

  getOrder: (orgId: string, id: string) =>
    request(`/admin/orders/${id}`, { headers: orgHeaders(orgId) }),

  updateOrderStatus: (orgId: string, id: string, status: string) =>
    request(`/admin/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      headers: orgHeaders(orgId),
    }),

  // Analytics
  getAnalytics: (orgId: string, period?: string) =>
    request(`/admin/analytics${period ? `?period=${period}` : ''}`, {
      headers: orgHeaders(orgId),
    }),

  // Members
  getMembers: (orgId: string) =>
    request('/admin/members', { headers: orgHeaders(orgId) }),
}

// ─── Customer ─────────────────────────────────

export const customerApi = {
  resolveTable: async (token: string) => {
    const result = await request<{ table: any; organization: any; sessionToken: string }>(
      `/customer/table/${token}`
    )
    // Store the session token in memory immediately after a successful scan.
    // All subsequent menu and order calls will carry this token automatically.
    if (result.data?.sessionToken) {
      setTableSession(result.data.sessionToken)
    }
    return result
  },

  getMenu: (organizationId: string) =>
    request(`/customer/menu/${organizationId}`, {
      headers: tableSessionHeader(),
    }),

  placeOrder: (data: object, idempotencyKey: string) =>
    request('/customer/orders', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        ...tableSessionHeader(),
        'idempotency-key': idempotencyKey,
      },
    }),

  getOrderStatus: (id: string) =>
    request(`/customer/orders/${id}`),

  editOrder: (id: string, data: object) =>
    request(`/customer/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: tableSessionHeader(),
    }),
}
