#!/usr/bin/env node
/**
 * Sinh tệp manifest cho bản cập nhật ngầm (OTA), theo giao thức Expo Updates v1.
 *
 * Chạy sau `expo export --platform android`. Việc băm tệp làm ở đây — nơi đang
 * có sẵn tệp trong tay — chứ không làm ở hàm serverless: hàm đó sẽ phải tải hàng
 * chục tệp về mới băm được, vừa chậm vừa dễ vượt giới hạn thời gian chạy.
 *
 * Cách dùng:
 *   node scripts/build-ota-manifest.mjs \
 *     --export-dir dist-ota \
 *     --platform android \
 *     --runtime-version <chuỗi fingerprint> \
 *     --base-url https://min-silk-iota.vercel.app \
 *     --out manifests/manifest-android-<rv>.json
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function arg(name, fallback = null) {
  const at = process.argv.indexOf(`--${name}`);
  if (at === -1 || at === process.argv.length - 1) {
    if (fallback !== null) return fallback;
    throw new Error(`Thiếu tham số --${name}`);
  }
  return process.argv[at + 1];
}

/** SHA-256 mã hoá base64url — đúng dạng giao thức đòi hỏi */
function base64UrlSha256(buffer) {
  return createHash('sha256')
    .update(buffer)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function md5Hex(buffer) {
  return createHash('md5').update(buffer).digest('hex');
}

/**
 * Kiểu MIME theo đuôi tệp.
 * Không dùng `image/${ext}` cho mọi thứ: thư mục assets còn có phông chữ (.ttf),
 * âm thanh, JSON... gán sai kiểu thì máy có thể từ chối tệp.
 */
const CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  json: 'application/json',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
};

function contentTypeOf(ext) {
  return CONTENT_TYPES[String(ext).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * UUID sinh từ chính nội dung bản build.
 *
 * Cố ý KHÔNG dùng UUID ngẫu nhiên: nếu build lại mà nội dung y hệt thì id phải
 * giữ nguyên, nếu không máy nào cũng tưởng có bản mới và tải lại toàn bộ bundle
 * một cách vô ích.
 */
function deterministicUuid(seed) {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    // Đánh dấu phiên bản 4 và biến thể RFC 4122 để đúng dạng UUID
    '4' + hex.slice(13, 16),
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}

async function main() {
  const exportDir = arg('export-dir');
  const platform = arg('platform');
  const runtimeVersion = arg('runtime-version');
  const baseUrl = arg('base-url').replace(/\/+$/, '');
  const outPath = arg('out');

  const metadata = JSON.parse(
    await readFile(path.join(exportDir, 'metadata.json'), 'utf8'),
  );
  const platformFiles = metadata?.fileMetadata?.[platform];
  if (!platformFiles) {
    throw new Error(
      `metadata.json không có phần cho nền tảng "${platform}". ` +
        `Có: ${Object.keys(metadata?.fileMetadata ?? {}).join(', ') || '(rỗng)'}`,
    );
  }

  /** Đường dẫn tệp mà app sẽ gọi để tải — luôn đi qua tên miền của mình */
  const urlFor = (filePath) =>
    `${baseUrl}/api/ota-asset?rv=${encodeURIComponent(runtimeVersion)}` +
    `&p=${encodeURIComponent(filePath)}`;

  async function describe(filePath, { isLaunchAsset, ext }) {
    const bytes = await readFile(path.join(exportDir, filePath));
    return {
      hash: base64UrlSha256(bytes),
      // Khoá là mã băm md5 của nội dung, đúng cách máy chủ tham chiếu của Expo làm
      key: md5Hex(bytes),
      fileExtension: isLaunchAsset ? '.bundle' : `.${ext}`,
      contentType: isLaunchAsset ? 'application/javascript' : contentTypeOf(ext),
      url: urlFor(filePath),
    };
  }

  const launchAsset = await describe(platformFiles.bundle, {
    isLaunchAsset: true,
    ext: 'bundle',
  });

  const assets = [];
  for (const asset of platformFiles.assets ?? []) {
    assets.push(await describe(asset.path, { isLaunchAsset: false, ext: asset.ext }));
  }

  const manifest = {
    id: deterministicUuid(`${runtimeVersion}:${launchAsset.hash}:${assets.length}`),
    createdAt: new Date().toISOString(),
    runtimeVersion,
    launchAsset,
    assets,
    metadata: {},
    extra: {},
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`✅ Đã ghi ${outPath}`);
  console.log(`   runtimeVersion : ${runtimeVersion}`);
  console.log(`   id             : ${manifest.id}`);
  console.log(`   bundle         : ${platformFiles.bundle}`);
  console.log(`   số tệp kèm     : ${assets.length}`);
}

main().catch((error) => {
  console.error('❌ ' + (error?.message ?? error));
  process.exit(1);
});
