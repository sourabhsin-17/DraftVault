import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, setMemoryCsrfToken } from '../lib/api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  setAuthenticatedUser: (user: User | null, csrfToken: string | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const setAuthenticatedUser = useCallback((nextUser: User | null, csrfToken: string | null) => {
    setMemoryCsrfToken(csrfToken);
    setUser(nextUser);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: User | null; csrfToken: string | null }>('/api/auth/me');
      setMemoryCsrfToken(data.csrfToken);
      setUser(data.user);
    } catch {
      setMemoryCsrfToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      setMemoryCsrfToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, setAuthenticatedUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
