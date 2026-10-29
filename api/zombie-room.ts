/**
 * API quản lý phòng chơi zombie 2 người.
 *
 * POST ?action=create  → { code, seed }
 * POST ?action=join    body: {code} → { code, seed, status }
 * POST ?action=start   body: {code} → { ok }
 * POST ?action=push-host body: {code, input} → { guestInput }
 * POST ?action=push-guest body: {code, input} → { hostInput }
 * POST ?action=close   body: {code} → { ok }
 * POST ?action=poll    body: {code} → { status, hasGuest }
 * GET  ?code=X         → ZombieRoomRecord
 */
import { sessionSecret, verifySessionToken } from '../lib/authCrypto';
import {
  cleanupZombieRooms,
  closeZombieRoom,
  createTursoClient,
  createZombieRoom,
  initDatabase,
  joinZombieRoom,
  pushGuestInput,
  pushHostInput,
  readZombieRoom,
  serverTursoConfig,
  startZombieRoom,
  type ZombieRoomInput,
} from '../lib/turso';

export const config = { runtime: 'edge' };

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join('');
}

function parseInput(raw: unknown): ZombieRoomInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const tick = typeof r.tick === 'number' && Number.isFinite(r.tick) ? Math.floor(r.tick) : null;
  if (tick === null || tick < 0) return null;
  return {
    tick,
    moveX: typeof r.moveX === 'number' ? Math.max(-1, Math.min(1, r.moveX)) : 0,
    moveY: typeof r.moveY === 'number' ? Math.max(-1, Math.min(1, r.moveY)) : 0,
    firing: Boolean(r.firing),
    useBomb: Boolean(r.useBomb),
  };
}

export default async function handler(request: Request): Promise<Response> {
  const cfg = serverTursoConfig();
  if (!cfg) return json({ error: 'Server chưa cấu hình' }, 503);

  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const secret = sessionSecret();
  const userId = secret ? await verifySessionToken(token, secret) : null;
  if (!userId) return json({ error: 'Chưa đăng nhập' }, 401);

  const client = createTursoClient(cfg);
  await initDatabase(client);

  const url = new URL(request.url);

  if (request.method === 'GET') {
    const code = url.searchParams.get('code');
    if (!code) return json({ error: 'Thiếu mã phòng' }, 400);
    const room = await readZombieRoom(client, code.toUpperCase().trim());
    if (!room) return json({ error: 'Phòng không tồn tại' }, 404);
    return json(room);
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const action = url.searchParams.get('action');
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* body rỗng */
  }

  if (action === 'create') {
    await cleanupZombieRooms(client);
    const code = generateCode();
    const seed = Math.floor(Math.random() * 2_147_483_647);
    await createZombieRoom(client, code, userId, seed);
    return json({ code, seed });
  }

  if (action === 'join') {
    const code = typeof body.code === 'string' ? body.code.toUpperCase().trim() : '';
    if (!/^[A-Z2-9]{6}$/.test(code)) return json({ error: 'Mã phòng không hợp lệ' }, 400);
    const room = await joinZombieRoom(client, code, userId);
    if (!room) return json({ error: 'Phòng không tồn tại hoặc đã đầy' }, 404);
    return json({ code: room.code, seed: room.gameSeed, status: room.status });
  }

  if (action === 'start') {
    const code = typeof body.code === 'string' ? body.code.toUpperCase().trim() : '';
    const ok = await startZombieRoom(client, code, userId);
    if (!ok) return json({ error: 'Không thể bắt đầu' }, 400);
    return json({ ok: true });
  }

  if (action === 'push-host') {
    const code = typeof body.code === 'string' ? body.code.toUpperCase().trim() : '';
    const input = parseInput(body.input);
    if (!input) return json({ error: 'Input không hợp lệ' }, 400);
    const room = await pushHostInput(client, code, userId, input);
    if (!room) return json({ error: 'Phòng không tồn tại' }, 404);
    return json({ guestInput: room.guestInput });
  }

  if (action === 'push-guest') {
    const code = typeof body.code === 'string' ? body.code.toUpperCase().trim() : '';
    const input = parseInput(body.input);
    if (!input) return json({ error: 'Input không hợp lệ' }, 400);
    const room = await pushGuestInput(client, code, userId, input);
    if (!room) return json({ error: 'Phòng không tồn tại' }, 404);
    return json({ hostInput: room.hostInput });
  }

  if (action === 'poll') {
    const code = typeof body.code === 'string' ? body.code.toUpperCase().trim() : '';
    const room = await readZombieRoom(client, code);
    if (!room) return json({ error: 'Phòng không tồn tại' }, 404);
    return json({ status: room.status, hasGuest: room.guestUserId !== null });
  }

  if (action === 'close') {
    const code = typeof body.code === 'string' ? body.code.toUpperCase().trim() : '';
    await closeZombieRoom(client, code, userId);
    return json({ ok: true });
  }

  return json({ error: 'Action không hợp lệ' }, 400);
}
