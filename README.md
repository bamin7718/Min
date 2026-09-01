# Học tập & Góc Game — Lớp 3

Ứng dụng React Native (Expo + TypeScript) kết hợp **học tập** và **quản lý thời gian
chơi game** cho học sinh Lớp 3. Học sinh trả lời đúng câu hỏi Toán / Tiếng Việt /
Tiếng Anh để tích luỹ phút chơi game; hết giờ thì màn hình Góc Game bị khoá và cần
phụ huynh nhập PIN mới cấp thêm.

## Chạy ở localhost

```bash
npm install
npx expo start
```

Sau đó:

- **Android (điện thoại/tablet)**: mở app **Expo Go**, quét QR trong terminal.
- **Android emulator**: nhấn `a` trong terminal.
- **Trình duyệt** (kiểm tra nhanh): nhấn `w`, hoặc `npm run web`.

### Yêu cầu môi trường

- **npm >= 10.** npm 9.2.0 chạy trên Node 22 gặp lỗi `ENOENT rename` trong cacache
  và không cài được dependency. Nâng cấp bằng `npm i -g npm@10` nếu cần.
- Nếu `npx expo export` báo `hermesc ... exited with signal: SIGILL`, máy đang chạy
  kiến trúc CPU mà binary Hermes đi kèm không hỗ trợ (ví dụ ARM qua PRoot). Việc này
  **không ảnh hưởng `npx expo start`**; khi cần export thì thêm `--no-bytecode`.

## Cấu trúc

| Đường dẫn | Vai trò |
| --- | --- |
| `App.tsx` | Bottom Tabs: **Học Tập** ↔ **Góc Game**, bọc `AuthProvider` + `PlaytimeProvider` |
| `context/AuthContext.tsx` | Supabase Auth: session, đăng nhập/đăng ký/đăng xuất, tự làm mới token |
| `context/PlaytimeContext.tsx` | State dùng chung: điểm, số giây chơi game, đồng hồ đếm ngược, PIN phụ huynh, lưu AsyncStorage, đồng bộ Supabase |
| `screens/QuizScreen.tsx` | Chọn môn → làm trắc nghiệm → phản hồi đúng/sai → tổng kết |
| `screens/GameVaultScreen.tsx` | Đồng hồ đếm ngược, lưới trò chơi 2 cột, khoá khi hết giờ, khu vực phụ huynh cấp thêm giờ |
| `screens/games/catalog.ts` | Danh sách trò chơi hiển thị trên lưới |
| `screens/games/GameShell.tsx` | Khung chung: đồng hồ trong game, nút thoát, lớp phủ tạm dừng |
| `screens/games/MarioMiniGame.tsx` | Runner: chạy tự động, 2 nút trái/phải + nút nhảy, né nấm/hố, ăn tiền vàng |
| `screens/games/ColorSortGame.tsx` | Giao diện trò chơi sắp xếp màu |
| `screens/games/colorSortLogic.ts` | Logic thuần của trò sắp xếp màu (sinh đề, luật đi, điều kiện thắng) |
| `screens/AuthScreen.tsx` | Đăng nhập/đăng ký, trạng thái đồng bộ, đăng xuất (mở từ khu vực phụ huynh) |
| `types/index.ts` | `Question`, `UserProgress`, `QuizResult`, `Subject`, … |
| `constants/mathCurriculum.ts` | Lộ trình Toán 35 tuần + 126 câu hỏi Toán + hàm tra tuần/trạng thái |
| `constants/mockData.ts` | 40 câu Tiếng Việt + Tiếng Anh, hàm rút đề, hàm trộn lựa chọn, các hằng số cấu hình |
| `constants/theme.ts` | Bảng màu, khoảng cách, ngưỡng tablet |
| `lib/supabase.ts` | Supabase Client — dùng cho Auth, và đồng bộ nếu không bật Turso |
| `lib/turso.ts` | Tầng dữ liệu Turso (libSQL) — chỉ chạy phía server |
| `lib/progressApi.ts` | Client gọi `api/progress`, app chỉ dùng `fetch` |
| `lib/deviceId.ts` | Id thiết bị 128-bit dùng khi chưa đăng nhập |
| `api/progress.ts` | Vercel Edge function giữ token Turso, GET/PUT tiến độ |
| `db/schema.sql` | Schema Turso |

## Môn Toán — lộ trình 35 tuần

