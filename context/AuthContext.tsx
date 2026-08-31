import type { Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isSupabaseConfigured, supabase } from '../lib/supabase';

/** Kết quả một hành động xác thực, đã dịch sẵn thông báo lỗi sang tiếng Việt */
export interface AuthActionResult {
  ok: boolean;
  error?: string;
  /**
   * `true` khi Supabase đã tạo tài khoản nhưng chưa có session vì đang chờ
   * phụ huynh bấm liên kết xác nhận trong email.
   */
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  /** Đã điền đủ biến môi trường Supabase hay chưa */
  isConfigured: boolean;
  /** `true` khi còn đang đọc session đã lưu */
  initializing: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const NOT_CONFIGURED: AuthActionResult = {
  ok: false,
  error:
    'Chưa cấu hình Supabase. Hãy điền EXPO_PUBLIC_SUPABASE_URL và ' +
    'EXPO_PUBLIC_SUPABASE_ANON_KEY vào tệp .env rồi chạy lại: npx expo start -c',
};

/** Dịch các thông báo lỗi thường gặp của Supabase Auth sang tiếng Việt */
function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Email hoặc mật khẩu không đúng.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.';
  }
  if (normalized.includes('user already registered')) {
    return 'Email này đã được đăng ký. Hãy chuyển sang Đăng nhập.';
  }
  if (normalized.includes('password should be at least')) {
    return 'Mật khẩu phải có ít nhất 6 ký tự.';
  }
  if (normalized.includes('unable to validate email address')) {
    return 'Địa chỉ email không hợp lệ.';
  }
  if (normalized.includes('email rate limit') || normalized.includes('too many')) {
    return 'Bạn thử quá nhiều lần. Vui lòng đợi một lát rồi thử lại.';
  }
  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'Không kết nối được tới Supabase. Kiểm tra mạng và URL dự án.';
  }
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(isSupabaseConfigured);

  // ----- Đọc session đã lưu & lắng nghe thay đổi -----
  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setSession(data.session);
      })
      .catch((error) => console.warn('[auth] getSession lỗi:', error))
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    // Callback phải đồng bộ: gọi hàm async của supabase bên trong callback này
    // có thể gây deadlock, nên chỉ cập nhật state ở đây.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  // ----- Chỉ tự làm mới token khi app đang ở tiền cảnh -----
  useEffect(() => {
    if (!supabase) return;

    const client = supabase;
    if (AppState.currentState === 'active') client.auth.startAutoRefresh();

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          client.auth.startAutoRefresh();
        } else {
          client.auth.stopAutoRefresh();
        }
      },
    );

    return () => {
      subscription.remove();
      client.auth.stopAutoRefresh();
    };
  }, []);

  // ----- Hành động -----
  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      if (!supabase) return NOT_CONFIGURED;

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return { ok: false, error: translateAuthError(error.message) };
      return { ok: true };
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      if (!supabase) return NOT_CONFIGURED;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) return { ok: false, error: translateAuthError(error.message) };

      // Mặc định Supabase bắt xác nhận email trước khi tạo session.
      return { ok: true, needsEmailConfirmation: data.session === null };
    },
    [],
  );

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    if (!supabase) return NOT_CONFIGURED;

    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, error: translateAuthError(error.message) };
    return { ok: true };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isSupabaseConfigured,
      initializing,
      session,
      user: session?.user ?? null,
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
  if (!context) {
    throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  }
  return context;
}
