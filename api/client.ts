const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;

/** 데모: VITE_API_URL=demo 또는 개발 환경에서 미설정 */
export const isDemoMode =
    configuredApiUrl === 'demo' ||
    (import.meta.env.MODE === 'development' && !configuredApiUrl);

function getApiBaseUrl(): string {
    if (isDemoMode) return '';
    // 프로덕션은 항상 same-origin (Railway 빌드 env에 외부 API URL이 남아 있어도 무시)
    if (import.meta.env.PROD && typeof window !== 'undefined') {
        return window.location.origin.replace(/\/$/, '');
    }
    if (!configuredApiUrl || configuredApiUrl === 'same-origin') {
        if (typeof window !== 'undefined') {
            return window.location.origin.replace(/\/$/, '');
        }
        return '';
    }
    return configuredApiUrl.replace(/\/$/, '');
}

export interface ApiUser {
    uid: string;
    email: string | null;
    role: 'master' | 'admin';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${res.status}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

export const api = {
    login: (email: string, password: string) =>
        request<{ user: ApiUser }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

    me: () => request<{ user: ApiUser }>('/api/auth/me'),

    changePassword: (currentPassword: string, newPassword: string) =>
        request<{ ok: boolean }>('/api/auth/password', {
            method: 'PATCH',
            body: JSON.stringify({ currentPassword, newPassword }),
        }),

    getAppData: () =>
        request<{ data: Record<string, unknown> | null; lastUpdatedAt: number }>('/api/app-data'),

    saveAppData: (data: Record<string, unknown>) =>
        request<{ ok: boolean; lastUpdatedAt: number }>('/api/app-data', {
            method: 'PUT',
            body: JSON.stringify({ data }),
        }),

    getMasterUsers: () =>
        request<{ managedUsers: Array<{ uid: string; email: string; status: 'active' | 'disabled' }> }>(
            '/api/master/users'
        ),

    createMasterUser: (email: string, password: string) =>
        request<{ managedUser: { uid: string; email: string; status: string } }>('/api/master/users', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    updateMasterUserStatus: (uid: string, status: 'active' | 'disabled') =>
        request<{ managedUser: { uid: string; email: string; status: string } }>(
            `/api/master/users/${uid}/status`,
            { method: 'PATCH', body: JSON.stringify({ status }) }
        ),

    deleteMasterUser: (uid: string) =>
        request<{ ok: boolean }>(`/api/master/users/${uid}`, { method: 'DELETE' }),

    subscribeAppData: (onUpdate: (lastUpdatedAt: number) => void) => {
        if (isDemoMode) return () => {};
        const es = new EventSource(`${getApiBaseUrl()}/api/app-data/stream`, { withCredentials: true });
        es.addEventListener('update', (e) => {
            try {
                const payload = JSON.parse((e as MessageEvent).data);
                onUpdate(payload.lastUpdatedAt);
            } catch {
                // ignore
            }
        });
        return () => es.close();
    },
};
