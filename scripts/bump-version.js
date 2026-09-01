#!/usr/bin/env node
/**
 * Tăng số phiên bản của Min EG và ghi đồng bộ vào ba nơi.
 *
 * Ba nơi đó phải luôn khớp nhau:
 *  - package.json          → workflow lấy để đặt tên bản phát hành trên GitHub
 *  - app.json (expo.version) → số phiên bản của bản APK
 *  - constants/version.ts   → số hiện trên màn hình Đăng nhập và Cài đặt
 *
 * Lệch nhau thì người dùng sẽ bị nhắc cập nhật vòng lặp: app so số của chính nó
 * với số máy chủ báo, hai số khác nhau là nhắc mãi không dứt.
 *
 * Cách dùng:
 *   node scripts/bump-version.js            # tăng số PATCH: 1.0.2 -> 1.0.3
 *   node scripts/bump-version.js minor      # 1.0.2 -> 1.1.0
 *   node scripts/bump-version.js major      # 1.0.2 -> 2.0.0
 *   node scripts/bump-version.js --set 2.5.0
 *   node scripts/bump-version.js --check    # chỉ kiểm tra ba nơi có khớp không
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PKG = path.join(ROOT, 'package.json');
const APP = path.join(ROOT, 'app.json');
const VERSION_TS = path.join(ROOT, 'constants', 'version.ts');

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const APP_VERSION_LINE = /export const APP_VERSION = '([^']*)';/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Ghi JSON giữ nguyên thụt lề 2 và có dòng trống cuối tệp, để `git diff` chỉ
 * hiện đúng dòng version thay vì báo đổi cả tệp.
 */
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function currentVersions() {
  const pkg = readJson(PKG);
  const app = readJson(APP);
  const tsSource = fs.readFileSync(VERSION_TS, 'utf8');
  const tsMatch = tsSource.match(APP_VERSION_LINE);

  return {
    pkg: pkg.version ?? null,
    app: app?.expo?.version ?? null,
    ts: tsMatch ? tsMatch[1] : null,
  };
}

function bump(version, kind) {
  const match = version.match(VERSION_RE);
  if (!match) {
    throw new Error(`Phiên bản "${version}" không đúng dạng x.y.z`);
  }
  const [major, minor, patch] = match.slice(1).map(Number);

  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function main() {
  const args = process.argv.slice(2);
  const versions = currentVersions();

  /* ---- Chỉ kiểm tra ---- */
  if (args.includes('--check')) {
    const all = [versions.pkg, versions.app, versions.ts];
    const same = all.every((v) => v && v === all[0]);
    if (same) {
      console.log(`✅ [Min EG] Ba nơi đều là ${all[0]}`);
      process.exit(0);
    }
    console.error('❌ [Min EG] Số phiên bản không khớp nhau:');
    console.error(`   package.json        : ${versions.pkg}`);
    console.error(`   app.json            : ${versions.app}`);
    console.error(`   constants/version.ts: ${versions.ts}`);
    process.exit(1);
  }

  /* ---- Xác định phiên bản mới ---- */
  let next;
  const setAt = args.indexOf('--set');
  if (setAt !== -1) {
    next = args[setAt + 1];
    if (!next || !VERSION_RE.test(next)) {
      throw new Error('--set cần một số phiên bản dạng x.y.z');
    }
  } else {
    const kind = args.find((a) => ['major', 'minor', 'patch'].includes(a)) ?? 'patch';
    // Lấy số lớn nhất trong ba nơi làm gốc: nếu trước đó có nơi bị bỏ sót thì
    // tăng từ số lớn nhất mới không tạo ra phiên bản trùng với bản đã phát hành.
    const base = [versions.pkg, versions.app, versions.ts]
      .filter((v) => v && VERSION_RE.test(v))
      .sort((a, b) => {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
      })
      .pop();
    if (!base) throw new Error('Không đọc được phiên bản hiện tại ở bất kỳ tệp nào');
    next = bump(base, kind);
  }

  /* ---- Ghi cả ba nơi ---- */
  const pkg = readJson(PKG);
  pkg.version = next;
  writeJson(PKG, pkg);

  const app = readJson(APP);
  app.expo.version = next;
  writeJson(APP, app);

  const tsSource = fs.readFileSync(VERSION_TS, 'utf8');
  if (!APP_VERSION_LINE.test(tsSource)) {
    throw new Error('constants/version.ts không có dòng "export const APP_VERSION = \'...\';"');
  }
  fs.writeFileSync(
    VERSION_TS,
    tsSource.replace(APP_VERSION_LINE, `export const APP_VERSION = '${next}';`),
    'utf8',
  );

  console.log(`🚀 [Min EG] Updated version to ${next} successfully!`);
  console.log(`   package.json         → ${next}`);
  console.log(`   app.json             → ${next}`);
  console.log(`   constants/version.ts → ${next}`);
}

try {
  main();
} catch (error) {
  console.error(`❌ [Min EG] ${error?.message ?? error}`);
  process.exit(1);
}
