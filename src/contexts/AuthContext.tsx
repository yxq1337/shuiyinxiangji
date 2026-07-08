import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiPost, apiGet } from '../lib/api';

interface User {
  id: string;
  phone: string;
  isVip: boolean;
  vipExpiresAt: string | null;
  createdAt: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phone: string) => Promise<void>;
  loginAdmin: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (phone: string) => {
    const data = await apiPost('/api/auth/login', { phone });
    if (data.success) {
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    } else {
      throw new Error(data.error || '登录失败');
    }
  };

  const loginAdmin = async (username: string, password: string) => {
    const data = await apiPost('/api/auth/login', { username, password });
    if (data.success) {
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    } else {
      throw new Error(data.error || '登录失败');
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const data = await apiGet(`/api/auth/me/${user.id}`);
      if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
    } catch (e) {
      console.error('刷新用户信息失败', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginAdmin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
