#!/usr/bin/env node
/**
 * Sinh toàn bộ icon PNG của ứng dụng từ một mô tả hình học duy nhất.
 *
 * Vì sao tự vẽ bằng code thay vì kèm tệp ảnh:
 *  - Máy này không có thư viện SVG hay công cụ ảnh nào (không sharp, không
 *    ImageMagick, không Pillow), nên không rasterise được SVG.
 *  - Icon sinh từ code thì mọi kích cỡ luôn khớp nhau, và muốn đổi màu hay bố
 *    cục chỉ sửa một chỗ rồi chạy lại.
 *
 * Không phụ thuộc gói ngoài: PNG được mã hoá bằng `zlib` có sẵn trong Node.
 *
 * Cách dùng:  node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

/* ------------------------------------------------------------------ */
/* Bảng màu thương hiệu                                                */
/* ------------------------------------------------------------------ */

/**
 * Bảng màu PHẢI khớp với `BRAND` trong `components/AppIcon.tsx`. Hai nơi vì hai
 * bộ vẽ khác nhau (View của React Native ở app, khung RGBA tự dựng ở đây), nhưng
 * cùng một mô tả hình học — đổi một bên mà quên bên kia thì logo trong app và
 * icon ngoài màn hình chính sẽ lệch nhau.
 */
const BRAND = {
  bgTop: [37, 99, 235], // #2563EB xanh thương hiệu
  bgBottom: [14, 165, 233], // #0EA5E9 xanh cyan

  // Mỗi quyển sách có màu mặt và màu tối hơn cho gáy sách + bề dày giấy
  bookMath: [56, 189, 248], // #38BDF8 — môn Toán
  bookMathDeep: [2, 132, 199], // #0284C7
  bookViet: [16, 185, 129], // #10B981 — môn Tiếng Việt
  bookVietDeep: [4, 120, 87], // #047857
  bookThird: [245, 158, 11], // #F59E0B — vở nháp
  bookThirdDeep: [180, 83, 9], // #B45309
  pageEdge: [248, 250, 252],

  // Tay cầm: mặt trên, cạnh bên, khối đùn phía dưới
  padFace: [139, 92, 246], // #8B5CF6
  padSide: [109, 40, 217], // #6D28D9
  padDeep: [76, 29, 149], // #4C1D95

  // Nút bấm nhiều màu
  padDpad: [255, 255, 255],
  btnTop: [252, 211, 77], // #FCD34D
  btnRight: [251, 113, 133], // #FB7185
  btnBottom: [52, 211, 153], // #34D399
  btnLeft: [255, 255, 255],

  badgeBg: [251, 191, 36], // #FBBF24
  badgeText: [30, 58, 138], // #1E3A8A
  white: [255, 255, 255],
};

/* ------------------------------------------------------------------ */
/* Khung vẽ RGBA                                                       */
/* ------------------------------------------------------------------ */

function createCanvas(size) {
  return { size, data: new Uint8ClampedArray(size * size * 4) };
}

/** Trộn một điểm màu lên khung theo độ mờ */
function blend(canvas, x, y, [r, g, b], alpha = 1) {
  if (alpha <= 0) return;
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return;
  const at = (y * canvas.size + x) * 4;
  const d = canvas.data;
  const a = Math.min(1, alpha);
  const oldA = d[at + 3] / 255;
  const newA = a + oldA * (1 - a);
  if (newA <= 0) return;
  d[at] = (r * a + d[at] * oldA * (1 - a)) / newA;
  d[at + 1] = (g * a + d[at + 1] * oldA * (1 - a)) / newA;
  d[at + 2] = (b * a + d[at + 2] * oldA * (1 - a)) / newA;
  d[at + 3] = newA * 255;
}

function fillRect(canvas, x0, y0, w, h, color, alpha = 1) {
  for (let y = Math.floor(y0); y < Math.ceil(y0 + h); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x++) {
      blend(canvas, x, y, color, alpha);
    }
  }
}

