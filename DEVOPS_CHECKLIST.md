# Min EG — Rà soát cấu hình & Hướng dẫn CI/CD

Kết quả một đợt audit toàn bộ cấu hình dự án, đối chiếu với công thức build APK
trong [`BUILD-APK.md`](./BUILD-APK.md) (rút ra từ dự án SoFin).

Ngày rà soát: phiên bản **1.0.8**. Workflow: [`.github/workflows/build-apk.yml`](./.github/workflows/build-apk.yml).

---

## 1. Kết quả rà soát

### 1.1 `.gitignore`

| Mục | Kết quả | Ghi chú |
|---|---|---|
| `/android` (dùng prebuild) | ✅ Pass | CI dựng lại native mỗi lần từ `app.json`, không bao giờ lệch cấu hình |
| `.env`, `!.env.example` | ✅ Pass | |
| `*.jks`, `*.p8`, `*.p12`, `*.key` | ✅ Pass | |
| `*.keystore` | ❌ **Fail → đã sửa** | Thiếu đúng cái tên file mà quy trình ký sinh ra (`app-debug.keystore`). Không có dòng này thì `git add -A` commit thẳng khoá ký vào repo |
| `Min-ota/` | ✅ Pass | 15 MB bundle OTA đã build, không phải mã nguồn |

### 1.2 `package.json`

| Mục | Kết quả | Ghi chú |
|---|---|---|
| `version` đúng semver | ✅ Pass | `1.0.8` |
| `engines.node` khớp workflow | ✅ Pass | Khai `>=20.0.0`, workflow dùng Node 22 |
| Script hỗ trợ phát hành | ✅ Pass | `bump-version` / `bump-minor` / `bump-major` / `check-version` |
| Script `test` | ⚠️ Không có | Cổng chặn tương đương trong CI là `npx tsc --noEmit`. Nếu sau này thêm test thật thì chèn vào ngay sau bước đó |
| Dependency chết | ❌ **Fail → đã sửa** | `@supabase/supabase-js@^2.112.4` — `lib/supabase.ts` đã bị xoá và không tệp nào import supabase. Đã `npm uninstall` (gỡ 9 gói) |

### 1.3 `.env`

| Mục | Kết quả | Ghi chú |
|---|---|---|
| `.env` không nằm trong repo | ✅ Pass | Không tồn tại trên máy, đã gitignore |
| `.env.example` mô tả đủ biến | ✅ Pass | |
| `EXPO_PUBLIC_TURSO_DATABASE_URL` | ⚠️ Có khai, **cố ý để trống** | Xem 1.5 |
| `EXPO_PUBLIC_TURSO_AUTH_TOKEN` | ⚠️ Có khai, **cố ý để trống** | Xem 1.5 |
| Biến Supabase còn sót | ❌ **Fail → đã sửa** | `.env.example` vẫn quảng cáo hai biến Supabase cho một module không còn tồn tại; đã đổi thành ghi chú "đã bỏ hẳn" |

### 1.4 Cấu hình Android native

| Mục | Kết quả | Ghi chú |
|---|---|---|
| Java version | ✅ Pass (đã đặt 21) | Xem cảnh báo ở 3.2 |
| Gradle args chống hết bộ nhớ | ❌ **Fail → đã sửa** | Mặc định Gradle chỉ lấy 512m–2g heap dù runner có 16 GB. Workflow thêm một bước ghi `org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g`, `org.gradle.parallel=true`, `org.gradle.caching=true` vào `android/gradle.properties` **sau** prebuild |
| Cache Gradle | ❌ **Fail → đã sửa** | Bản cũ dùng `actions/cache` với `timeout-minutes: 45`. Cache chỉ được ghi ở post-job step, mà job timeout thì post-job không chạy → cache **chưa bao giờ được lưu**, mỗi lượt build nguội rồi lại vượt 45 phút. Đó là lý do v1.0.2→v1.0.7 không lượt nào ra được APK. Nay dùng `gradle/actions/setup-gradle@v3` + timeout 90 |
| Không commit `android/` | ✅ Pass | |
| Tên file APK khớp link tải | ❌ **Fail → đã sửa** | Đổi sang `min-eg-app.apk` ở cả 3 chỗ: workflow, `api/download-apk.ts`, `api/check-version.ts` |

