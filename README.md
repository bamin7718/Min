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
| `constants/mockData.ts` | 60 câu hỏi Lớp 3 (20 Toán, 20 Tiếng Việt, 20 Tiếng Anh) + hàm rút đề + các hằng số cấu hình |
| `constants/theme.ts` | Bảng màu, khoảng cách, ngưỡng tablet |
| `lib/supabase.ts` | Supabase Client tuỳ chọn để đồng bộ tiến độ |

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
| `DEFAULT_PARENT_PIN` | `'1234'` | Mã PIN phụ huynh |

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
