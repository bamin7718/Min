import { sessionSecret } from '../lib/authCrypto';
import { createTursoClient, serverTursoConfig } from '../lib/turso';

/**
 * Endpoint chẩn đoán cấu hình server.
 *
 * Chỉ báo phần nào thiếu/sai, KHÔNG bao giờ in ra token hay khoá bí mật.
 * Xoá tệp này đi sau khi đã cấu hình xong nếu bạn muốn gọn.
 */
export const config = { runtime: 'edge' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Đọc phần payload của JWT — không phải bí mật, và không đụng tới chữ ký */
function tokenInfo(token: string): Record<string, unknown> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { hopLe: false, lyDo: 'Không phải JWT 3 phần — có thể dán thiếu hoặc thừa ký tự.' };
    }
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as
      Record<string, unknown>;

    const exp = typeof payload.exp === 'number' ? payload.exp : null;
    return {
      hopLe: true,
      quyen: payload.a ?? '(không có claim "a")',
      coGioiHanTheoDatabase: 'id' in payload,
      // Token quản lý tài khoản có org_id — dùng nhầm loại này là nguyên nhân hay gặp
      laPlatformApiToken: 'org_id' in payload && !('id' in payload),
      hetHan: exp ? new Date(exp * 1000).toISOString() : '(không có hạn)',
      daHetHan: exp ? exp * 1000 < Date.now() : false,
    };
  } catch {
    return { hopLe: false, lyDo: 'Không giải mã được payload JWT.' };
  }
}

export default async function handler(): Promise<Response> {
  const cfg = serverTursoConfig();
  const secret = sessionSecret();

  const report: Record<string, unknown> = {
    coTursoDatabaseUrl: Boolean(cfg?.url),
    coTursoAuthToken: Boolean(cfg?.authToken),
    coAuthSecret: Boolean(secret),
    url: cfg?.url ?? null,
    token: cfg?.authToken ? tokenInfo(cfg.authToken) : null,
  };

  if (!cfg) {
    report.ketNoi = 'BỎ QUA — thiếu biến môi trường';
    return json(report, 503);
  }

  try {
    const client = createTursoClient(cfg);
    const started = Date.now();
    const result = await client.execute('SELECT 1 AS ok');
    report.ketNoi = 'OK';
    report.thoiGianMs = Date.now() - started;
    report.ketQua = result.rows[0];

    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    report.cacBang = tables.rows.map((row) => row.name);
    report.coBangUsers = tables.rows.some((row) => row.name === 'users');

    // Chỉ SELECT được chưa đủ: đăng ký cần GHI theo lô. Thử một lô ghi rồi dọn.
    const probe = `zz_health_probe_${Date.now()}`;
    try {
      await client.batch(
        [
          { sql: `CREATE TABLE IF NOT EXISTS ${probe} (v INTEGER)`, args: [] },
          { sql: `INSERT INTO ${probe} (v) VALUES (?)`, args: [1] },
          { sql: `DROP TABLE ${probe}`, args: [] },
        ],
        'write',
      );
      report.ghiTheoLo = 'OK';
    } catch (error) {
      report.ghiTheoLo = 'THẤT BẠI';
      report.loiGhiTheoLo = error instanceof Error ? error.message.slice(0, 200) : String(error);
    }

    // Client HTTP không hỗ trợ interactive transaction — ghi lại để khỏi đoán
    try {
      const tx = await client.transaction('write');
      await tx.rollback();
      report.hoTroTransaction = true;
    } catch (error) {
      report.hoTroTransaction = false;
      report.lyDoKhongCoTransaction =
        error instanceof Error ? error.message.slice(0, 150) : String(error);
    }

    return json(report);
  } catch (error) {
    report.ketNoi = 'THẤT BẠI';
    // Thông báo lỗi của libSQL/Turso không chứa token
    report.loi = error instanceof Error ? error.message.slice(0, 300) : String(error);
    return json(report, 502);
  }
}