### 1.5 Về hai biến `EXPO_PUBLIC_TURSO_*`

Workflow **có** sinh hai dòng này vào `.env` từ secrets như yêu cầu, và chúng là
**tuỳ chọn** — chưa đặt secret thì build vẫn ra APK đầy đủ.

Điều đáng biết: hôm nay đặt chúng **không có tác dụng gì**, và cũng **không rò rỉ
gì**. Lý do đã kiểm chứng:

```
EXPO_PUBLIC_TURSO_* chỉ được đọc ở  → lib/turso.ts
lib/turso.ts chỉ được import bởi    → api/account.ts, api/auth.ts,
                                       api/progress.ts, api/version.ts
```

Cả bốn tệp `api/*` là Vercel serverless function, **không nằm trong bundle app**.
Metro chỉ nhúng `process.env.EXPO_PUBLIC_*` vào những chỗ có mặt trong bundle, nên
token không vào APK và cũng không bật được tính năng nào.

Nếu mai này có mã app import `lib/turso.ts` thì token sẽ vào bundle thật, và lúc
đó vấn đề là nghiêm trọng: token Turso có **toàn quyền** đọc/ghi/xoá và libSQL
**không có Row Level Security**, nên bất kỳ ai giải nén APK cũng `SELECT * FROM
users` được — kèm cột `password_hash`. Job `publish-ota` có một bước quét bundle
đã xuất tìm `libsql://` / `TURSO_AUTH_TOKEN` để bắt đúng tình huống đó. Bước này
đã được kiểm thử: xanh trên bundle thật, và đỏ khi cắm một token giả vào.

Cách kết nối Turso **an toàn** vẫn là cách dự án đang làm: token nằm ở biến môi
trường Vercel (không có tiền tố `EXPO_PUBLIC`), app gọi `/api/auth` + `/api/progress`
với session token ký HMAC, `user_id` do server lấy từ token chứ không nhận từ
tham số client.

---

## 2. Secrets và Variables cần tạo trên GitHub

**Settings → Secrets and variables → Actions**

### 2.1 Secrets (tab *Secrets*)

| Tên | Bắt buộc | Dùng để làm gì |
|---|---|---|
| `ANDROID_DEBUG_KEYSTORE_B64` | **Có** — workflow chặn job phát hành nếu thiếu | Khoá ký cố định. Không có nó thì bản mới không cài đè được lên bản cũ |
| `EXPO_PUBLIC_TURSO_DATABASE_URL` | Không | Xem 1.5 — hiện không có tác dụng |
| `EXPO_PUBLIC_TURSO_AUTH_TOKEN` | Không | Xem 1.5 — hiện không có tác dụng |

`GITHUB_TOKEN` là **sẵn có**, không phải tạo.

### 2.2 Variables (tab *Variables*, không phải Secrets)

| Tên | Giá trị |
|---|---|
| `ANDROID_SIGNER_SHA256` | Vân tay SHA-256 của khoá ký, 64 ký tự hex chữ thường |

Đặt ở **Variables** chứ không phải Secrets là có chủ ý: vân tay chứng chỉ nằm sẵn
trong mọi APK đã phát hành nên không phải bí mật, mà nhét vào Secrets thì GitHub
che nó trong log và bước đối chiếu mất hết tác dụng chẩn đoán.

Lấy giá trị: chạy workflow một lần, bước **"Đối chiếu chữ ký APK"** in ra dòng
`signer=<64 ký tự>`. Lần đầu chưa có variable thì bước đó chỉ cảnh báo, không đỏ.

### 2.3 Tạo keystore và chuỗi base64