Toán không rút đề ngẫu nhiên như hai môn còn lại mà đi theo **lộ trình 35 tuần**
(`constants/mathCurriculum.ts`), chia thành 5 giai đoạn:

| Tuần | Giai đoạn |
| --- | --- |
| 1–4 | Ôn tập & phép nhân, phép chia trong phạm vi 1000 |
| 5–10 | Hình học & đơn vị đo (trung điểm, mm, gam, lít, góc vuông) |
| 11–18 | Nhân, chia số có 2–3 chữ số với số có một chữ số; biểu thức; tìm x |
| 19–25 | Các số đến 10 000, phép tính, tháng/năm, số La Mã |
| 26–35 | Các số đến 100 000, diện tích, kiểm đếm số liệu, ôn tập cuối năm |

Tuần 1–10 có **5 câu/tuần**, tuần 11–35 có **3 câu/tuần** (khung để mở rộng thêm) —
tổng 126 câu Toán.

### Luồng học

**Học Tập → Toán → chọn tuần → làm bài.** Màn chọn tuần hiển thị 35 thẻ nhóm theo
giai đoạn, mỗi thẻ có một trong ba trạng thái:

| Trạng thái | Ý nghĩa |
| --- | --- |
| **Đã hoàn thành** | `weekNumber <= highestCompletedWeek` |
| **Đang học** | `weekNumber === highestCompletedWeek + 1` |
| **Khoá** | Các tuần sau đó — thẻ bị `disabled`, bấm không vào được |

### Điều kiện qua tuần và phần thưởng

- Cần đúng **>= 2/3 số câu** của tuần (`WEEK_PASS_RATIO = 2/3`): tuần 5 câu cần 4/5,
  tuần 3 câu cần 2/3.
  > Không dùng 0.7 vì với tuần 3 câu thì `ceil(3 x 0.7) = 3` — bắt học sinh 8 tuổi
  > phải đúng tuyệt đối mới qua được là quá khắt khe.
- Vượt qua tuần thì mở tuần kế tiếp và **thưởng `difficulty x 2` phút** chơi game
  (2 phút cho tuần 1–10, 4 phút cho tuần 11–25, 6 phút cho tuần 26–35), cộng thêm
  phút của từng câu đúng.
- **Chỉ thưởng ở lần đầu** vượt qua tuần. Làm lại tuần cũ vẫn được cộng điểm nhưng
  không cộng phút, để không thể lặp một tuần dễ nhằm lấy giờ chơi vô hạn.
- Tiến độ (`highestCompletedWeek`) lưu trong AsyncStorage cùng các dữ liệu khác.
  Phụ huynh bấm *Đặt lại điểm & thời gian* sẽ đưa tiến độ tuần về 0.

### Trộn thứ tự lựa chọn

Mọi câu hỏi (cả ba môn) đều được trộn lại thứ tự A/B/C/D khi tạo đề
(`shuffleQuestionOptions` trong `constants/mockData.ts`). Lý do: bộ đề tĩnh soạn tay
rất khó phân bố đáp án đều — bản đầu của lộ trình Toán có đáp án **D chỉ xuất hiện
3/125 lần**, học sinh hoàn toàn có thể đoán theo vị trí. Trộn khi tạo đề đưa phân bố
về đều (lệch tối đa 2.8% so với 25%) và khiến làm lại cùng một câu không đoán được.

## Góc Game — 2 trò chơi tích hợp

Khi còn thời gian khả dụng, Góc Game hiện **lưới 2 cột** gồm các ô trò chơi (icon,
tên, nút "Chơi ngay"). Hết giờ thì lưới bị ẩn và thay bằng màn hình khoá.

### Mario Mini (`screens/games/MarioMiniGame.tsx`)

Runner viết bằng React Native thuần: `requestAnimationFrame` + các `View` định vị
tuyệt đối, **không dùng WebView** nên chạy ngay trong Expo Go mà không cần rebuild,
và chạy được cả trên web.

- Nhân vật tự chạy (thế giới cuộn sang trái), điều khiển bằng 2 nút ◀ ▶ và nút NHẢY.
- Chướng ngại vật: **nấm** (va vào là mất mạng) và **hố** (rơi xuống là mất mạng).
- Ăn **tiền vàng** để tính điểm. 3 mạng, tốc độ tăng dần từ 180 lên tối đa 330 px/s.
- `dt` mỗi khung được chặn ở 0.05s để nhân vật không "xuyên" qua chướng ngại vật khi
  máy bị giật.

