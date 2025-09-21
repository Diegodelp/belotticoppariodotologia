import { useState, useEffect } from 'react';
import { AuthService } from '@/services/auth.service';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = AuthService.getToken();
    if (token) {
      // TODO: Validate token and get user
    }
    setLoading(false);
  }, []);

  return { user, loading };
}