```bash
keytool -genkeypair -v -keystore app-debug.keystore \
  -storepass android -keypass android -alias androiddebugkey \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Android Debug,O=Android,C=US"
```

Alias và hai mật khẩu (`androiddebugkey` / `android` / `android`) là **quy ước khoá
debug của Android**; giữ đúng để khớp với bước `apksigner sign` trong workflow.
Đổi thì phải sửa khớp cả hai chỗ.

Đổi file thành base64 một dòng:

```powershell
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("app-debug.keystore")) | Set-Clipboard
```

```cmd
:: Windows Command Prompt
certutil -encode app-debug.keystore tmp.b64 && findstr /v CERTIFICATE tmp.b64 > keystore.b64.txt
:: mở keystore.b64.txt, nối các dòng lại thành một dòng duy nhất rồi copy
```

```bash
# Git Bash / macOS / Linux
base64 app-debug.keystore | tr -d '\n'
```

Dán chuỗi vào secret `ANDROID_DEBUG_KEYSTORE_B64`.

> **Giữ file `.keystore` ở nơi an toàn và ĐỪNG commit** (`.gitignore` đã chặn
> `*.keystore` từ đợt rà soát này). Mất nó là mất luôn khả năng phát hành bản cài
> đè được — mọi người dùng hiện tại phải gỡ app, mà gỡ app là xoá sạch
> AsyncStorage: tài khoản Local Mode, tiến độ học, mã PIN. Không có cách khôi phục.

### 2.4 ⚠️ Khoá mới sẽ làm người dùng v1.0.1 không cài đè được

Bản v1.0.1 đang phát hành được ký bằng `debug.keystore` **có sẵn trong template
Expo** (`node_modules/expo/template.tgz` → `android/app/debug.keystore`). Khoá bạn
tự tạo ở 2.3 là một khoá khác, nên bản mới sẽ báo
`INSTALL_FAILED_UPDATE_INCOMPATIBLE` trên máy đã cài v1.0.1.

Hai lựa chọn:

| Cách | Được | Mất |
|---|---|---|
| Dùng chính keystore của template Expo làm secret | Người dùng v1.0.1 cài đè được bình thường | Khoá đó **công khai** (ai tải gói npm cũng có), nên bất kỳ ai cũng ký được APK giả mạo cùng package `com.bamin7718.lop3studygame` |
| Tạo khoá riêng (2.3) | Chỉ bạn ký được APK cho package này | Người dùng v1.0.1 phải gỡ app rồi cài lại, **mất dữ liệu cục bộ** |

Lấy keystore của template ra nếu chọn cách đầu:

```bash
tar -xzf node_modules/expo/template.tgz -C /tmp
base64 /tmp/package/android/app/debug.keystore | tr -d '\n'
```

Nếu chọn cách thứ hai, hãy ghi rõ trong release notes rằng người dùng cần gỡ app
trước khi cài — và cân nhắc bấm **Đồng bộ ngay** trong app trước khi gỡ, để tiến
độ được đẩy lên Turso.

---

## 3. Ba chỗ công thức SoFin **không** port sang được

Tài liệu SoFin viết cho web tĩnh + Capacitor. Ba con số dưới đây đúng cho dự án
đó nhưng sai cho React Native / Expo, và chính tài liệu đó cũng dặn phải đối chiếu
lại với toolchain của mình.

### 3.1 `assembleDebug` → dùng `assembleRelease`

Với Capacitor, asset web được copy vào **mọi** biến thể nên APK debug chạy được.
Với React Native thì không. Chính comment trong template Expo (`android/app/build.gradle`)
nói rõ về `debuggableVariants`:

> *"The list of variants to that are debuggable. For those we're going to **skip
> the bundling of the JS bundle and the assets**. By default is just 'debug'."*

Tức `assembleDebug` cho ra APK **không chứa JavaScript** — mở lên là màn hình đỏ
đòi Metro dev server. Ngoài ra APK debug mang `android:debuggable=true`, nghĩa là
ai cắm `adb` cũng đọc được AsyncStorage của app.