/** Nền chuyển màu dọc */
function fillVerticalGradient(canvas, top, bottom) {
  for (let y = 0; y < canvas.size; y++) {
    const t = y / (canvas.size - 1);
    const color = [
      top[0] + (bottom[0] - top[0]) * t,
      top[1] + (bottom[1] - top[1]) * t,
      top[2] + (bottom[2] - top[2]) * t,
    ];
    for (let x = 0; x < canvas.size; x++) blend(canvas, x, y, color, 1);
  }
}

/** Khoảng cách từ một điểm tới hình chữ nhật bo góc — âm nghĩa là ở bên trong */
function roundRectDistance(px, py, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  const cx = Math.min(Math.max(px, x + radius), x + w - radius);
  const cy = Math.min(Math.max(py, y + radius), y + h - radius);
  return Math.hypot(px - cx, py - cy) - radius;
}

function fillRoundRect(canvas, x, y, w, h, r, color, alpha = 1) {
  const pad = 2;
  for (let py = Math.floor(y - pad); py <= Math.ceil(y + h + pad); py++) {
    for (let px = Math.floor(x - pad); px <= Math.ceil(x + w + pad); px++) {
      // Chuyển khoảng cách thành độ mờ để viền không bị răng cưa
      const d = roundRectDistance(px + 0.5, py + 0.5, x, y, w, h, r);
      const cover = Math.min(1, Math.max(0, 0.5 - d));
      if (cover > 0) blend(canvas, px, py, color, cover * alpha);
    }
  }
}

function fillCircle(canvas, cx, cy, r, color, alpha = 1) {
  for (let py = Math.floor(cy - r - 2); py <= Math.ceil(cy + r + 2); py++) {
    for (let px = Math.floor(cx - r - 2); px <= Math.ceil(cx + r + 2); px++) {
      const d = Math.hypot(px + 0.5 - cx, py + 0.5 - cy) - r;
      const cover = Math.min(1, Math.max(0, 0.5 - d));
      if (cover > 0) blend(canvas, px, py, color, cover * alpha);
    }
  }
}

/** Nét thẳng có đầu tròn — dùng để vẽ chữ */
function strokeLine(canvas, x1, y1, x2, y2, thickness, color, alpha = 1) {
  const r = thickness / 2;
  const minX = Math.floor(Math.min(x1, x2) - r - 2);
  const maxX = Math.ceil(Math.max(x1, x2) + r + 2);
  const minY = Math.floor(Math.min(y1, y2) - r - 2);
  const maxY = Math.ceil(Math.max(y1, y2) + r + 2);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const fx = px + 0.5;
      const fy = py + 0.5;
      // Chiếu điểm lên đoạn thẳng rồi lấy khoảng cách
      const t = lenSq === 0 ? 0 : Math.min(1, Math.max(0, ((fx - x1) * dx + (fy - y1) * dy) / lenSq));
      const d = Math.hypot(fx - (x1 + dx * t), fy - (y1 + dy * t)) - r;
      const cover = Math.min(1, Math.max(0, 0.5 - d));
      if (cover > 0) blend(canvas, px, py, color, cover * alpha);
    }
  }
}

/** Cung tròn, ghép từ nhiều nét thẳng ngắn */
function strokeArc(canvas, cx, cy, radius, fromDeg, toDeg, thickness, color, alpha = 1) {
  const steps = Math.max(8, Math.ceil(Math.abs(toDeg - fromDeg) / 6));
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const deg = fromDeg + ((toDeg - fromDeg) * i) / steps;
    const rad = (deg * Math.PI) / 180;
    const point = [cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius];
    if (prev) strokeLine(canvas, prev[0], prev[1], point[0], point[1], thickness, color, alpha);
    prev = point;
  }
}

/* ------------------------------------------------------------------ */
/* Chữ cho huy hiệu "Min EG"                                           */
/* ------------------------------------------------------------------ */

