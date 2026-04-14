// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getToken, getRole, getProfile, clearAuth, saveAuth } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token,   setToken]   = useState(null);
  const [role,    setRole]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Always clear session on app start — login required every time
      await clearAuth();
      setToken(null); setRole(null); setProfile(null);
      setLoading(false);
    })();
  }, []);

  const login = async (tokenVal, roleVal, profileVal) => {
    await saveAuth(tokenVal, roleVal, profileVal);
    setToken(tokenVal); setRole(roleVal); setProfile(profileVal);
  };

  const logout = async () => {
    await clearAuth();
    setToken(null); setRole(null); setProfile(null);
  };

  const refreshAuth = async () => {
    const [t, r, p] = await Promise.all([getToken(), getRole(), getProfile()]);
    setToken(t); setRole(r); setProfile(p);
  };

  return (
    <AuthContext.Provider value={{ token, role, profile, loading, login, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