### Sắp Xếp Màu (`screens/games/ColorSortGame.tsx`)

- Chạm ống nguồn để chọn khối trên cùng, chạm ống đích để đặt xuống. Chỉ đặt được
  khi ống đích rỗng hoặc khối trên cùng **cùng màu**.
- Có nút **Hoàn tác** và **Đề khác**. Thắng khi mỗi màu nằm gọn trong một ống.
- Mỗi khối có thêm **ký hiệu** (● ▲ ★ ■) để bạn nào khó phân biệt màu vẫn chơi được.
- Màn 1–2: 3 màu / 4 ống. Từ màn 3: 4 màu / 5 ống.

**Đề luôn có lời giải.** Đề được sinh bằng cách đi *ngược* từ trạng thái đã giải, mỗi
bước ngược tương ứng đúng một nước đi thuận hợp lệ — nên chỉ cần đi ngược lại là
giải được. Xáo trộn ngẫu nhiên thuần thì **không** đảm bảo điều này. Logic được tách
sang `colorSortLogic.ts` để kiểm thử riêng bằng solver BFS.

> Độ khó chững lại sau màn 3: không gian trạng thái của 4 màu / 5 ống là hữu hạn nên
> tăng số bước xáo trộn không làm đề dài thêm (trung vị ~7–8 nước đi). Muốn khó hơn
> nữa thì phải thêm màu thứ 5 (6 ống), lúc đó lưới ống sẽ chật trên màn hình điện thoại.

### Quản lý thời gian khi đang chơi

| Tình huống | Hành vi |
| --- | --- |
| Mở một trò chơi | `startPlaying()` — đồng hồ bắt đầu trừ từng giây |
| Đang chơi | Đồng hồ hiện ngay trên thanh tiêu đề của game, dưới 1 phút thì đổi sang màu đỏ |
| Thoát game | `pausePlaying()` — dừng trừ thời gian |
| Rời khỏi ứng dụng | Đồng hồ dừng **và** trò chơi bị lớp phủ "Đang tạm dừng" che lại, nên không thể chơi mà không mất thời gian |
| Quay lại ứng dụng | Đồng hồ chạy tiếp nếu trò chơi vẫn đang mở |
| Thời gian về 0 | Trò chơi **tự đóng**, quay về màn hình khoá đòi làm bài tập Lớp 3 hoặc nhập PIN phụ huynh |

Ngoài lưới game vẫn còn nút **"Chỉ bấm giờ"** cho trường hợp chơi game *ngoài* ứng
dụng — bấm để đồng hồ chạy mà không mở trò chơi nào.

## Quy tắc quy đổi (đổi trong `constants/mockData.ts`)

| Hằng số | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `POINTS_PER_CORRECT` | `10` | Điểm cho mỗi câu đúng |
| `QUESTIONS_PER_QUIZ` | `6` | Số câu mỗi lượt, rút ngẫu nhiên từ 20 câu của môn. Ưu tiên câu chưa từng trả lời đúng; hết mới quay lại câu cũ |
| `rewardMinutes` (từng câu) | `2`–`3` | Số phút chơi game khi trả lời đúng |
| `REPEAT_ANSWER_GIVES_MINUTES` | `false` | Câu đã từng đúng thì lần sau chỉ cộng điểm, không cộng phút (chống "farm" giờ chơi bằng cách làm lại). Đổi `true` nếu muốn cộng phút mọi lần. |
| `MAX_ACCUMULATED_MINUTES` | `120` | Trần thời gian tích luỹ |
| `WEEK_PASS_RATIO` | `2/3` | Tỉ lệ câu đúng tối thiểu để qua một tuần Toán (trong `mathCurriculum.ts`) |
| `WEEK_BONUS_MINUTES_PER_DIFFICULTY` | `2` | Phút thưởng cho mỗi bậc độ khó của tuần (trong `mathCurriculum.ts`) |
| `DEFAULT_PARENT_PIN` | `'1234'` | Mã PIN phụ huynh |

## Build APK Android bằng GitHub Actions

Workflow `.github/workflows/android-apk.yml` tự chạy mỗi lần push lên `main`, hoặc
bấm tay ở tab **Actions → Build APK Android → Run workflow**.

