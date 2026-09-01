// Dùng export `/web`: bản này chạy trên `fetch` nên hoạt động ở Vercel Edge,
// Node và cả React Native. Export gốc `@libsql/client` phụ thuộc native module
// `libsql` nên không bundle được cho app.
import { createClient, type Client } from '@libsql/client/web';

import {
  EMPTY_WEEK_PROGRESS,
  type ProgressSyncPayload,
  type Subject,
  type SubjectWeekProgress,
  type UserRole,
} from '../types';

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

/** Các cột hiện có của một bảng; mảng rỗng nghĩa là bảng chưa tồn tại */
async function tableColumns(client: Client, table: string): Promise<Set<string>> {
  // Nội suy tên bảng thay vì truyền tham số: hàm bảng `pragma_table_info` không
  // nhận tham số ràng buộc trên mọi phiên bản, và nếu nó lặng lẽ trả 0 dòng thì
  // migration sẽ bị bỏ qua mà không báo lỗi gì.
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error(`Tên bảng không hợp lệ: ${table}`);

  const result = await client.execute(`SELECT name FROM pragma_table_info('${table}')`);
  return new Set(result.rows.map((row) => String(row.name)));
}

/**
 * Chuyển `user_progress` từ schema cũ (khoá chính là `user_id`) sang schema mới
 * (`id` + `subject`), giữ nguyên dữ liệu đang có.
 *
 * Cần thiết vì `CREATE TABLE IF NOT EXISTS` KHÔNG sửa bảng đã tồn tại — bảng cũ
 * cứ thế nằm im và mọi lệnh INSERT theo schema mới đều lỗi
 * "table user_progress has no column named id".
 */
async function migrateUserProgress(client: Client): Promise<void> {
  const columns = await tableColumns(client, 'user_progress');
  if (columns.size === 0) return; // chưa có bảng, phần CREATE bên dưới lo
  if (columns.has('id') && columns.has('subject')) return; // đã đúng schema mới

  // Bảng cũ có thể thiếu vài cột, nên chọn nguồn dữ liệu tương ứng cho từng cột
  const week = columns.has('highest_completed_week') ? 'highest_completed_week' : '0';
  const mastered = columns.has('mastered_question_ids') ? 'mastered_question_ids' : "'[]'";
  const updated = columns.has('last_updated') ? 'last_updated' : "datetime('now')";

  await client.batch(
    [
      'DROP TABLE IF EXISTS user_progress_legacy',
      'ALTER TABLE user_progress RENAME TO user_progress_legacy',
      `CREATE TABLE user_progress (
         id                       TEXT PRIMARY KEY,
         user_id                  TEXT NOT NULL,
         subject                  TEXT NOT NULL DEFAULT 'chung',
         completed_week           INTEGER NOT NULL DEFAULT 0,
         total_points             INTEGER NOT NULL DEFAULT 0,
         accumulated_game_minutes INTEGER NOT NULL DEFAULT 0,
         mastered_question_ids    TEXT NOT NULL DEFAULT '[]',
         updated_at               TEXT NOT NULL,
         UNIQUE (user_id, subject)
       )`,
      `INSERT INTO user_progress (
         id, user_id, subject, completed_week, total_points,
         accumulated_game_minutes, mastered_question_ids, updated_at
       )
       SELECT lower(hex(randomblob(16))), user_id, 'chung', ${week}, total_points,
              accumulated_game_minutes, ${mastered}, ${updated}
         FROM user_progress_legacy`,
      'DROP TABLE user_progress_legacy',
    ],
    'write',
  );
}

/**
 * Thêm cột `completed_weeks` (JSON map môn -> tuần) cho bảng đã tồn tại.
 *
 * Trước đây chỉ có `completed_week` là một số nguyên dành riêng cho môn Toán.
 * Khi thêm lộ trình Tiếng Việt thì cần map theo môn, nhưng vẫn giữ cột cũ để
 * dữ liệu Toán đã lưu không mất.
 */
async function migrateCompletedWeeks(client: Client): Promise<void> {
  const columns = await tableColumns(client, 'user_progress');
  if (columns.size === 0 || columns.has('completed_weeks')) return;

  await client.batch(
    [
      `ALTER TABLE user_progress ADD COLUMN completed_weeks TEXT NOT NULL DEFAULT '{}'`,
      // Chuyển giá trị Toán cũ sang map. Nối chuỗi thay vì dùng json_object()
      // để không phụ thuộc phần mở rộng JSON của SQLite.
      `UPDATE user_progress
          SET completed_weeks = '{"Toán":' || COALESCE(completed_week, 0) || '}'
        WHERE completed_weeks = '{}'`,
    ],
    'write',
  );
}

