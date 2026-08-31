// Hermes chưa có URL API đầy đủ — supabase-js cần polyfill này trên React Native.
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { ProgressSyncPayload, QuizResult, SyncResult } from '../types';

/**
 * Supabase Client (dự phòng / tuỳ chọn).
 *
 * Ứng dụng chạy hoàn toàn offline bằng AsyncStorage. Supabase chỉ dùng để
 * đồng bộ tiến độ giữa nhiều thiết bị. Nếu chưa cấu hình biến môi trường thì
 * mọi hàm ở đây sẽ "no-op" một cách an toàn, ứng dụng vẫn hoạt động bình thường.
 *
 * Cách bật: điền `EXPO_PUBLIC_SUPABASE_URL` và `EXPO_PUBLIC_SUPABASE_ANON_KEY`
 * vào tệp `.env` rồi khởi động lại Metro với `npx expo start -c`.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

/** `true` khi đã cấu hình đủ URL và Anon Key */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Bắt buộc tắt trên React Native: không có URL callback như trên web.
        detectSessionInUrl: false,
      },
    })
  : null;

if (!isSupabaseConfigured && __DEV__) {
  console.log(
    '[supabase] Chưa cấu hình EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — ' +
      'ứng dụng đang chạy ở chế độ offline (AsyncStorage).',
  );
}

/** Tên các bảng trên Supabase (xem SQL mẫu trong README) */
export const TABLES = {
  userProgress: 'user_progress',
  quizResults: 'quiz_results',
} as const;

/**
 * Tải tiến độ của học sinh từ Supabase.
 * `data` là `null` khi tài khoản chưa có bản ghi nào (lần đầu đăng nhập).
 */
export async function fetchRemoteProgress(
  userId: string,
): Promise<SyncResult<ProgressSyncPayload | null>> {
  if (!supabase) return { ok: false, error: 'Chưa cấu hình Supabase.' };

  const { data, error } = await supabase
    .from(TABLES.userProgress)
    .select(
      'total_points, accumulated_game_minutes, mastered_question_ids, last_updated',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, data: null };

  return {
    ok: true,
    data: {
      totalPoints: data.total_points ?? 0,
      accumulatedGameMinutes: data.accumulated_game_minutes ?? 0,
      masteredQuestionIds: Array.isArray(data.mastered_question_ids)
        ? data.mastered_question_ids
        : [],
      lastUpdated: data.last_updated ?? new Date().toISOString(),
    },
  };
}

/** Đẩy tiến độ hiện tại lên Supabase */
export async function pushRemoteProgress(
  userId: string,
  progress: ProgressSyncPayload,
): Promise<SyncResult<null>> {
  if (!supabase) return { ok: false, error: 'Chưa cấu hình Supabase.' };

  const { error } = await supabase.from(TABLES.userProgress).upsert(
    {
      user_id: userId,
      total_points: progress.totalPoints,
      accumulated_game_minutes: progress.accumulatedGameMinutes,
      mastered_question_ids: progress.masteredQuestionIds,
      last_updated: progress.lastUpdated,
    },
    { onConflict: 'user_id' },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/** Lưu lịch sử một bài test lên Supabase (nếu đã cấu hình) */
export async function saveQuizResult(
  userId: string,
  result: QuizResult,
): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase.from(TABLES.quizResults).insert({
    id: result.id,
    user_id: userId,
    subject: result.subject,
    total_questions: result.totalQuestions,
    correct_count: result.correctCount,
    points_earned: result.pointsEarned,
    minutes_earned: result.minutesEarned,
    answers: result.answers,
    completed_at: result.completedAt,
  });

  if (error) {
    console.warn('[supabase] saveQuizResult lỗi:', error.message);
    return false;
  }
  return true;
}