Lấy file APK: vào **Actions** → chọn lần chạy → mục **Artifacts** → tải
`lop3-study-game-apk`. Giải nén rồi copy file `.apk` sang điện thoại/tablet, mở lên
và cho phép *Cài đặt từ nguồn không xác định*.

Quy trình trong CI: `npm ci` → `tsc --noEmit` → `expo prebuild --platform android`
→ `gradlew assembleRelease` → kiểm tra chữ ký bằng `apksigner` → upload artifact.
Thư mục `android/` **không** commit vào repo, mỗi lần build đều dựng lại từ
`app.json` nên không bị lệch cấu hình. Chỉ build cho `arm64-v8a` và `armeabi-v7a`
(máy thật) để nhẹ và nhanh hơn.

### Chữ ký của APK — đọc trước khi phát hành

Expo cấu hình sẵn buildType `release` ký bằng **`debug.keystore` đi kèm template**,
nên APK ra là đã ký và cài được ngay mà không cần thêm secret nào. Nhưng:

- **Dùng riêng trong nhà thì ổn** — cài lên máy của con hoặc gửi cho người thân.
- **KHÔNG dùng để phát hành lên Google Play.** Play yêu cầu keystore riêng do bạn
  giữ. Keystore debug là công khai, ai cũng có thể ký một APK giả mạo cùng package
  `com.bamin7718.lop3studygame`.

Muốn keystore riêng: tạo bằng
`keytool -genkeypair -v -keystore my.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000`,
rồi sửa `signingConfigs.release` trong `android/app/build.gradle` do prebuild sinh ra
(cách gọn nhất là viết một Expo config plugin để tự áp dụng sau mỗi lần prebuild).

### Cách khác: EAS Build

`eas-cli` đã được cài trên máy dev. EAS quản lý keystore giúp bạn nên phù hợp hơn nếu
định lên Play Store — đổi lại cần tài khoản Expo:

```bash
eas login && eas init && eas build -p android --profile preview
```

## Lưu ý về mức độ "khoá" thật

Việc khoá ở đây là khoá **trong ứng dụng**: hết giờ thì màn hình Góc Game hiển thị
lớp khoá và không cho bấm chơi. Đồng hồ tự tạm dừng khi app rời nền (`AppState`).
Ứng dụng Expo không thể khoá các app game khác trên máy — muốn cưỡng chế ở cấp hệ
điều hành thì cần native module (Android `UsageStatsManager` / Device Admin) và
phải build development build thay vì Expo Go.

## Kết nối Supabase (tuỳ chọn)

Ứng dụng chạy **offline hoàn toàn** bằng AsyncStorage. Supabase chỉ để đồng bộ tiến
độ giữa nhiều thiết bị.

1. Sao chép `.env.example` → `.env`, điền `EXPO_PUBLIC_SUPABASE_URL` và
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. Khởi động lại Metro để nạp biến môi trường: `npx expo start -c`.

SQL khởi tạo bảng:

```sql
create table if not exists public.user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  total_points integer not null default 0,
  accumulated_game_minutes integer not null default 0,
  mastered_question_ids jsonb not null default '[]'::jsonb,
  last_updated timestamptz not null default now()
);

create table if not exists public.quiz_results (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null,
  total_questions integer not null,
  correct_count integer not null,
  points_earned integer not null,
  minutes_earned integer not null,
  answers jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;
alter table public.quiz_results enable row level security;

create policy "own progress" on public.user_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own results" on public.quiz_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Kiến trúc Offline-First

Ứng dụng coi **Local là nguồn dữ liệu chính**. Mọi thao tác của học sinh ghi xuống
AsyncStorage trước; việc đẩy lên server là chuyện chạy ngầm.

```
Thao tác  ->  state React (tức thì)  ->  AsyncStorage  ->  sync_queue  ->  Turso
                    UI cập nhật ngay        nguồn chính      ngầm, có retry