Workflow dùng `assembleRelease`, vẫn ký đè bằng `apksigner` như SoFin — phần ký là
thứ quan trọng và nó không phụ thuộc biến thể.

### 3.2 `java-version: 21` — hợp lệ nhưng không phải con số của toolchain

SoFin cần 21 vì Capacitor 8 kéo theo AGP 8.13 (`sourceCompatibility = 21`).
Min EG là React Native 0.86: `react-native/gradle/libs.versions.toml` ghim
`agp = "8.12.0"`, và `ReactAndroid/build.gradle.kts` đặt `JavaVersion.VERSION_17`.

Bytecode vẫn ra chuẩn 17, còn AGP 8.12 chạy được trên JDK 17–21, nên đặt 21 theo
môi trường SoFin là hợp lệ. **Nếu** Gradle đỏ với log về `sourceCompatibility`,
`jvmTarget` hoặc "class file version" thì sửa đúng một dòng thành `java-version: 17`.

### 3.3 §5.3 "Gradle tự sinh khoá ngẫu nhiên" — không xảy ra với Expo

`npx cap add android` không kèm keystore nào nên Gradle tự sinh một khoá mới mỗi
lần build. Template Expo **có** kèm `android/app/debug.keystore` là một tệp thật,
cố định, và cấu hình `release` dùng chính `signingConfigs.debug`.

Nên với Min EG, chữ ký ổn định qua các lần build kể cả khi không có secret. Vẫn ký
đè bằng khoá riêng vì khoá của template là công khai — xem 2.4.

---

## 4. Lệnh Git để kích hoạt Build & Release

### 4.1 Chỉ build, không phát hành

```bash
git push origin main
```

Ra **artifact** trong tab Actions (giữ 30 ngày), không tạo release. Sửa tệp `.md`
thì không kích hoạt build (`paths-ignore`).

Thử mà không cần push: **Actions → Build APK và Release → Run workflow**.

### 4.2 Build và phát hành

```bash
# 1. Tăng phiên bản. Pre-commit hook tự đồng bộ package.json, app.json
#    và constants/version.ts, nên chỉ cần commit là đủ.
npm run bump-version          # hoặc bump-minor / bump-major
npx tsc --noEmit
git commit -am "chore: 1.0.8"

# 2. Tag PHẢI bằng version trong package.json, nếu không CI chặn ngay đầu job
git tag v1.0.8

# 3. Đẩy cả hai
git push origin main v1.0.8
```

Đẩy nhánh và tag cùng lúc là an toàn: `concurrency.group` có `${{ github.ref }}`
nên hai run không giết nhau (BUILD-APK.md §5.4).

### 4.3 Sau khi phát hành

- APK: `https://github.com/bamin7718/Min/releases/latest/download/min-eg-app.apk`
- Link cố định cho app: `https://min-silk-iota.vercel.app/api/download-apk`

⚠️ **Cần redeploy Vercel** sau lần phát hành đầu dùng tên file mới, vì
`api/download-apk.ts` và `api/check-version.ts` vừa đổi từ `app-release.apk` sang
`min-eg-app.apk`. Các release cũ vẫn mang tên cũ nên link mới chỉ hoạt động khi đã
có một release mới.

---

## 5. Còn tồn

| Việc | Vì sao chưa làm |
|---|---|
| Đặt `ANDROID_SIGNER_SHA256` | Phải chạy workflow một lần mới có giá trị |
| Tạo `ANDROID_DEBUG_KEYSTORE_B64` | Cần quyết định 2.4 trước: khoá template (giữ được người dùng cũ) hay khoá riêng (an toàn hơn) |
| Bỏ `armeabi-v7a` nếu build vẫn quá 90 phút | Mất hỗ trợ máy Android 32-bit cũ — là đánh đổi, không phải cải tiến |
