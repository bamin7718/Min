/**
 * SHA-256, HMAC-SHA256 và PBKDF2 viết thuần JavaScript.
 *
 * Vì sao cần: chế độ Local Mode (không có máy chủ) vẫn phải băm mật khẩu trước
 * khi lưu vào AsyncStorage. Trên bản web có `crypto.subtle` để làm việc đó,
 * nhưng React Native trên Android KHÔNG có, mà dự án cũng không cài thêm thư
 * viện crypto nào. File này lấp đúng khoảng đó.
 *
 * Khi có `crypto.subtle` thì `pbkdf2Sha256()` dùng luôn bản gốc của nền tảng
 * (nhanh hơn nhiều); chỉ khi thiếu mới rơi về bản thuần JS. Hai đường cho ra
 * KẾT QUẢ GIỐNG NHAU vì cùng là PBKDF2-HMAC-SHA256, nên mật khẩu tạo trên web
 * vẫn đăng nhập được trên Android và ngược lại.
 *
 * Cảnh báo về giới hạn: dữ liệu Local Mode nằm trên chính máy của người dùng,
 * ai mở được máy là đọc được AsyncStorage. Băm mật khẩu ở đây để mật khẩu không
 * nằm dạng chữ thường (nhiều người dùng lại chính mật khẩu đó ở nơi khác), chứ
 * không phải để chống người có quyền vào máy.
 */

/* ------------------------------------------------------------------ */
/* SHA-256                                                             */
/* ------------------------------------------------------------------ */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
  0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
  0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
  0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
  0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/** SHA-256 của một mảng byte, trả về 32 byte */
export function sha256(message: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
    0x5be0cd19,
  ]);

  // Đệm: 1 bit '1', các bit 0, rồi 8 byte độ dài tính bằng bit
  const bitLength = message.length * 8;
  const withOne = message.length + 1;
  const blocks = Math.ceil((withOne + 8) / 64);
  const padded = new Uint8Array(blocks * 64);
  padded.set(message);
  padded[message.length] = 0x80;

  // Độ dài là số 64-bit big-endian. Dùng hai nửa 32-bit vì bitwise của JS chỉ
  // làm việc trên 32 bit.
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, high, false);
  view.setUint32(padded.length - 4, low, false);

  const w = new Uint32Array(64);

  for (let block = 0; block < blocks; block++) {
    const base = block * 64;
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(base + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false);
  return out;
}

/* ------------------------------------------------------------------ */
/* HMAC-SHA256                                                         */
/* ------------------------------------------------------------------ */

const BLOCK_SIZE = 64;

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  // Khoá dài hơn một block thì băm lại; ngắn hơn thì đệm 0
  let k = key.length > BLOCK_SIZE ? sha256(key) : key;
  if (k.length < BLOCK_SIZE) {
    const padded = new Uint8Array(BLOCK_SIZE);
    padded.set(k);
    k = padded;
  }

  const inner = new Uint8Array(BLOCK_SIZE + message.length);
  const outer = new Uint8Array(BLOCK_SIZE + 32);
  for (let i = 0; i < BLOCK_SIZE; i++) {
    inner[i] = k[i] ^ 0x36;
    outer[i] = k[i] ^ 0x5c;
  }
  inner.set(message, BLOCK_SIZE);
  outer.set(sha256(inner), BLOCK_SIZE);
  return sha256(outer);
}

/* ------------------------------------------------------------------ */
/* PBKDF2-HMAC-SHA256                                                  */
/* ------------------------------------------------------------------ */

function pbkdf2Pure(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  byteLength: number,
): Uint8Array {
  const out = new Uint8Array(byteLength);
  const blocks = Math.ceil(byteLength / 32);

  for (let block = 1; block <= blocks; block++) {
    // U1 = HMAC(password, salt || INT_BE(block))
    const first = new Uint8Array(salt.length + 4);
    first.set(salt);
    new DataView(first.buffer).setUint32(salt.length, block, false);

    let u = hmacSha256(password, first);
    const acc = u.slice();

    for (let i = 1; i < iterations; i++) {
      u = hmacSha256(password, u);
      for (let j = 0; j < 32; j++) acc[j] ^= u[j];
    }

    out.set(acc.subarray(0, Math.min(32, byteLength - (block - 1) * 32)), (block - 1) * 32);
  }
  return out;
}

function subtle(): SubtleCrypto | null {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  return c && typeof c.subtle?.importKey === 'function' ? c.subtle : null;
}

/**
 * PBKDF2-HMAC-SHA256. Dùng `crypto.subtle` nếu nền tảng có (nhanh hơn nhiều),
 * còn không thì rơi về bản thuần JS. Hai đường cho ra cùng một kết quả.
 */
export async function pbkdf2Sha256(
  password: string,
  salt: Uint8Array,
  iterations: number,
  byteLength: number,
): Promise<Uint8Array> {
  const passwordBytes = utf8(password);

  const api = subtle();
  if (api) {
    try {
      const key = await api.importKey('raw', passwordBytes as BufferSource, 'PBKDF2', false, [
        'deriveBits',
      ]);
      const bits = await api.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
        key,
        byteLength * 8,
      );
      return new Uint8Array(bits);
    } catch {
      // Nền tảng có crypto.subtle nhưng không hỗ trợ PBKDF2 → dùng bản thuần JS
    }
  }
  return pbkdf2Pure(passwordBytes, salt, iterations, byteLength);
}

/* ------------------------------------------------------------------ */
/* Tiện ích                                                            */
/* ------------------------------------------------------------------ */

export function utf8(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);

  // Bản dự phòng cho môi trường không có TextEncoder
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.codePointAt(i) as number;
    if (code > 0xffff) i++;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000)
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
  }
  return new Uint8Array(bytes);
}

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : '0' + hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

/** Byte ngẫu nhiên. Dùng crypto khi có, không thì Math.random. */
export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(out);
    return out;
  }
  // Math.random không phải nguồn ngẫu nhiên an toàn, nhưng ở Local Mode thì
  // muối chỉ cần khác nhau giữa các tài khoản, không cần chống đoán.
  for (let i = 0; i < length; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

/**
 * So sánh hai chuỗi trong thời gian không phụ thuộc nội dung, để không rò rỉ
 * thông tin qua thời gian phản hồi.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