```

| File | Vai trò |
| --- | --- |
| `lib/storage.ts` | Đọc/ghi tiến độ theo `userId`, quản lý `sync_queue`, hàm `resolveConflict` |
| `lib/syncEngine.ts` | Lắng nghe NetInfo, đẩy hàng đợi, tự thử lại với backoff |

### Hàng đợi gộp theo tài khoản

Tiến độ là **ảnh chụp toàn phần**, không phải delta — nên chỉ ảnh chụp mới nhất của
mỗi tài khoản là có ý nghĩa. `enqueueProgress` **thay thế** mục cũ cùng `userId` thay
vì nối thêm. Hệ quả: offline cả ngày thì hàng đợi vẫn chỉ có 1 mục, và không có nguy
cơ một ảnh chụp cũ ghi đè lên ảnh chụp mới.

### Giải quyết xung đột

`resolveConflict(localLastUpdated, remoteLastUpdated)` — **timestamp mới nhất thắng**.
`localLastUpdated === null` (máy mới cài) thì luôn lấy dữ liệu server. So sánh bằng
`Date.parse` chứ không so chuỗi, vì server trả `+00:00` còn `Date` trả `Z`.

### Thử lại khi lỗi

Backoff 5s → 10s → 20s → … tối đa 5 phút. Mất mạng giữa chừng thì mục vẫn nằm trong
hàng đợi, không mất dữ liệu. Trạng thái `offline` luôn thắng khi đặt status, để một
lượt `flush()` đang dở không báo nhầm "đã đồng bộ" sau khi thiết bị đã rớt mạng.

### Tối ưu render

`WeekCard`, `WeekPicker`, `OptionButton`, `SubjectCard`, `GameGrid` đều bọc
`React.memo`. Quan trọng nhất là `WeekCard`: khi đồng hồ chơi game chạy, context đổi
mỗi giây, không memo thì **cả 35 thẻ tuần re-render mỗi giây**. `WeekCard` nhận
`onSelect(weekNumber)` thay vì closure `() => onChooseWeek(n)` để prop không đổi giữa
các lần render — nếu vẫn dùng closure thì `React.memo` sẽ vô tác dụng.

### Preload asset

`App.tsx` nạp trước font icon Ionicons và ảnh trong `assets/`, nhưng **có hạn 2 giây**
và bắt mọi lỗi. Lý do: trên web `Asset.loadAsync`/`Font.loadAsync` đi qua mạng, mất
mạng là chúng không bao giờ kết thúc — chặn UI chờ nó thì app đứng ở màn splash vĩnh
viễn. Hết 2 giây là vào app, icon nạp sau cũng được.

> Phần gamification hiện dùng emoji và `View` thuần, chưa có ảnh hay âm thanh khen
> thưởng, nên preload ở đây thực chất chỉ có tác dụng với font icon.

### Không chặn UI khi khởi động

Không còn màn chờ "đang tải tiến độ". Các màn hình hiện `…` / `--:--` ở chỗ số liệu
khi chưa đọc xong Local, tránh vừa không chặn UI vừa không nháy số 0 sai.

## Đăng nhập & phân quyền dữ liệu (Turso)

Database: `libsql://min-bamin7718.aws-ap-northeast-1.turso.io`

### Kiến trúc — và vì sao không nối trực tiếp từ app

```
App (chỉ fetch + session token)  ->  /api/auth, /api/progress  ->  Turso
```

Nối trực tiếp bằng `EXPO_PUBLIC_TURSO_AUTH_TOKEN` sẽ **vô hiệu hoá toàn bộ tính năng
đăng nhập**, vì:

- Token nằm trong bundle công khai, nên bảng `users` (kèm `password_hash`) ai cũng
  đọc được. libSQL không có Row Level Security để chặn.
- `WHERE user_id = ?` chạy ở client thì chính client chọn điều kiện — chỉ cần
  `SELECT * FROM user_progress` là lấy hết dữ liệu mọi học sinh.

Nên điểm thực thi phân quyền đặt ở server: **`user_id` lấy TỪ session token đã ký
HMAC**, không phải từ tham số client gửi lên. Client có sửa query string hay body thế
nào cũng chỉ đọc/ghi được dòng của mình.

### Bảng

| Bảng | Cột |
| --- | --- |
| `users` | `id`, `username` (UNIQUE), `password_hash`, `role` (`student`/`parent`), `pin_code`, `created_at` |
| `user_progress` | `id`, `user_id` (FK), `subject`, `completed_week`, `total_points`, `accumulated_game_minutes`, `mastered_question_ids`, `updated_at`, UNIQUE(`user_id`,`subject`) |
| `quiz_results` | lịch sử bài làm (chưa dùng) |

Hai điểm lệch so với spec, đều có lý do:

- Thêm `mastered_question_ids`: thiếu nó thì quy tắc "câu đã trả lời đúng không cộng
  phút nữa" mất hiệu lực mỗi khi đổi thiết bị.
