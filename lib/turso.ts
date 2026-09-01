// Dùng export `/web`: bản này chạy trên `fetch` nên hoạt động ở Vercel Edge,
// Node và cả React Native. Export gốc `@libsql/client` phụ thuộc native module
// `libsql` nên không bundle được cho app.
import { createClient, type Client } from '@libsql/client/web';

import type { ProgressSyncPayload, UserRole } from '../types';

/**
 * Tầng truy cập Turso (libSQL).
 *
 * File này CHỈ chạy phía server (`api/*`). App không import nó, nhờ vậy token
 * Turso không bao giờ vào bundle và `@libsql/client` cũng không làm nặng app.
 *
 * Vì libSQL không có Row Level Security, mọi hàm dưới đây đều nhận `userId` và
 * đưa vào `WHERE user_id = ?` — đó là điểm thực thi phân quyền dữ liệu.
 */

export interface TursoConfig {
  url: string;
  authToken: string;
}

/** Cấu hình phía server (không có tiền tố EXPO_PUBLIC) */
export function serverTursoConfig(): TursoConfig | null {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) return null;
  return { url, authToken };
}

/**
 * Cấu hình nhúng trong app.
 *
 * KHÔNG dùng cho bản phát hành: token sẽ nằm trong bundle công khai, ai cũng
 * đọc được bảng `users` (kể cả password_hash) và ghi/xoá tuỳ ý.
 */
export function publicTursoConfig(): TursoConfig | null {
  const url = process.env.EXPO_PUBLIC_TURSO_DATABASE_URL?.trim();
  const authToken = process.env.EXPO_PUBLIC_TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) return null;
  return { url, authToken };
}

export function createTursoClient(config: TursoConfig): Client {
  return createClient({ url: config.url, authToken: config.authToken });
}

/* ------------------------------------------------------------------ */
/* Khởi tạo bảng                                                       */
/* ------------------------------------------------------------------ */

/** Tạo toàn bộ bảng nếu chưa có. An toàn khi gọi nhiều lần. */
export async function initDatabase(client: Client): Promise<void> {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
         id            TEXT PRIMARY KEY,
         username      TEXT NOT NULL UNIQUE,
         password_hash TEXT NOT NULL,
         role          TEXT NOT NULL CHECK (role IN ('student', 'parent')),
         pin_code      TEXT,
         created_at    TEXT NOT NULL
       )`,
      `CREATE TABLE IF NOT EXISTS user_progress (
         id                       TEXT PRIMARY KEY,
         user_id                  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
         subject                  TEXT NOT NULL DEFAULT 'chung',
         completed_week           INTEGER NOT NULL DEFAULT 0,
         total_points             INTEGER NOT NULL DEFAULT 0,
         accumulated_game_minutes INTEGER NOT NULL DEFAULT 0,
         mastered_question_ids    TEXT NOT NULL DEFAULT '[]',
         updated_at               TEXT NOT NULL,
         UNIQUE (user_id, subject)
       )`,
      `CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress (user_id)`,
      `CREATE TABLE IF NOT EXISTS quiz_results (
         id              TEXT PRIMARY KEY,
         user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
         subject         TEXT NOT NULL,
         week_number     INTEGER,
         total_questions INTEGER NOT NULL,
         correct_count   INTEGER NOT NULL,
         points_earned   INTEGER NOT NULL,
         minutes_earned  INTEGER NOT NULL,
         answers         TEXT NOT NULL DEFAULT '[]',
         completed_at    TEXT NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS idx_quiz_results_user
         ON quiz_results (user_id, completed_at DESC)`,
    ],
    'write',
  );
}

/* ------------------------------------------------------------------ */
/* Bảng users                                                          */
/* ------------------------------------------------------------------ */

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  /** Hash của PIN phụ huynh, `null` với học sinh */
  pinHash: string | null;
  createdAt: string;
}

function toInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function rowToUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    username: String(row.username),
    passwordHash: String(row.password_hash),
    role: row.role === 'parent' ? 'parent' : 'student',
    pinHash: row.pin_code === null || row.pin_code === undefined ? null : String(row.pin_code),
    createdAt: String(row.created_at),
  };
}

/** Tìm người dùng theo tên đăng nhập. So sánh không phân biệt hoa thường. */
export async function findUserByUsername(
  client: Client,
  username: string,
): Promise<UserRecord | null> {
  const result = await client.execute({
    sql: `SELECT id, username, password_hash, role, pin_code, created_at
            FROM users WHERE lower(username) = lower(?)`,
    args: [username],
  });
  const row = result.rows[0];
  return row ? rowToUser(row as unknown as Record<string, unknown>) : null;
}

export async function findUserById(
  client: Client,
  userId: string,
): Promise<UserRecord | null> {
  const result = await client.execute({
    sql: `SELECT id, username, password_hash, role, pin_code, created_at
            FROM users WHERE id = ?`,
    args: [userId],
  });
  const row = result.rows[0];
  return row ? rowToUser(row as unknown as Record<string, unknown>) : null;
}

/**
 * Tạo tài khoản mới KÈM một bản ghi tiến độ khởi tạo, trong cùng một
 * transaction để không bao giờ có user thiếu tiến độ.
 * Trả về `false` nếu tên đăng nhập đã tồn tại.
 */
export async function createUser(
  client: Client,
  user: {
    id: string;
    username: string;
    passwordHash: string;
    role: UserRole;
    pinHash: string | null;
  },
  progressId: string,
): Promise<boolean> {
  const existing = await findUserByUsername(client, user.username);
  if (existing) return false;

  const now = new Date().toISOString();
  const tx = await client.transaction('write');
  try {
    await tx.execute({
      sql: `INSERT INTO users (id, username, password_hash, role, pin_code, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [user.id, user.username, user.passwordHash, user.role, user.pinHash, now],
    });
    await tx.execute({
      sql: `INSERT INTO user_progress (
              id, user_id, subject, completed_week, total_points,
              accumulated_game_minutes, mastered_question_ids, updated_at
            ) VALUES (?, ?, 'chung', 0, 0, 0, '[]', ?)`,
      args: [progressId, user.id, now],
    });
    await tx.commit();
    return true;
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Bảng user_progress — luôn ràng buộc theo user_id                    */
/* ------------------------------------------------------------------ */

