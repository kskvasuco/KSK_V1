import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const me = await authApi.getMe();
      setRole(me.role);
      setProfile(me.profile);
    } catch {
      setRole(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (identifier, password, roleHint) => {
    const result = await authApi.login(identifier, password, roleHint);
    setRole(result.role);
    setProfile(result.profile);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setRole(null);
    setProfile(null);
  }, []);

  const value = {
    role,
    profile,
    loading,
    isAuthenticated: !!role,
    isUser: role === 'user',
    isAdmin: role === 'admin',
    isStaff: role === 'staff',
    login,
    logout,
    checkAuth,
    setProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