- `subject` hiện luôn là `'chung'` (một dòng cho mỗi học sinh), vì điểm và phút chơi
  game trong app là giá trị tổng chứ không tách theo môn. Giữ cột lại để sau tách
  được mà không phải đổi schema.

### Mật khẩu và PIN

Băm bằng **PBKDF2-SHA256, 100 000 vòng, salt 16 byte ngẫu nhiên** qua WebCrypto
(`lib/authCrypto.ts`), lưu dạng `pbkdf2$<vòng>$<salt>$<hash>`. PIN phụ huynh cũng
băm, không lưu thô. So sánh hash theo thời gian hằng số.

Cố tình **không băm ở client**: nếu client băm thì chính cái hash trở thành mật khẩu.

### Session

`api/auth` trả về token `<payload>.<HMAC-SHA256>` hạn 30 ngày, ký bằng `AUTH_SECRET`.
App lưu vào AsyncStorage (`lib/session.ts`) nên mở lại app là vẫn đăng nhập.

### Cách ly dữ liệu khi đổi tài khoản

Dữ liệu cục bộ lưu theo khoá riêng từng tài khoản
(`@lop3-study-game/progress-v2/<userId>`). Khi `userId` đổi, `PlaytimeContext` **xoá
sạch state trước** rồi mới nạp tài khoản mới, nên không có khoảnh khắc nào hiện điểm
hay giờ chơi của người trước.

### Bật lên

**1. Tạo bảng** (đã làm rồi cho `min-bamin7718`):
```bash
turso db shell min-bamin7718 < db/schema.sql
```

**2. Vercel → Settings → Environment Variables:**

| Biến | Giá trị |
| --- | --- |
| `TURSO_DATABASE_URL` | `libsql://min-bamin7718.aws-ap-northeast-1.turso.io` |
| `TURSO_AUTH_TOKEN` | `turso db tokens create min-bamin7718` |
| `AUTH_SECRET` | chuỗi ngẫu nhiên >= 16 ký tự (`openssl rand -hex 32`) |

**3. `.env` của app:** `EXPO_PUBLIC_PROGRESS_API_URL=https://min-hocchoi.vercel.app`

**4. Redeploy.**

### API

| Endpoint | Tác dụng |
| --- | --- |
| `POST /api/auth?action=register` | `{username, password, role, pin?}` → session |
| `POST /api/auth?action=login` | `{username, password}` → session |
| `GET /api/progress` | Đọc tiến độ (Bearer token) |
| `PUT /api/progress` | Ghi tiến độ (Bearer token) |

Server không tin client: tên đăng nhập phải khớp `^[a-zA-Z0-9_.-]{3,24}$`, mật khẩu
>= 6 ký tự, PIN đúng 4 số, số âm về 0, `completed_week` kẹp ở 35, danh sách id cắt ở
2000. Đăng nhập sai và tài khoản không tồn tại trả **cùng một thông báo** để không
tiết lộ tên nào đang dùng.

## Build APK Android bằng GitHub Actions

Workflow `.github/workflows/android-apk.yml` tự chạy mỗi lần push lên `main`, hoặc
bấm tay ở tab **Actions → Build APK Android → Run workflow**.

Lấy file APK: vào **Actions** → chọn lần chạy → mục **Artifacts** → tải
`lop3-study-game-apk`. Giải nén rồi copy file `.apk` sang điện thoại/tablet, mở lên
và cho phép *Cài đặt từ nguồn không xác định*.

Quy trình trong CI: `npm ci` → `tsc --noEmit` → `expo prebuild --platform android`
→ `gradlew assembleRelease` → kiểm tra chữ ký bằng `apksigner` → upload artifact.
Thư mục `android/` **không** commit vào repo, mỗi lần build đều dựng lại từ
`app.json` nên không bị lệch cấu hình. Chỉ build cho `arm64-v8a` và `armeabi-v7a`
(máy thật) để nhẹ và nhanh hơn.

### Chữ ký của APK — đọc trước khi phát hành

Expo cấu hình sẵn buildType `release` ký bằng **`debug.keystore` đi kèm template**,
nên APK ra là đã ký và cài được ngay mà không cần thêm secret nào. Nhưng:

