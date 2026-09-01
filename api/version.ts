import { createTursoClient, initDatabase, serverTursoConfig } from '../lib/turso';

/**
 * Phiên bản mới nhất của ứng dụng, đọc từ bảng `app_version` trên Turso.
 *
 * Đây là endpoint CÔNG KHAI (không cần đăng nhập) vì app phải hỏi được ngay ở
 * màn hình đăng nhập. Nó chỉ trả thông tin phát hành, không có gì riêng tư.
 *
 * Cập nhật bản mới:
 *   turso db shell min-bamin7718 \
 *     "UPDATE app_version SET version='1.0.2', apk_url='...', release_notes='...' WHERE id=1"
 */
export const config = { runtime: 'edge' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Cho phép cache ngắn: hàng nghìn máy hỏi cùng lúc cũng không dội vào DB
      'Cache-Control': 'public, max-age=300',
    },
  });
}

export default async function handler(): Promise<Response> {
  const config = serverTursoConfig();
  if (!config) return json({ error: 'Server chưa cấu hình.' }, 503);

  try {
    const client = createTursoClient(config);
    await initDatabase(client);

    const result = await client.execute(
      'SELECT version, apk_url, force_update, release_notes FROM app_version WHERE id = 1',
    );
    const row = result.rows[0];
    if (!row) return json({ error: 'Chưa khai báo phiên bản nào.' }, 404);

    return json({
      version: String(row.version),
      apk_url: String(row.apk_url ?? ''),
      force_update: Number(row.force_update) === 1,
      release_notes: String(row.release_notes ?? ''),
    });
  } catch (error) {
    console.error('[api/version]', error);
    return json({ error: 'Không đọc được thông tin phiên bản.' }, 502);
  }
}
