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
  updateProfile,
  verifyParentPinRemote,
  type ProfilePatch,
  type RegisterInput,
} from '../lib/authApi';
import { clearSession, loadSession, saveSession } from '../lib/session';
import { loadAppLock, saveAppLock } from '../lib/session';
import type { AuthSession } from '../types';

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
  /** Đăng ký. Không có tham số vai trò: tài khoản mới luôn là học sinh. */
  signUp: (input: RegisterInput) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;

  /** Cập nhật hồ sơ (họ tên / khối lớp / avatar); cập nhật cả session đã lưu */
  updateProfile: (patch: ProfilePatch) => Promise<AuthActionResult>;
  /** Kiểm tra mã PIN phụ huynh (xác thực ở server) */
  verifyPin: (pin: string) => Promise<AuthActionResult>;
  /**
   * Đặt hoặc đổi mã PIN phụ huynh.
   *
   * Chưa có PIN thì `oldPin` bị bỏ qua — đây chính là luồng "thiết lập PIN" lần
   * đầu, vì tài khoản đăng ký mới không còn được đặt PIN ngay lúc tạo.
   */
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
    async (input: RegisterInput): Promise<AuthActionResult> => {
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

  const updateProfileAction = useCallback(
    async (patch: ProfilePatch): Promise<AuthActionResult> => {
      if (!session) return { ok: false, error: 'Chưa đăng nhập.' };

      const result = await updateProfile(session.token, patch);
      if (!result.ok) return { ok: false, error: result.error };

      await saveSession(result.data);
      setSession(result.data);
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
      if (!result.ok) return { ok: false, error: result.error };

      // Đặt PIN lần đầu thì phải ghi lại vào phiên, nếu không màn hình Cài đặt
      // vẫn hiện "Thiết lập mã PIN" dù đã đặt xong.
      if (!session.hasPin) {
        const next = { ...session, hasPin: true };
        await saveSession(next);
        setSession(next);
      }
      // Vừa đặt/đổi PIN thì coi như đã xác thực trong phiên này
      setPinUnlocked(true);
      return { ok: true };
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
      updateProfile: updateProfileAction,
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
      updateProfileAction,
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
