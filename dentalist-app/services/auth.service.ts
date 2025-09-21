export class AuthService {
  static async login(dni: string, password: string, type: string) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, password, type })
    });
    return response.json();
  }

  static async logout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  static getToken() {
    return localStorage.getItem('token');
  }
}