- **Dùng riêng trong nhà thì ổn** — cài lên máy của con hoặc gửi cho người thân.
- **KHÔNG dùng để phát hành lên Google Play.** Play yêu cầu keystore riêng do bạn
  giữ. Keystore debug là công khai, ai cũng có thể ký một APK giả mạo cùng package
  `com.bamin7718.lop3studygame`.

Muốn keystore riêng: tạo bằng
`keytool -genkeypair -v -keystore my.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000`,
rồi sửa `signingConfigs.release` trong `android/app/build.gradle` do prebuild sinh ra
(cách gọn nhất là viết một Expo config plugin để tự áp dụng sau mỗi lần prebuild).

### Cách khác: EAS Build

`eas-cli` đã được cài trên máy dev. EAS quản lý keystore giúp bạn nên phù hợp hơn nếu
định lên Play Store — đổi lại cần tài khoản Expo:

```bash
eas login && eas init && eas build -p android --profile preview
```

## Lưu ý về mức độ "khoá" thật

Việc khoá ở đây là khoá **trong ứng dụng**: hết giờ thì màn hình Góc Game hiển thị
lớp khoá và không cho bấm chơi. Đồng hồ tự tạm dừng khi app rời nền (`AppState`).
Ứng dụng Expo không thể khoá các app game khác trên máy — muốn cưỡng chế ở cấp hệ
điều hành thì cần native module (Android `UsageStatsManager` / Device Admin) và
phải build development build thay vì Expo Go.

## Kết nối Supabase (tuỳ chọn)

Ứng dụng chạy **offline hoàn toàn** bằng AsyncStorage. Supabase chỉ để đồng bộ tiến
độ giữa nhiều thiết bị.

1. Sao chép `.env.example` → `.env`, điền `EXPO_PUBLIC_SUPABASE_URL` và
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. Khởi động lại Metro để nạp biến môi trường: `npx expo start -c`.

SQL khởi tạo bảng:

```sql
create table if not exists public.user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  total_points integer not null default 0,
  accumulated_game_minutes integer not null default 0,
  mastered_question_ids jsonb not null default '[]'::jsonb,
  last_updated timestamptz not null default now()
);

create table if not exists public.quiz_results (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null,
  total_questions integer not null,
  correct_count integer not null,
  points_earned integer not null,
  minutes_earned integer not null,
  answers jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;
alter table public.quiz_results enable row level security;

create policy "own progress" on public.user_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own results" on public.quiz_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Đồng bộ qua Turso (libSQL)

Database: `libsql://min-bamin7718.aws-ap-northeast-1.turso.io`

### Vì sao phải có serverless function ở giữa

Token Turso cấp **toàn quyền đọc/ghi/xoá** cả database và libSQL **không có Row
Level Security**. Khác với Supabase anon key (được thiết kế để công khai, có RLS
chặn), nếu nhúng token Turso qua `EXPO_PUBLIC_*` thì nó nằm trong bundle công khai —
bản web tại `min-hocchoi.vercel.app` ai mở DevTools cũng đọc được token rồi xoá sạch
dữ liệu.

Nên luồng là:

```
App (chỉ fetch)  ->  /api/progress (Edge, giữ token)  ->  Turso
```

App **không** import `lib/turso.ts`, nhờ vậy `@libsql/client` không vào bundle app.

### Cách bật

**1. Tạo bảng:**
```bash
turso db shell min-bamin7718 < db/schema.sql
```

**2. Tạo token và đặt vào Vercel** (Project → Settings → Environment Variables).
Hai biến này **không** có tiền tố `EXPO_PUBLIC_` nên chỉ server đọc được:

| Biến | Giá trị |
| --- | --- |
| `TURSO_DATABASE_URL` | `libsql://min-bamin7718.aws-ap-northeast-1.turso.io` |
| `TURSO_AUTH_TOKEN` | kết quả của `turso db tokens create min-bamin7718` |

**3. Trong `.env` của app** chỉ cần trỏ tới domain đã deploy:
```
EXPO_PUBLIC_PROGRESS_API_URL=https://min-hocchoi.vercel.app
```
Bản web cùng origin nên để trống cũng chạy.

**4. Redeploy** để Vercel nạp biến môi trường mới.

### Định danh học sinh

| Tình huống | Khoá lưu tiến độ |
| --- | --- |
| Đã đăng nhập Supabase | `user.id` — dùng chung được giữa nhiều thiết bị |
| Chưa đăng nhập | Device id ngẫu nhiên 128-bit trong AsyncStorage — chỉ sao lưu cho máy đó |

