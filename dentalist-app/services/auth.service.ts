export class AuthService {
  static async login(dni: string, password: string, type: string) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, password, type }),
    });
    return response.json();
  }

  static async verifyTwoFactor(dni: string, code: string, type: string) {
    const response = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ dni, code, type }),
    });
    return response.json();
  }

  static async resendTwoFactor(dni: string, type: string) {
    const response = await fetch('/api/auth/2fa/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, type }),
    });
    return response.json();
  }

  static async register(data: {
    dni: string;
    name: string;
    email: string;
    password: string;
    type: string;
  }) {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  static async getCurrentUser() {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.user ?? null;
  }

  static storeSession(token: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('token', token);
    document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
  }

  static async logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      document.cookie = 'token=; path=/; max-age=0';
      window.location.href = '/login';
    }
  }

  static getToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }
}
