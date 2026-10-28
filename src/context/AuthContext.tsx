'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Models, ID } from 'appwrite';
import { getAppwriteClient } from '@/lib/appwrite/client';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getJWT: () => Promise<string>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const { account } = getAppwriteClient();
      const currentUser = await account.get();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const { account } = getAppwriteClient();
    try {
      // Clear any stale local session before creating a new one
      await account.deleteSession({ sessionId: 'current' }).catch(() => {});
    } catch {
      // ignore
    }
    await account.createEmailPasswordSession({ email, password });
    await refreshUser();
    router.push('/');
  };

  const signup = async (name: string, email: string, password: string) => {
    const { account } = getAppwriteClient();
    await account.create({
      userId: ID.unique(),
      email,
      password,
      name,
    });
    // Automatically log in upon successful signup
    await account.createEmailPasswordSession({ email, password });
    await refreshUser();
    router.push('/');
  };

  const logout = async () => {
    const { account } = getAppwriteClient();
    try {
      await account.deleteSession({ sessionId: 'current' });
    } catch (err) {
      console.warn('Logout error (session might already be deleted):', err);
    }
    setUser(null);
    router.push('/login');
  };

  const getJWT = async (): Promise<string> => {
    const { account } = getAppwriteClient();
    const jwtObj = await account.createJWT();
    return jwtObj.jwt;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        getJWT,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