/**
 * Mỗi chữ được mô tả bằng các nét trong ô đơn vị 0..1 (x sang phải, y xuống).
 * Vẽ bằng nét thay vì bằng ảnh bitmap để phóng to bao nhiêu cũng không bị vỡ.
 */
const GLYPHS = {
  M: { width: 0.95, strokes: [['l', 0, 1, 0, 0], ['l', 0, 0, 0.475, 0.55], ['l', 0.475, 0.55, 0.95, 0], ['l', 0.95, 0, 0.95, 1]] },
  i: {
    width: 0.18,
    strokes: [['l', 0.09, 1, 0.09, 0.34], ['dot', 0.09, 0.1, 0.11]],
  },
  n: { width: 0.62, strokes: [['l', 0, 1, 0, 0.34], ['a', 0.31, 0.62, 0.31, 180, 360], ['l', 0.62, 0.62, 0.62, 1]] },
  E: { width: 0.6, strokes: [['l', 0, 0, 0, 1], ['l', 0, 0, 0.6, 0], ['l', 0, 0.5, 0.5, 0.5], ['l', 0, 1, 0.6, 1]] },
  G: {
    width: 0.8,
    strokes: [
      ['a', 0.4, 0.5, 0.4, 35, 325],
      ['l', 0.8, 0.5, 0.4, 0.5],
    ],
  },
  ' ': { width: 0.3, strokes: [] },
};

/** Vẽ một dòng chữ, trả về chiều rộng đã vẽ */
function drawText(canvas, text, x, y, height, thickness, color, { measureOnly = false } = {}) {
  const gap = height * 0.13;
  let cursor = x;
  for (const char of text) {
    const glyph = GLYPHS[char];
    if (!glyph) continue;
    const w = glyph.width * height;
    if (!measureOnly) {
      for (const stroke of glyph.strokes) {
        if (stroke[0] === 'l') {
          strokeLine(
            canvas,
            cursor + stroke[1] * height,
            y + stroke[2] * height,
            cursor + stroke[3] * height,
            y + stroke[4] * height,
            thickness,
            color,
          );
        } else if (stroke[0] === 'a') {
          strokeArc(
            canvas,
            cursor + stroke[1] * height,
            y + stroke[2] * height,
            stroke[3] * height,
            stroke[4],
            stroke[5],
            thickness,
            color,
          );
        } else if (stroke[0] === 'dot') {
          fillCircle(
            canvas,
            cursor + stroke[1] * height,
            y + stroke[2] * height,
            stroke[3] * height,
            color,
          );
        }
      }
    }
    cursor += w + gap;
  }
  return cursor - gap - x;
}

/* ------------------------------------------------------------------ */
/* Hình icon                                                           */
/* ------------------------------------------------------------------ */

/**
 * Vẽ chồng sách và tay cầm game.
 *
 * @param inset Lề chừa quanh hình, tính theo tỉ lệ cạnh. Icon adaptive của
 *   Android bị cắt tròn nên phải chừa nhiều hơn.
 */
