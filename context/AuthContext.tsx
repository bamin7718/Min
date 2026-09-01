import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { isApiConfigured, loginAccount, registerAccount } from '../lib/authApi';
import { clearSession, loadSession, saveSession } from '../lib/session';
import type { AuthSession, UserRole } from '../types';

export interface AuthActionResult {
  ok: boolean;
  error?: string;
}

interface AuthContextValue {
  /** Đã cấu hình máy chủ đồng bộ chưa */
  isConfigured: boolean;
  /** `true` khi còn đang đọc phiên đã lưu */
  initializing: boolean;
  /** Tài khoản đang đăng nhập, `null` nếu chưa */
  session: AuthSession | null;
  signIn: (username: string, password: string) => Promise<AuthActionResult>;
  signUp: (input: {
    username: string;
    password: string;
    role: UserRole;
    pin?: string;
  }) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Đọc phiên đã lưu để mở lại app là vẫn đăng nhập
  useEffect(() => {
    let cancelled = false;
    loadSession()
      .then((saved) => {
        if (!cancelled) setSession(saved);
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (username: string, password: string): Promise<AuthActionResult> => {
      const result = await loginAccount({ username, password });
      if (!result.ok) return { ok: false, error: result.error };

      await saveSession(result.data);
      setSession(result.data);
      return { ok: true };
    },
    [],
  );

  const signUp = useCallback(
    async (input: {
      username: string;
      password: string;
      role: UserRole;
      pin?: string;
    }): Promise<AuthActionResult> => {
      const result = await registerAccount(input);
      if (!result.ok) return { ok: false, error: result.error };

      await saveSession(result.data);
      setSession(result.data);
      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await clearSession();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isApiConfigured,
      initializing,
      session,
      signIn,
      signUp,
      signOut,
    }),
    [initializing, session, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  return context;
}