function parseIdList(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Đọc tiến độ CỦA CHÍNH user đó. `null` khi chưa có bản ghi. */
export async function readProgress(
  client: Client,
  userId: string,
): Promise<ProgressSyncPayload | null> {
  const result = await client.execute({
    sql: `SELECT total_points, accumulated_game_minutes, mastered_question_ids,
                 completed_week, updated_at
            FROM user_progress
           WHERE user_id = ? AND subject = 'chung'`,
    args: [userId],
  });

  const row = result.rows[0];
  if (!row) return null;

  return {
    totalPoints: toInt(row.total_points),
    accumulatedGameMinutes: toInt(row.accumulated_game_minutes),
    masteredQuestionIds: parseIdList(row.mastered_question_ids),
    highestCompletedWeek: toInt(row.completed_week),
    lastUpdated: String(row.updated_at),
  };
}

/** Ghi tiến độ CỦA CHÍNH user đó (upsert theo user_id + subject) */
export async function writeProgress(
  client: Client,
  userId: string,
  progressId: string,
  progress: ProgressSyncPayload,
): Promise<void> {
  await client.execute({
    sql: `INSERT INTO user_progress (
            id, user_id, subject, completed_week, total_points,
            accumulated_game_minutes, mastered_question_ids, updated_at
          ) VALUES (?, ?, 'chung', ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, subject) DO UPDATE SET
            completed_week = excluded.completed_week,
            total_points = excluded.total_points,
            accumulated_game_minutes = excluded.accumulated_game_minutes,
            mastered_question_ids = excluded.mastered_question_ids,
            updated_at = excluded.updated_at
          WHERE user_progress.user_id = ?`,
    args: [
      progressId,
      userId,
      Math.max(0, Math.floor(progress.highestCompletedWeek)),
      Math.max(0, Math.floor(progress.totalPoints)),
      Math.max(0, Math.floor(progress.accumulatedGameMinutes)),
      JSON.stringify(progress.masteredQuestionIds),
      progress.lastUpdated,
      userId,
    ],
  });
}