function drawEmblem(canvas, { inset = 0.14, withBadge = true, mono = false } = {}) {
  const S = canvas.size;
  const pick = (color) => (mono ? BRAND.white : color);

  /*
   * Toàn bộ bố cục tính theo VÙNG AN TOÀN (ô vuông sau khi trừ lề), không tính
   * theo cạnh ảnh. Icon adaptive của Android cần lề tới 0.2 còn icon thường chỉ
   * 0.1; nếu đặt tỉ lệ theo cạnh ảnh thì ở lề rộng các hình sẽ chồng lên nhau.
   */
  const box = { x: S * inset, y: S * inset, size: S * (1 - inset * 2) };
  const B = box.size;

  /*
   * Cố ý BỎ huy hiệu ở các cỡ nhỏ (favicon 48px, icon đơn sắc): chữ ở cỡ đó
   * thành một vệt mờ không đọc được, mà hướng dẫn của Android cũng khuyên không
   * để chữ trong icon khởi chạy.
   */
  const showBadge = withBadge && !mono;
  const badgeFont = B * 0.09;
  // Nét mảnh để lỗ trong chữ "n", "M", "G" không bị bít lại
  const thickness = Math.max(2, B * 0.014);
  const badgePadX = B * 0.04;
  const badgePadY = badgeFont * 0.45;
  const badgeH = showBadge ? badgeFont + badgePadY * 2 : 0;
  const badgeW = showBadge
    ? drawText(canvas, 'Min EG', 0, 0, badgeFont, thickness, BRAND.badgeText, {
        measureOnly: true,
      }) +
      badgePadX * 2
    : 0;

  /*
   * Huy hiệu nằm ĐÈ lên góc dưới phải chứ không chiếm một dải riêng: chiếm dải
   * riêng thì phần hình bị đẩy lên cao, để lại một khoảng trống rõ rệt giữa
   * chồng sách và huy hiệu.
   */
  const rowTop = box.y;
  const rowHeight = B * (showBadge ? 0.88 : 1);
  const colGap = B * 0.06;
  const colWidth = (B - colGap) / 2;

  // ---- Chồng sách bên trái ----
  const bookH = rowHeight * 0.21;
  const bookGap = rowHeight * 0.05;
  const stackH = bookH * 3 + bookGap * 2;
  const stackTop = rowTop + rowHeight / 2 - stackH / 2;
  // Từ trên xuống: Toán, Tiếng Việt, vở nháp
  const books = [
    { face: BRAND.bookMath, deep: BRAND.bookMathDeep },
    { face: BRAND.bookViet, deep: BRAND.bookVietDeep },
    { face: BRAND.bookThird, deep: BRAND.bookThirdDeep },
  ];

  books.forEach(({ face, deep }, index) => {
    // Quyển trên hẹp hơn cho giống chồng sách thật
    const shrink = (2 - index) * colWidth * 0.07;
    const w = colWidth - shrink * 2;
    const x = box.x + shrink;
    const y = stackTop + index * (bookH + bookGap);
    const br = bookH * 0.3;
    const spineW = w * 0.14;

    fillRoundRect(canvas, x, y, w, bookH, br, pick(face));
    if (mono) return;

    /*
     * Gáy sách chỉ được bo ở HAI GÓC TRÁI. `fillRoundRect` chỉ nhận một bán kính
     * chung, nên vẽ rộng gấp đôi rồi tô lại nửa phải bằng màu mặt sách — nửa đó
     * nằm hẳn trong lòng quyển sách nên tô đè là khôi phục đúng màu.
     */
    fillRoundRect(canvas, x, y, spineW * 2, bookH, br, deep);
    fillRect(canvas, x + spineW, y, spineW, bookH, face);

    // Bề dày giấy: dải tối ở đáy
    fillRoundRect(
      canvas,
      x + spineW,
      y + bookH * 0.74,
      w - spineW,
      bookH * 0.26,
      br,
      deep,
      0.55,
    );

    // Mép giấy sáng màu ở cạnh phải
    fillRoundRect(
      canvas,
      x + w * 0.79,
      y + bookH * 0.18,
      w * 0.14,
      bookH * 0.48,
      bookH * 0.2,
      BRAND.pageEdge,
      0.92,
    );
  });

  // ---- Tay cầm game bên phải ----
  const padW = colWidth * 0.98;
  const padH = padW * 0.6;
  const padCx = box.x + colWidth + colGap + colWidth / 2;
  const padCy = rowTop + rowHeight / 2;
  /** Độ dày khối đùn xuống dưới — thứ tạo ra cảm giác 3D */
  const depth = padH * 0.16;
  const gripR = padH * 0.42;
  const gripDx = padW * 0.4;
  const gripDy = padH * 0.14;

  // Khối đùn phía dưới (tối nhất), rồi tay nắm, rồi mặt trên
  fillCircle(canvas, padCx - gripDx, padCy + gripDy + depth, gripR, pick(BRAND.padDeep));
  fillCircle(canvas, padCx + gripDx, padCy + gripDy + depth, gripR, pick(BRAND.padDeep));
  fillRoundRect(
    canvas,
    padCx - padW / 2,
    padCy - padH / 2 + depth,
    padW,
    padH,
    padH * 0.42,
    pick(BRAND.padDeep),
  );

  fillCircle(canvas, padCx - gripDx, padCy + gripDy, gripR, pick(BRAND.padSide));
  fillCircle(canvas, padCx + gripDx, padCy + gripDy, gripR, pick(BRAND.padSide));
  fillRoundRect(
    canvas,
    padCx - padW / 2,
    padCy - padH / 2,
    padW,
    padH,
    padH * 0.42,
    pick(BRAND.padFace),
  );

  if (!mono) {
    // Vệt sáng ở mép trên cho ra chất nhựa bóng
    fillRoundRect(
      canvas,
      padCx - padW * 0.4,
      padCy - padH * 0.4,
      padW * 0.8,
      padH * 0.2,
      padH * 0.1,
      BRAND.white,
      0.22,
    );

    // Nút thập bên trái
    const dpadCx = padCx - padW * 0.24;
    const arm = padH * 0.28;
    const thick = padH * 0.12;
    fillRoundRect(canvas, dpadCx - thick / 2, padCy - arm, thick, arm * 2, thick / 2, BRAND.padDpad);
    fillRoundRect(canvas, dpadCx - arm, padCy - thick / 2, arm * 2, thick, thick / 2, BRAND.padDpad);

    // Bốn nút mặt nhiều màu, xếp thành hình thoi
    const faceCx = padCx + padW * 0.24;
    const faceGap = padH * 0.21;
    const faceR = padH * 0.105;
    fillCircle(canvas, faceCx, padCy - faceGap, faceR, BRAND.btnTop);
    fillCircle(canvas, faceCx + faceGap, padCy, faceR, BRAND.btnRight);
    fillCircle(canvas, faceCx, padCy + faceGap, faceR, BRAND.btnBottom);
    fillCircle(canvas, faceCx - faceGap, padCy, faceR, BRAND.btnLeft);
  }

  // ---- Huy hiệu "Min EG" ở góc dưới phải ----
  if (showBadge) {
    const badgeX = box.x + B - badgeW;
    const badgeY = box.y + B - badgeH;
    fillRoundRect(canvas, badgeX, badgeY, badgeW, badgeH, badgeH / 2, BRAND.badgeBg);
    drawText(
      canvas,
      'Min EG',
      badgeX + badgePadX,
      badgeY + badgePadY,
      badgeFont,
      thickness,
      BRAND.badgeText,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Mã hoá PNG                                                          */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

/** PNG 8-bit RGBA, không dùng bộ lọc nào cho đơn giản */
function encodePng(canvas) {
  const { size, data } = canvas;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // độ sâu bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // nén deflate
  ihdr[11] = 0; // bộ lọc chuẩn
  ihdr[12] = 0; // không đan xen

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // byte bộ lọc
    for (let x = 0; x < size * 4; x++) {
      raw[rowStart + 1 + x] = data[y * size * 4 + x];
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Vẽ ở cỡ gấp đôi rồi thu nhỏ lại.
 * Cách này cho viền mịn hơn nhiều so với vẽ trực tiếp ở cỡ thật, nhất là với
 * các nét chéo của chữ M và cung tròn của chữ G.
 */
function renderDownsampled(size, draw) {
  const scale = 2;
  const big = createCanvas(size * scale);
  draw(big);

  const out = createCanvas(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const at = ((y * scale + dy) * big.size + (x * scale + dx)) * 4;
          const pixelA = big.data[at + 3] / 255;
          r += big.data[at] * pixelA;
          g += big.data[at + 1] * pixelA;
          b += big.data[at + 2] * pixelA;
          a += pixelA;
        }
      }
      const n = scale * scale;
      const at = (y * size + x) * 4;
      // Chia cho tổng độ mờ để màu không bị tối đi ở vùng viền
      out.data[at] = a > 0 ? r / a : 0;
      out.data[at + 1] = a > 0 ? g / a : 0;
      out.data[at + 2] = a > 0 ? b / a : 0;
      out.data[at + 3] = (a / n) * 255;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Sinh từng tệp                                                       */
/* ------------------------------------------------------------------ */

const TARGETS = [
  {
    file: 'assets/icon.png',
    size: 1024,
    note: 'Icon chính',
    draw: (c) => {
      fillRoundRect(c, 0, 0, c.size, c.size, c.size * 0.22, BRAND.bgTop);
      fillVerticalGradientInRoundRect(c);
      drawEmblem(c, { inset: 0.1, withBadge: true });
    },
  },
  {
    file: 'assets/splash-icon.png',
    size: 1024,
    note: 'Ảnh màn hình chờ',
    draw: (c) => {
      fillRoundRect(c, 0, 0, c.size, c.size, c.size * 0.22, BRAND.bgTop);
      fillVerticalGradientInRoundRect(c);
      drawEmblem(c, { inset: 0.12, withBadge: true });
    },
  },
  {
    file: 'assets/favicon.png',
    size: 48,
    note: 'Favicon trên web',
    // Cỡ 48px: bỏ huy hiệu chữ, giữ hình cho dễ nhận
    draw: (c) => {
      fillRoundRect(c, 0, 0, c.size, c.size, c.size * 0.22, BRAND.bgTop);
      fillVerticalGradientInRoundRect(c);
      drawEmblem(c, { inset: 0.04, withBadge: false });
    },
  },
  {
    file: 'assets/android-icon-background.png',
    size: 512,
    note: 'Lớp nền icon Android',
    draw: (c) => {
      fillVerticalGradient(c, BRAND.bgTop, BRAND.bgBottom);
    },
  },
  {
    file: 'assets/android-icon-foreground.png',
    size: 512,
    note: 'Lớp hình icon Android',
    // Icon adaptive bị cắt tròn nên phải chừa lề rộng, nếu không hình bị cụt
    draw: (c) => drawEmblem(c, { inset: 0.2, withBadge: true }),
  },
  {
    file: 'assets/android-icon-monochrome.png',
    size: 432,
    note: 'Lớp đơn sắc (chế độ icon theo màu hệ thống)',
    draw: (c) => drawEmblem(c, { inset: 0.22, withBadge: false, mono: true }),
  },
];

/** Nền chuyển màu nhưng chỉ trong phần đã bo góc, giữ nguyên góc trong suốt */
function fillVerticalGradientInRoundRect(canvas) {
  const S = canvas.size;
  const r = S * 0.22;
  for (let y = 0; y < S; y++) {
    const t = y / (S - 1);
    const color = [
      BRAND.bgTop[0] + (BRAND.bgBottom[0] - BRAND.bgTop[0]) * t,
      BRAND.bgTop[1] + (BRAND.bgBottom[1] - BRAND.bgTop[1]) * t,
      BRAND.bgTop[2] + (BRAND.bgBottom[2] - BRAND.bgTop[2]) * t,
    ];
    for (let x = 0; x < S; x++) {
      const d = roundRectDistance(x + 0.5, y + 0.5, 0, 0, S, S, r);
      const cover = Math.min(1, Math.max(0, 0.5 - d));
      if (cover > 0) blend(canvas, x, y, color, cover);
    }
  }
}

for (const target of TARGETS) {
  const canvas = renderDownsampled(target.size, target.draw);
  writeFileSync(target.file, encodePng(canvas));
  console.log(
    `✅ ${target.file.padEnd(38)} ${String(target.size).padStart(4)}×${target.size}  ${target.note}`,
  );
}
console.log('\nXong. Chạy lại script này mỗi khi đổi màu hoặc bố cục icon.');
