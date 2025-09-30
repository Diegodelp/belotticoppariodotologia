import { useState, useEffect, useCallback } from 'react';
import { AuthService } from '@/services/auth.service';
import { User } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const current = await AuthService.getCurrentUser();
      setUser(current);
    } catch (error) {
      console.error('Error al obtener la sesión', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    refresh,
  };
}