/** Tạo toàn bộ bảng nếu chưa có, và nâng cấp bảng cũ. An toàn khi gọi nhiều lần. */
export async function initDatabase(client: Client): Promise<void> {
  await migrateUserProgress(client);
  await migrateCompletedWeeks(client);

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
         completed_weeks          TEXT NOT NULL DEFAULT '{}',
         updated_at               TEXT NOT NULL,
         UNIQUE (user_id, subject)
       )`,
      // UNIQUE của SQLite phân biệt hoa thường, nhưng đăng nhập lại tra theo
      // lower(username). Không có index này thì "Minh" và "minh" thành hai tài
      // khoản và lệnh đăng nhập sẽ trả về một trong hai một cách tuỳ ý.
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(username))`,
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
      // Một dòng duy nhất (id = 1) mô tả bản phát hành mới nhất
      `CREATE TABLE IF NOT EXISTS app_version (
         id            INTEGER PRIMARY KEY CHECK (id = 1),
         version       TEXT NOT NULL,
         apk_url       TEXT NOT NULL DEFAULT '',
         force_update  INTEGER NOT NULL DEFAULT 0,
         release_notes TEXT NOT NULL DEFAULT '',
         updated_at    TEXT NOT NULL
       )`,
      // Khai phiên bản hiện tại nếu bảng còn trống. Dùng INSERT OR IGNORE để
      // không ghi đè giá trị mà người quản trị đã đặt.
      `INSERT OR IGNORE INTO app_version (id, version, apk_url, force_update, release_notes, updated_at)
       VALUES (1, '1.0.1', '', 0, '', datetime('now'))`,
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
  const now = new Date().toISOString();

  // Dùng `batch` chứ KHÔNG dùng `client.transaction()`: client `/web` chạy trên
  // HTTP nên không hỗ trợ interactive transaction. `batch` được Turso thực thi
  // nguyên tử, nên vẫn đảm bảo không bao giờ có user thiếu bản ghi tiến độ.
  try {
    await client.batch(
      [
        {
          sql: `INSERT INTO users (id, username, password_hash, role, pin_code, created_at)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [user.id, user.username, user.passwordHash, user.role, user.pinHash, now],
        },
        {
          sql: `INSERT INTO user_progress (
                  id, user_id, subject, completed_week, total_points,
                  accumulated_game_minutes, mastered_question_ids, completed_weeks, updated_at
                ) VALUES (?, ?, 'chung', 0, 0, 0, '[]', '{}', ?)`,
          args: [progressId, user.id, now],
        },
      ],
      'write',
    );
    return true;
  } catch (error) {
    // Ràng buộc UNIQUE trên username là chốt chặn thật (không có kẽ hở race
    // như cách kiểm tra trước rồi mới ghi).
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed/i.test(message)) return false;
    throw error;
  }
}

/**
 * Đổi tên đăng nhập. Trả về `false` nếu tên mới đã có người dùng.
 * Luôn ràng buộc `WHERE id = ?` để không sửa nhầm tài khoản khác.
 */
export async function updateUsername(
  client: Client,
  userId: string,
  username: string,
): Promise<boolean> {
  try {
    await client.execute({
      sql: 'UPDATE users SET username = ? WHERE id = ?',
      args: [username, userId],
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed/i.test(message)) return false;
    throw error;
  }
}

/** Cập nhật mã PIN (đã băm) của phụ huynh */
export async function updatePinHash(
  client: Client,
  userId: string,
  pinHash: string,
): Promise<void> {
  await client.execute({
    sql: 'UPDATE users SET pin_code = ? WHERE id = ?',
    args: [pinHash, userId],
  });
}

/* ------------------------------------------------------------------ */
/* Bảng user_progress — luôn ràng buộc theo user_id                    */
/* ------------------------------------------------------------------ */

/** Đọc map tiến độ tuần từ JSON đã lưu, luôn trả đủ ba môn */
function parseWeeks(value: unknown): SubjectWeekProgress {
  const result = { ...EMPTY_WEEK_PROGRESS };
  if (typeof value !== 'string') return result;

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    for (const subject of Object.keys(result) as Subject[]) {
      const n = Number(parsed[subject]);
      if (Number.isFinite(n)) result[subject] = Math.min(35, Math.max(0, Math.floor(n)));
    }
  } catch {
    // JSON hỏng thì coi như chưa có tiến độ, không làm sập cả luồng đọc
  }
  return result;
}

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
                 completed_weeks, updated_at
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
    completedWeeks: parseWeeks(row.completed_weeks),
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
            accumulated_game_minutes, mastered_question_ids, completed_weeks, updated_at
          ) VALUES (?, ?, 'chung', ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, subject) DO UPDATE SET
            completed_week = excluded.completed_week,
            completed_weeks = excluded.completed_weeks,
            total_points = excluded.total_points,
            accumulated_game_minutes = excluded.accumulated_game_minutes,
            mastered_question_ids = excluded.mastered_question_ids,
            updated_at = excluded.updated_at
          WHERE user_progress.user_id = ?`,
    args: [
      progressId,
      userId,
      // Giữ cột cũ đồng bộ với môn Toán để dữ liệu cũ vẫn đọc được
      Math.max(0, Math.floor(progress.completedWeeks['Toán'] ?? 0)),
      Math.max(0, Math.floor(progress.totalPoints)),
      Math.max(0, Math.floor(progress.accumulatedGameMinutes)),
      JSON.stringify(progress.masteredQuestionIds),
      JSON.stringify(progress.completedWeeks),
      progress.lastUpdated,
      userId,
    ],
  });
}
