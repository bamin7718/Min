-- Schema Turso (libSQL) cho ứng dụng Học tập & Góc Game Lớp 3
-- Áp dụng: turso db shell min-bamin7718 < db/schema.sql
--
-- libSQL là SQLite nên KHÔNG có Row Level Security. Mọi kiểm soát truy cập
-- phải làm ở tầng server (api/auth.ts, api/progress.ts).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  -- Tên đăng nhập. Là ID, KHÔNG đổi được sau khi tạo.
  username      TEXT NOT NULL UNIQUE,
  -- Họ và tên, thứ hiện trên header app. Khác username: có dấu, có khoảng trắng.
  display_name  TEXT NOT NULL DEFAULT '',
  -- Khối lớp 1-12. Chỉ là dữ liệu hồ sơ: ngân hàng câu hỏi vẫn là Lớp 3.
  grade         INTEGER NOT NULL DEFAULT 3,
  -- Emoji avatar, chọn từ danh sách cố định trong types/index.ts
  avatar        TEXT NOT NULL DEFAULT '',
  -- Định dạng: pbkdf2$<số vòng>$<salt base64>$<hash base64>
  password_hash TEXT NOT NULL,
  -- Giữ lại cho các tài khoản tạo từ bản cũ. Tài khoản mới LUÔN là 'student';
  -- quyền vào khu vực phụ huynh giờ dựa vào pin_code, không dựa vào cột này.
  role          TEXT NOT NULL CHECK (role IN ('student', 'parent')),
  -- Mã PIN mở khu vực phụ huynh, NULL = chưa đặt. Cũng băm chứ không lưu thô.
  pin_code      TEXT,
  created_at    TEXT NOT NULL
);

-- UNIQUE của SQLite phân biệt hoa thường, nhưng đăng nhập tra theo lower().
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(username));

CREATE TABLE IF NOT EXISTS user_progress (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- 'chung' = tiến độ tổng của học sinh. Giữ cột này để sau có thể tách
  -- tiến độ theo từng môn mà không phải đổi schema.
  subject                  TEXT NOT NULL DEFAULT 'chung',
  -- Tuần Toán cao nhất đã vượt qua. Giữ lại để dữ liệu cũ đọc được;
  -- nguồn chính bây giờ là completed_weeks bên dưới.
  completed_week           INTEGER NOT NULL DEFAULT 0,
  total_points             INTEGER NOT NULL DEFAULT 0,
  accumulated_game_minutes INTEGER NOT NULL DEFAULT 0,
  -- Danh sách id câu đã trả lời đúng (JSON array). Không có trong spec nhưng
  -- cần thiết: thiếu nó thì quy tắc "câu đã đúng không cộng phút nữa" sẽ mất
  -- hiệu lực mỗi khi đổi thiết bị.
  mastered_question_ids    TEXT NOT NULL DEFAULT '[]',
  -- Map JSON môn -> tuần cao nhất đã qua, ví dụ {"Toán":9,"Tiếng Việt":4}.
  -- Dùng map để thêm lộ trình cho môn mới không phải đổi schema.
  completed_weeks          TEXT NOT NULL DEFAULT '{}',
  -- JSON {"answered":n,"correct":n} cho báo cáo của phụ huynh. Chỉ lưu hai con
  -- số này, số câu sai = answered - correct: giữ cả ba thì chỉ cần một lần cộng
  -- lệch là ba số tự mâu thuẫn nhau.
  answer_stats             TEXT NOT NULL DEFAULT '{}',
  -- JSON {"dailyLimitMinutes":n,"rewardMultiplier":n} do phụ huynh đặt
  parent_settings          TEXT NOT NULL DEFAULT '{}',
  updated_at               TEXT NOT NULL,
  UNIQUE (user_id, subject)
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress (user_id);

CREATE TABLE IF NOT EXISTS quiz_results (
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
);

CREATE INDEX IF NOT EXISTS idx_quiz_results_user
  ON quiz_results (user_id, completed_at DESC);

-- Bản phát hành mới nhất. Chỉ có đúng một dòng (id = 1).
CREATE TABLE IF NOT EXISTS app_version (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  version       TEXT NOT NULL,
  apk_url       TEXT NOT NULL DEFAULT '',
  force_update  INTEGER NOT NULL DEFAULT 0,
  release_notes TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL
);

INSERT OR IGNORE INTO app_version (id, version, apk_url, force_update, release_notes, updated_at)
VALUES (1, '1.0.1', '', 0, '', datetime('now'));
