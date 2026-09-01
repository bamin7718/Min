import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  changeParentPin,
  isApiConfigured,
  loginAccount,
  registerAccount,
  renameAccount,
  verifyParentPinRemote,
} from '../lib/authApi';
import { clearSession, loadSession, saveSession } from '../lib/session';
import { loadAppLock, saveAppLock } from '../lib/session';
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

  /** Đổi tên hiển thị; cập nhật cả session đã lưu */
  updateUserName: (username: string) => Promise<AuthActionResult>;
  /** Kiểm tra mã PIN phụ huynh (xác thực ở server) */
  verifyPin: (pin: string) => Promise<AuthActionResult>;
  /** Đổi mã PIN phụ huynh */
  changePin: (oldPin: string, newPin: string) => Promise<AuthActionResult>;

  /**
   * Phụ huynh đã nhập đúng PIN trong phiên này chưa.
   * Giữ ở bộ nhớ (không lưu xuống máy) nên mở lại app là phải nhập lại.
   */
  pinUnlocked: boolean;
  setPinUnlocked: (value: boolean) => void;

  /** Có bắt nhập PIN ngay khi mở ứng dụng hay không */
  appLockEnabled: boolean;
  setAppLockEnabled: (value: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [appLockEnabled, setAppLockEnabledState] = useState(false);

  // Đọc phiên đã lưu để mở lại app là vẫn đăng nhập
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadSession(), loadAppLock()])
      .then(([saved, lock]) => {
        if (cancelled) return;
        setSession(saved);
        setAppLockEnabledState(lock);
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
    setPinUnlocked(false);
  }, []);

  const updateUserName = useCallback(
    async (username: string): Promise<AuthActionResult> => {
      if (!session) return { ok: false, error: 'Chưa đăng nhập.' };

      const result = await renameAccount(session.token, username);
      if (!result.ok) return { ok: false, error: result.error };

      const next = { ...session, username: result.data };
      await saveSession(next);
      setSession(next);
      return { ok: true };
    },
    [session],
  );

  const verifyPin = useCallback(
    async (pin: string): Promise<AuthActionResult> => {
      if (!session) return { ok: false, error: 'Chưa đăng nhập.' };

      const result = await verifyParentPinRemote(session.token, pin);
      if (!result.ok) return { ok: false, error: result.error };

      setPinUnlocked(true);
      return { ok: true };
    },
    [session],
  );

  const changePin = useCallback(
    async (oldPin: string, newPin: string): Promise<AuthActionResult> => {
      if (!session) return { ok: false, error: 'Chưa đăng nhập.' };

      const result = await changeParentPin(session.token, oldPin, newPin);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    },
    [session],
  );

  const setAppLockEnabled = useCallback(async (value: boolean) => {
    setAppLockEnabledState(value);
    await saveAppLock(value);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isApiConfigured,
      initializing,
      session,
      signIn,
      signUp,
      signOut,
      updateUserName,
      verifyPin,
      changePin,
      pinUnlocked,
      setPinUnlocked,
      appLockEnabled,
      setAppLockEnabled,
    }),
    [
      initializing,
      session,
      signIn,
      signUp,
      signOut,
      updateUserName,
      verifyPin,
      changePin,
      pinUnlocked,
      appLockEnabled,
      setAppLockEnabled,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  return context;
}