Device id phải khó đoán vì Turso không có RLS: chính id là thứ duy nhất ngăn người
khác đọc tiến độ của máy này. Muốn dùng chung tiến độ giữa web và APK thì **phải
đăng nhập**.

### API `api/progress`

| Method | Tác dụng |
| --- | --- |
| `GET ?userId=...` | Đọc tiến độ, trả `{ progress: null }` nếu chưa có |
| `PUT ?userId=...` | Ghi tiến độ (upsert) |

Server không tin dữ liệu client: `userId` phải khớp `^[A-Za-z0-9_-]{16,64}$`, số âm
bị đưa về 0, `highestCompletedWeek` bị kẹp ở 35, danh sách id bị cắt ở 2000 phần tử,
`lastUpdated` sai định dạng bị thay bằng thời điểm hiện tại.

### Khi chưa cấu hình

App vẫn chạy đầy đủ offline. Màn **Tài khoản & đồng bộ** hiện "Đồng bộ thất bại —
Không kết nối được tới máy chủ đồng bộ" và mọi tính năng học tập, đổi giờ, chơi game
vẫn hoạt động bình thường.

## Đăng nhập & đồng bộ (Supabase Auth)

### Vào đâu để đăng nhập

**Góc Game → Phụ huynh cấp thêm giờ → nhập PIN (`1234`) → Tài khoản & đồng bộ.**
Màn hình tài khoản nằm sau mã PIN để học sinh không tự đăng xuất hay đổi tài khoản.

### Cách hoạt động

- **Phương thức**: email + mật khẩu (`signInWithPassword` / `signUp`). Không cần
  deep link hay thư viện OAuth nào thêm, chạy được ngay trong Expo Go.
- **Session được lưu** vào AsyncStorage (`persistSession: true`) nên mở lại app là
  vẫn đăng nhập. Token chỉ tự làm mới khi app ở tiền cảnh
  (`startAutoRefresh`/`stopAutoRefresh` theo `AppState`).
- **Đăng nhập là tuỳ chọn.** Không cấu hình `.env` hoặc không đăng nhập thì app chạy
  offline đầy đủ; trạng thái hiển thị là `disabled` / `signedOut`.

### Quy tắc hợp nhất dữ liệu (`PlaytimeContext`)

Khi đăng nhập, app so `last_updated` của server với mốc cục bộ:

| Tình huống | Kết quả |
| --- | --- |
| Tài khoản chưa có bản ghi | Đẩy tiến độ của máy này lên |
| Máy mới cài (chưa từng lưu gì) | Lấy dữ liệu server về |
| `last_updated` của server mới hơn | Lấy dữ liệu server về |
| Dữ liệu máy này mới hơn | Đẩy lên server |

Sau đó mỗi thay đổi được đẩy lên với **throttle 15 giây** (không dùng debounce, vì
trong lúc đồng hồ chạy tiến độ đổi mỗi giây nên debounce sẽ không bao giờ kịp chạy).
Nút **Đồng bộ ngay** cho phép phụ huynh hợp nhất lại thủ công.

### Hai giới hạn cần biết

1. **`UserProgress` tính theo phút**, nên phần giây lẻ không được đồng bộ. Khi lấy dữ
   liệu từ máy khác về, số giây dư bị làm tròn xuống (`floor`) — chọn `floor` để không
   bao giờ tặng thêm thời gian chơi cho học sinh.
2. **Session lưu ở AsyncStorage không mã hoá.** Với thiết bị gia đình thì đủ dùng.
   Muốn mã hoá, làm theo `LargeSecureStore` trong docs Supabase (cần thêm
   `expo-secure-store`, `aes-js`, `react-native-get-random-values`) rồi truyền vào
   `auth.storage` trong `lib/supabase.ts`.

### Lưu ý khi thử nghiệm

Supabase **mặc định bắt xác nhận email** trước khi tạo session, nên `signUp` sẽ trả
về `session = null` và app hiện thông báo "hãy mở email để xác nhận". Khi đang phát
triển, có thể tắt ở **Authentication → Providers → Email → Confirm email**.

`saveQuizResult` trong `lib/supabase.ts` đã sẵn sàng nhưng **chưa được gọi** — hiện
app chỉ đồng bộ tiến độ tổng, chưa lưu lịch sử từng bài test.
