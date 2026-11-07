import { Contract, SettingsState, ReportsData, SimLog, User, ContractPage } from '../types';

let cachedCsrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch('/api/auth/csrf', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.csrfToken) {
        cachedCsrfToken = data.csrfToken;
        return cachedCsrfToken!;
      }
    }
  } catch (err) {
    console.error('Không thể lấy CSRF token', err);
  }
  return '';
}

export function setCsrfToken(token: string | null) {
  cachedCsrfToken = token;
}

async function request<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  // Attach user context headers
  try {
    const storedUserStr = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
    if (storedUserStr) {
      const u = JSON.parse(storedUserStr);
      if (u.role && !headers.has('x-user-role')) headers.set('x-user-role', u.role);
      if (u.email && !headers.has('x-user-email')) headers.set('x-user-email', u.email);
    }
  } catch {}

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const token = await getCsrfToken();
    if (token) {
      headers.set('x-csrf-token', token);
    }
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errMsg = `Yêu cầu thất bại với mã trạng thái ${response.status}`;
    try {
      const json = await response.json();
      errMsg = json.error?.message || json.message || json.error || errMsg;
    } catch {
      // ignore non-json error body
    }
    throw new Error(errMsg);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const apiService = {
  // Authentication & Management
  async getCsrf(): Promise<string> {
    return getCsrfToken();
  },

  async login(email: string, password: string): Promise<{ user: User; csrfToken?: string }> {
    const token = await getCsrfToken();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    }

    const data = await res.json();
    if (data.csrfToken) {
      cachedCsrfToken = data.csrfToken;
    }
    if (data.user && typeof window !== 'undefined') {
      localStorage.setItem('currentUser', JSON.stringify(data.user));
    }
    return data;
  },

  async getCurrentUser(): Promise<{ user: User | null; csrfToken?: string }> {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Cache-Control': 'no-cache' },
        credentials: 'include',
      });
      if (!res.ok) {
        return { user: null };
      }
      const data = await res.json();
      if (data.csrfToken) {
        cachedCsrfToken = data.csrfToken;
      }
      if (data.user && typeof window !== 'undefined') {
        localStorage.setItem('currentUser', JSON.stringify(data.user));
      }
      return data;
    } catch {
      return { user: null };
    }
  },

  async logout(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentUser');
    }
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      cachedCsrfToken = null;
    }
  },

  async getUsers(): Promise<User[]> {
    return request<User[]>('/api/auth/users');
  },

  async inviteUser(email: string, role: 'legal' | 'clerk' | 'admin'): Promise<{ user: User; inviteLink?: string }> {
    return request('/api/auth/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  },

  async removeUser(email: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/auth/invite/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
  },

  async updateUserRole(userId: string, role: 'legal' | 'clerk' | 'admin'): Promise<{ success: boolean; user: User }> {
    return request(`/api/auth/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  async disableUser(userId: string): Promise<{ success: boolean; user: User }> {
    return request(`/api/auth/users/${encodeURIComponent(userId)}/disable`, {
      method: 'PATCH',
    });
  },

  // Payroll Ledgers & Finalization
  async getLegalPayroll(): Promise<any[]> {
    return request<any[]>('/api/payroll/legal');
  },

  async getClerkPayroll(): Promise<any[]> {
    return request<any[]>('/api/payroll/clerk');
  },

  async getPayrollDetail(id: string): Promise<any> {
    return request<any>(`/api/payroll/${encodeURIComponent(id)}`);
  },

  async finalizePayroll(workItemId: string): Promise<any> {
    return request('/api/payroll/finalize', {
      method: 'POST',
      body: JSON.stringify({ workItemId }),
    });
  },

  async createPayrollAdjustment(data: {
    entryId: string;
    deltaVnd: number;
    reason: string;
    idempotencyKey?: string;
  }): Promise<any> {
    return request('/api/payroll/adjustments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Contracts Workflow & Data
  async getContracts(params: Record<string, string | number | boolean> = {}): Promise<Contract[]> {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        query.set(k, String(v));
      }
    }
    const qs = query.toString() ? `?${query.toString()}` : '';
    const json = await request<any>(`/api/contracts${qs}`);
    if (json && Array.isArray(json.items)) {
      return json.items;
    }
    if (Array.isArray(json)) {
      return json;
    }
    return [];
  },

  async getContractsPage(params: Record<string, string | number | boolean> = {}): Promise<ContractPage> {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        query.set(k, String(v));
      }
    }
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<ContractPage>(`/api/contracts${qs}`);
  },

  async getContractById(id: string): Promise<Contract> {
    return request<Contract>(`/api/contracts/${encodeURIComponent(id)}`);
  },

  async uploadContract(file: File, uploadedBy: string): Promise<Contract> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedBy', uploadedBy);

    return request<Contract>('/api/contracts', {
      method: 'POST',
      body: formData,
    });
  },

  async checkContractId(contractNumber: string): Promise<{ exists: boolean }> {
    return request<{ exists: boolean }>(`/api/contracts/check-id/${encodeURIComponent(contractNumber)}`);
  },

  async createContractManual(contractData: {
    name: string;
    contractNumber: string;
    partnerName: string;
    value: string;
    signDate: string;
    effectiveDate: string;
    uploadedBy: string;
    googleDocsLink: string;
    receiverName: string;
    receiverPhone: string;
    receiverAddress: string;
    deliveryNotes?: string;
    processingMethod: 'physical' | 'digital';
    printCopies?: number;
  }): Promise<Contract> {
    return request<Contract>('/api/contracts/manual', {
      method: 'POST',
      body: JSON.stringify(contractData),
    });
  },

  async requestDraftContract(data: any): Promise<Contract> {
    return request<Contract>('/api/contracts/request-draft', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async submitDraftContract(contractId: string, updatedBy: string, file?: File, googleDocsLink?: string): Promise<Contract> {
    const formData = new FormData();
    formData.append('updatedBy', updatedBy);
    if (googleDocsLink) formData.append('googleDocsLink', googleDocsLink);
    if (file) formData.append('file', file);

    return request<Contract>(`/api/contracts/${encodeURIComponent(contractId)}/submit-draft`, {
      method: 'POST',
      body: formData,
    });
  },

  async feedbackDraftContract(contractId: string, updatedBy: string, note: string): Promise<Contract> {
    return request<Contract>(`/api/contracts/${encodeURIComponent(contractId)}/feedback-draft`, {
      method: 'POST',
      body: JSON.stringify({ updatedBy, note }),
    });
  },

  async approveSoftCopy(contractId: string, updatedBy: string): Promise<void> {
    await request(`/api/contracts/${encodeURIComponent(contractId)}/approve-soft-copy`, {
      method: 'POST',
      body: JSON.stringify({ updatedBy }),
    });
  },

  async printContract(contractId: string, updatedBy: string): Promise<void> {
    await request(`/api/contracts/${encodeURIComponent(contractId)}/print`, {
      method: 'POST',
      body: JSON.stringify({ updatedBy }),
    });
  },

  async signContract(contractId: string, updatedBy: string): Promise<void> {
    await request(`/api/contracts/${encodeURIComponent(contractId)}/sign`, {
      method: 'POST',
      body: JSON.stringify({ updatedBy }),
    });
  },

  async assignWaybill(contractId: string, waybillCode: string, updatedBy: string): Promise<void> {
    await request(`/api/contracts/${encodeURIComponent(contractId)}/waybill`, {
      method: 'POST',
      body: JSON.stringify({ waybillCode, updatedBy }),
    });
  },

  async uploadScanFile(contractId: string, file: File, uploadedBy: string): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedBy', uploadedBy);

    await request(`/api/contracts/${encodeURIComponent(contractId)}/scan`, {
      method: 'POST',
      body: formData,
    });
  },

  async uploadScanBlob(contractId: string, pdfBlob: Blob, uploadedBy: string): Promise<void> {
    const scanFileObj = new File([pdfBlob], `contract_scan_${contractId}.pdf`, { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', scanFileObj);
    formData.append('uploadedBy', uploadedBy);

    await request(`/api/contracts/${encodeURIComponent(contractId)}/scan`, {
      method: 'POST',
      body: formData,
    });
  },

  async archiveContract(contractId: string, updatedBy: string): Promise<void> {
    await request(`/api/contracts/${encodeURIComponent(contractId)}/archive`, {
      method: 'POST',
      body: JSON.stringify({ updatedBy }),
    });
  },

  async qrTransitionContract(contractId: string, updatedBy: string): Promise<any> {
    return request(`/api/contracts/${encodeURIComponent(contractId)}/qr-transition`, {
      method: 'POST',
      body: JSON.stringify({ updatedBy }),
    });
  },

  async rejectContract(contractId: string, updatedBy: string, note: string): Promise<void> {
    await request(`/api/contracts/${encodeURIComponent(contractId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ updatedBy, note }),
    });
  },

  async reportIssue(contractId: string, updatedBy: string, note: string): Promise<void> {
    await request(`/api/contracts/${encodeURIComponent(contractId)}/report-issue`, {
      method: 'POST',
      body: JSON.stringify({ updatedBy, note }),
    });
  },

  async redraftContract(contractId: string, updatedBy: string, note: string): Promise<void> {
    await request(`/api/contracts/${encodeURIComponent(contractId)}/redraft`, {
      method: 'POST',
      body: JSON.stringify({ updatedBy, note }),
    });
  },

  async reshipContract(contractId: string, updatedBy: string, note: string): Promise<void> {
    await request(`/api/contracts/${encodeURIComponent(contractId)}/reship`, {
      method: 'POST',
      body: JSON.stringify({ updatedBy, note }),
    });
  },

  async cancelContract(contractId: string, updatedBy: string, note: string): Promise<void> {
    await request(`/api/contracts/${encodeURIComponent(contractId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ updatedBy, note }),
    });
  },

  async editContract(contractId: string, fields: Partial<Contract>, updatedBy: string, note: string): Promise<void> {
    await request(`/api/contracts/${encodeURIComponent(contractId)}/edit`, {
      method: 'PUT',
      body: JSON.stringify({ ...fields, updatedBy, note }),
    });
  },

  async updateContractStatus(contractId: string, status: string, updatedBy: string, note?: string): Promise<void> {
    await request(`/api/contracts/${encodeURIComponent(contractId)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, updatedBy, note }),
    });
  },

  async toggleVtpConnection(): Promise<{ vtpConnectionStatus: 'connected' | 'disconnected' }> {
    return request('/api/settings/toggle-vtp', {
      method: 'POST',
    });
  },

  // Settings & Configuration
  async getSettings(): Promise<SettingsState> {
    return request<SettingsState>('/api/settings');
  },

  async saveSettings(settings: SettingsState): Promise<void> {
    await request('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  // Reports
  async getReports(): Promise<ReportsData> {
    return request<ReportsData>('/api/dashboard/reports');
  },

  // Simulators
  async getSimLogs(): Promise<SimLog[]> {
    return request<SimLog[]>('/api/sim/logs');
  },

  async simulateVtpWebhook(waybillCode: string, status: string, note: string): Promise<void> {
    await request('/api/sim/vtp-webhook', {
      method: 'POST',
      body: JSON.stringify({
        waybillCode,
        status,
        note,
        location: 'Bưu cục Hà Nội Đống Đa',
      }),
    });
  },

  async runSlaCheck(): Promise<void> {
    await request('/api/sim/run-sla-check', {
      method: 'POST',
    });
  },
};
