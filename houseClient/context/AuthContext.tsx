import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';

interface User {
  id: number;
  name?: string;
  email: string;
  storage_quota?: number;
  files?: any;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedUser = await secureStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('SecureStore error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          setUser(data.user);
          await secureStorage.setItem('user', JSON.stringify(data.user));
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error('Login error:', e);
      return false;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        return await login(email, password);
      }
      return false;
    } catch (e) {
      console.error('Register error:', e);
      return false;
    }
  };

  const logout = async () => {
    try {
      // Use the API_BASE_URL for consistency
      await fetch(`${API_BASE_URL}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      console.error('Logout error:', e);
    }
    setUser(null);
    try {
      await secureStorage.deleteItem('user');
    } catch (e) {
      console.error('SecureStore delete error:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// Create a web-compatible version of SecureStore for development
const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      // Use localStorage as a fallback on web
      console.log(`Using localStorage fallback for SecureStore.getItemAsync('${key}')`);
      return localStorage.getItem(key);
    } else {
      // Use actual SecureStore on native platforms
      return await SecureStore.getItemAsync(key);
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      // Use localStorage as a fallback on web
      console.log(`Using localStorage fallback for SecureStore.setItemAsync('${key}')`);
      localStorage.setItem(key, value);
      return Promise.resolve();
    } else {
      // Use actual SecureStore on native platforms
      return await SecureStore.setItemAsync(key, value);
    }
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      // Use localStorage as a fallback on web
      console.log(`Using localStorage fallback for SecureStore.deleteItemAsync('${key}')`);
      localStorage.removeItem(key);
      return Promise.resolve();
    } else {
      // Use actual SecureStore on native platforms
      return await SecureStore.deleteItemAsync(key);
    }
  }
};
