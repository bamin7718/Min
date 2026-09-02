# Min EG — Min Education Gamification

Ứng dụng React Native (Expo + TypeScript) kết hợp **học tập** và **quản lý thời gian
chơi game** cho học sinh tiểu học. Học sinh trả lời đúng câu hỏi Toán / Tiếng Việt /
Tiếng Anh để tích luỹ phút chơi game; hết giờ thì Góc Game bị khoá và cần phụ huynh
nhập mã PIN mới cấp thêm.

Phiên bản hiện tại: **v1.0.8** (`constants/version.ts`, `app.json`, `package.json` —
pre-commit hook giữ ba tệp này đồng bộ).

## Chạy ở localhost

```bash
npm install
npx expo start
```

Sau đó:

- **Android (điện thoại/tablet)**: mở app **Expo Go**, quét QR trong terminal.
- **Android emulator**: nhấn `a` trong terminal.
- **Trình duyệt** (kiểm tra nhanh): nhấn `w`, hoặc `npm run web`.

Không cần cấu hình gì để chạy: thiếu máy chủ đồng bộ thì app tự vào **Local Mode** —
tài khoản, tiến độ, mã PIN nằm trong AsyncStorage của máy.

### Yêu cầu môi trường

- **Node >= 20** (`engines` trong `package.json`). CI dùng Node 22.
- **npm >= 10.** npm 9.2.0 chạy trên Node 22 gặp lỗi `ENOENT rename` trong cacache và
  không cài được dependency.
- Trên máy không phải git repo, `npm install` sẽ báo exit 1 ở script `prepare`
  (`git config core.hooksPath` + `|| true` là cú pháp POSIX, không chạy trên cmd
  Windows). Dependency vẫn cài đủ.

## Cấu trúc

| Đường dẫn | Vai trò |
| --- | --- |
| `App.tsx` | Bottom Tabs: **Học Tập** ↔ **Góc Game** ↔ **Cài Đặt**, bọc `AuthProvider` + `PlaytimeProvider` |
| `components/Header.tsx` | Thanh trên cùng: logo, avatar, họ tên, badge khối lớp, chip điểm/phút |
| `components/AppIcon.tsx` | Logo vẽ bằng `View` thuần — chồng sách + tay cầm game 3D + huy hiệu |
| `components/GradePicker.tsx` | Hộp thoại chọn khối lớp 1-12 (lưới 4×3) |
| `components/AvatarPicker.tsx` | Hộp thoại chọn avatar (12 emoji) |
| `context/AuthContext.tsx` | Session, đăng nhập/đăng ký/đăng xuất, hồ sơ, mã PIN, khoá ứng dụng |
| `context/PlaytimeContext.tsx` | Điểm, giây chơi game, đồng hồ, thống kê làm bài, hạn mức của phụ huynh |
| `screens/QuizScreen.tsx` | Chọn môn → chọn tuần → làm bài → tổng kết. Lọc nội dung theo khối lớp |
| `screens/GameVaultScreen.tsx` | Đồng hồ, lưới 5 trò chơi, màn khoá, khu vực phụ huynh |
| `screens/SettingsScreen.tsx` | Hồ sơ, âm thanh, khu vực phụ huynh (sau PIN), phiên bản, đăng xuất |
| `screens/AuthScreen.tsx` | Đăng nhập / Đăng ký (họ tên, tên đăng nhập, khối lớp, mật khẩu) |
| `screens/PinGate.tsx` | Màn nhập PIN dùng lại cho khoá ứng dụng |
| `screens/UpdateModal.tsx` | Thông báo bản APK mới, hỗ trợ cập nhật bắt buộc |
| `screens/OtaUpdateModal.tsx` | Thông báo bản cập nhật ngầm, hiện ngay sau khi đăng nhập |
| **Nội dung học** | |
| `constants/curriculum.ts` | Sổ đăng ký lộ trình theo **khối lớp và môn** |
| `constants/mathCurriculum.ts` | Toán Lớp 3 — 35 tuần, 501 câu |
| `constants/vietnameseCurriculum.ts` | Tiếng Việt Lớp 3 — 35 tuần, 426 câu |
| `constants/grade1Curriculum.ts` | Lớp 1 — Toán + Tiếng Việt, tuần 1-6, 60 câu |
| `constants/grade2Curriculum.ts` | Lớp 2 — tuần 1-6, 60 câu |
| `constants/grade4Curriculum.ts` | Lớp 4 — tuần 1-6, 60 câu |
| `constants/grade5Curriculum.ts` | Lớp 5 — tuần 1-6, 60 câu |
| `constants/mockData.ts` | 20 câu Tiếng Anh, hàm rút đề, hàm trộn lựa chọn, các hằng số quy đổi |
| `lib/quizEngine.ts` | Rút đề ngẫu nhiên theo tuần, trộn đáp án, dựng lại đúng đề cũ |
| **Trò chơi** | |
| `screens/games/catalog.ts` | Danh sách 5 trò chơi trên lưới |
| `screens/games/GameShell.tsx` | Khung chung: đồng hồ trong game, nút thoát, lớp phủ tạm dừng |
| `screens/games/MarioMiniGame.tsx` | Runner: né nấm và hố, ăn tiền vàng |
| `screens/games/ColorSortGame.tsx` + `colorSortLogic.ts` | Sắp xếp màu, đề luôn có lời giải |
| `screens/games/PenaltyGame.tsx` + `penaltyLogic.ts` | Đá penalty 5 lượt |
| `screens/games/ZombieGame.tsx` + `zombieLogic.ts` | Bắn zombie, mua và nâng cấp súng |
| `screens/games/RacingGame.tsx` + `racingLogic.ts` | Đua xe bằng cách trả lời câu hỏi của lộ trình |
| **Dữ liệu & đồng bộ** | |
| `lib/storage.ts` | Đọc/ghi tiến độ theo `userId`, hàng đợi đồng bộ, `resolveConflict` |
| `lib/syncEngine.ts` | Lắng nghe NetInfo, đẩy hàng đợi, tự thử lại với backoff |
| `lib/authApi.ts` | Client gọi `api/auth` + `api/account` + `api/progress`; tự chuyển Local Mode |
| `lib/localAuth.ts` | Tài khoản chạy hoàn toàn trên máy (Local Mode) |
| `lib/session.ts` | Lưu phiên đăng nhập và cài đặt khoá ứng dụng |
| `lib/prefs.ts` | Cài đặt âm thanh / rung của thiết bị, hàm `vibrate()` |
| `lib/authCrypto.ts` / `lib/pureCrypto.ts` | PBKDF2 phía server / phía máy |
| `lib/turso.ts` | Tầng dữ liệu **Turso DB** (libSQL) — chỉ chạy phía server |
| `db/schema.sql` | Schema Turso DB |
| **API (Vercel Edge)** | |
| `api/auth.ts` | Đăng ký / đăng nhập |
| `api/account.ts` | Cập nhật hồ sơ, kiểm tra và đổi mã PIN |
| `api/progress.ts` | Đọc / ghi tiến độ (Bearer token) |
| `api/version.ts` / `api/check-version.ts` | Phiên bản mới nhất |
| `api/download-apk.ts` | Chuyển hướng 302 tới APK mới nhất |
| `api/manifest.ts` / `api/ota-asset.ts` | Máy chủ cập nhật ngầm (Expo Updates protocol v1) |
| **Khác** | |
| `services/updateService.ts` + `lib/otaUpdates.ts` | Kiểm tra và áp dụng bản cập nhật ngầm |
| `lib/updateChecker.ts` + `constants/version.ts` | So phiên bản với máy chủ |
| `constants/theme.ts` | Bảng màu, khoảng cách, ngưỡng tablet |
| `scripts/generate-icons.mjs` | Sinh toàn bộ icon PNG từ một mô tả hình học |
| `scripts/bump-version.js` | Tăng phiên bản ở cả ba tệp |
| `scripts/build-ota-manifest.mjs` | Sinh manifest Expo Updates trong CI |

## Hệ thiết kế

`constants/theme.ts` là nguồn duy nhất cho màu, bo góc, bóng đổ và cỡ vùng chạm.

| Token | Giá trị | Dùng cho |
| --- | --- | --- |
| `colors.math` / `mathSoft` | `#0EA5E9` | Môn Toán |
| `colors.vietnamese` / `Soft` | `#10B981` | Môn Tiếng Việt |
| `colors.english` / `Soft` | `#8B5CF6` | Môn Tiếng Anh |
| `colors.game` | `#7C3AED` | Góc Game |
| `colors.reward` | `#F59E0B` | Điểm và phút thưởng |
| `radius.md/lg/xl` | 16 / 20 / 28 | Bo góc mềm |
| `touch.min` / `touch.primary` | 48 / 56 | Vùng chạm tối thiểu |
| `TAB_BAR_SPACE` | 96 | Khoảng chừa ở đáy cho thanh tab nổi |
| `TABLET_BREAKPOINT` | 768 | Ngưỡng chuyển bố cục tablet |

`touch.min = 48` không phải con số tuỳ hứng: học sinh nhỏ bấm chưa chính xác nên vùng
chạm phải đạt tối thiểu 48dp theo hướng dẫn của Material.

### Bố cục cố định

```
┌──── Header cố định: logo · avatar · họ tên · 🎓 Lớp · ⭐ · ⏱️ · ⚙ ────┐
├──────────────────────────────────────────────────────────────────────┤
│                        ScrollView cuộn ở giữa                        │
├──────── Tab nổi: Học Tập · Góc Game · Cài Đặt ───────────────────────┤
└──────────────────────────────────────────────────────────────────────┘
```

Thanh tab dùng `position: absolute` với nền bán trong suốt (`colors.glass`), nên nội
dung phải chừa `TAB_BAR_SPACE = 96` ở đáy — thiếu là dòng cuối bị khuất.

> Không dùng blur thật: cần thêm `expo-blur` (native module) mà hiệu quả thị giác gần
> như tương đương nền bán trong suốt + bóng đổ.

Header hiện **họ và tên**, không hiện tên đăng nhập — tên đăng nhập là chuỗi không dấu
kiểu `minhkhang2026`, đọc lên không phải tên của ai cả. Nó chỉ xuất hiện ở màn hình
Cài đặt, dạng chỉ đọc kèm icon khoá.

## Nội dung học theo khối lớp

Hồ sơ học sinh chọn được **Lớp 1 đến Lớp 12**, nhưng chỉ một phần có nội dung:

| Khối lớp | Toán | Tiếng Việt | Ghi chú |
| --- | --- | --- | --- |
| Lớp 1 | 6 tuần / 30 câu | 6 tuần / 30 câu | Bộ Kết nối tri thức |
| Lớp 2 | 6 tuần / 30 câu | 6 tuần / 30 câu | Bộ Kết nối tri thức |
| **Lớp 3** | **35 tuần / 501 câu** | **35 tuần / 426 câu** | Bộ đề đầy đủ nhất |
| Lớp 4 | 6 tuần / 30 câu | 6 tuần / 30 câu | Bộ Kết nối tri thức |
| Lớp 5 | 6 tuần / 30 câu | 6 tuần / 30 câu | Bộ Kết nối tri thức |
| Lớp 6-12 | — | — | Tạm dùng nội dung Lớp 3 |

`contentGradeFor()` trong `constants/curriculum.ts` quy khối lớp chưa có nội dung về
Lớp 3. Trả về danh sách rỗng thì màn hình Học Tập trống trơn, tệ hơn nhiều so với việc
học sinh Lớp 8 tạm làm đề Lớp 3 — và màn hình có ghi rõ "(hồ sơ Lớp 8 chưa có bài
riêng)" để không ai hiểu sai.

Tiếng Anh **không gắn với khối lớp**: 20 câu trong `constants/mockData.ts`, rút đề ngẫu
nhiên. `isGradeAgnosticSubject()` nhận ra điều đó bằng cách quét sổ đăng ký, nên mai này
soạn lộ trình Tiếng Anh cho một lớp thì môn ấy tự động được lọc theo lớp.

### Cách khai dữ liệu

Các tệp lộ trình khai `WeekTopicSeed[]` (không có `grade`); khối lớp được gắn vào tại
đúng chỗ đăng ký trong `constants/curriculum.ts`:

```ts
const CURRICULUMS = {
  3: { 'Toán': withGrade(3, MATH_WEEKS), 'Tiếng Việt': withGrade(3, VIETNAMESE_WEEKS) },
  // ...
};
```

Làm vậy vì hai lẽ: dữ liệu Lớp 3 nằm trong hai tệp hơn 400 KB nên thêm một trường vào
70 mục là sửa rất nhiều chỗ, và quan trọng hơn — một tuần không thể tự khai khối lớp
lệch với chỗ nó được đăng ký.

### Tiến độ tuần khoá theo khối lớp

`completedWeeks` khoá theo **`"<khối lớp>:<môn>"`** — ví dụ `{"3:Toán": 9, "2:Tiếng Việt": 4}`.

Trước bản 1.0.9 khoá chỉ là tên môn. Phải thêm khối lớp vì mỗi lớp có lộ trình riêng:
giữ khoá cũ thì bé đang ở tuần 5 của Lớp 2 mà phụ huynh sửa hồ sơ sang Lớp 3 sẽ được
coi như đã qua tuần 5 của Lớp 3 — nhảy mất bốn tuần đầu của một chương trình khác hẳn.

`sanitizeWeekProgress()` trong `types/index.ts` lo việc nâng khoá cũ (`"Toán"`) lên dạng
mới (`"3:Toán"`), nên **tiến độ Lớp 3 đã có không mất gì**. Hàm này khai một chỗ duy
nhất vì trước đó có tới bốn bản sao gần giống nhau (storage, turso, api/progress,
PlaytimeContext) — thêm khối lớp mà phải sửa đúng cả bốn là kiểu lỗi chỉ lộ ra ở một
trong bốn đường đọc dữ liệu.

### Bộ sinh đề (`lib/quizEngine.ts`)

| Hàm | Tác dụng |
| --- | --- |
| `generateQuizForWeek(grade, subject, week, mastered, count)` | Rút ngẫu nhiên tối đa 10 câu, ưu tiên câu chưa trả lời đúng, trộn đáp án |
| `rebuildQuiz(session)` | Dựng lại **đúng bộ câu cũ**, chỉ trộn lại vị trí đáp án |
| `bankSize(grade, subject, week)` | Số câu trong ngân hàng của tuần |

Màn kết quả có hai nút: **ĐỔI ĐỀ MỚI** (rút bộ khác) và **LÀM LẠI ĐỀ NÀY** (giữ nguyên
bộ câu, xoá lựa chọn cũ, trộn lại vị trí đáp án).

Hai hằng số dễ lẫn, cố ý đặt tên khác nhau:

- `QUESTIONS_PER_WEEK_QUIZ = 10` (`lib/quizEngine.ts`) — số câu mỗi đề của một **tuần**.
- `QUESTIONS_PER_QUIZ = 6` (`constants/mockData.ts`) — số câu mỗi lượt của môn **rút đề
  ngẫu nhiên**.

### Trộn thứ tự lựa chọn

Mọi câu hỏi đều được trộn lại thứ tự A/B/C/D khi tạo đề (`shuffleQuestionOptions`). Lý
do: bộ đề tĩnh soạn tay rất khó phân bố đáp án đều — bản đầu của lộ trình Toán có đáp án
**D chỉ xuất hiện 3/125 lần**, học sinh hoàn toàn có thể đoán theo vị trí. Trộn khi tạo
đề đưa phân bố về đều và khiến làm lại cùng một câu không đoán được.

Trong bốn tệp lộ trình mới (Lớp 1, 2, 4, 5), đáp án đúng luôn đặt ở vị trí đầu
(`correctAnswer: 0`) — vị trí trong tệp không mang thông tin gì vì bộ trộn chạy ở mọi
đường tạo đề.

### Điều kiện qua tuần và phần thưởng

- Cần đúng **>= 2/3 số câu** của đề (`WEEK_PASS_RATIO = 2/3`).
  > Không dùng 0.7 vì với đề 3 câu thì `ceil(3 × 0.7) = 3` — bắt học sinh phải đúng
  > tuyệt đối mới qua được là quá khắt khe.
- Vượt qua tuần thì mở tuần kế tiếp và thưởng **`difficulty × 2` phút**
  (`WEEK_BONUS_MINUTES_PER_DIFFICULTY = 2`): Lớp 1-2 được 2 phút, Lớp 4 được 4 phút,
  Lớp 5 được 6 phút.
- **Chỉ thưởng ở lần đầu** vượt qua tuần. Làm lại tuần cũ vẫn được cộng điểm nhưng không
  cộng phút, để không thể lặp một tuần dễ nhằm lấy giờ chơi vô hạn.

### Chống cày phần thưởng

`REPEAT_ANSWER_GIVES_POINTS` và `REPEAT_ANSWER_GIVES_MINUTES` đều `false`: chỉ câu đúng
**lần đầu** mới sinh điểm và phút chơi game. Làm lại vẫn được luyện tập và vẫn thấy
đúng/sai, nhưng không tạo thêm phần thưởng.

Ngân hàng nhỏ hơn 10 câu thì engine lấy hết chứ **không lặp câu** để cho đủ số.

## Góc Game — 5 trò chơi tích hợp

Còn thời gian khả dụng thì Góc Game hiện lưới trò chơi; hết giờ thì lưới bị ẩn và thay
bằng màn hình khoá.

| Trò chơi | Nét chính |
| --- | --- |
| **Mario Mini** 🍄 | Runner viết bằng `requestAnimationFrame` + `View` tuyệt đối, không dùng WebView. Né nấm và hố, ăn tiền vàng, 3 mạng, tốc độ 180→330 px/s. `dt` chặn ở 0.05s để nhân vật không "xuyên" chướng ngại vật khi máy giật |
| **Sắp Xếp Màu** 🧪 | Đề sinh bằng cách đi *ngược* từ trạng thái đã giải nên **luôn có lời giải** — xáo trộn ngẫu nhiên thuần thì không đảm bảo điều đó. Mỗi khối có thêm ký hiệu (● ▲ ★ ■) để bạn khó phân biệt màu vẫn chơi được |
| **Đá Penalty** ⚽ | Chạm chọn 1 trong 6 góc sút, 5 lượt. Cản chắc chắn nếu thủ môn đổ đúng ô; đúng cột nhưng sai tầm thì cản với xác suất `SAVE_ON_SAME_COLUMN = 0.35` — chỉ cản khi trùng đúng ô thì tỉ lệ cản là 1/6, sút gần như luôn vào và mất hết hồi hộp |
| **Bắn Zombie** 🧟 | Bắn zombie lấy vàng, mua súng mới và nâng cấp sức mạnh |
| **Đua Xe Tri Thức** 🏁 | Trả lời đúng và nhanh để xe bứt phá. Câu hỏi lấy từ lộ trình của **chính khối lớp** học sinh đang học |

### Quản lý thời gian khi đang chơi

| Tình huống | Hành vi |
| --- | --- |
| Mở một trò chơi | `startPlaying()` — đồng hồ bắt đầu trừ từng giây |
| Đang chơi | Đồng hồ hiện trên thanh tiêu đề game, dưới 1 phút thì đổi màu đỏ |
| Thoát game | `pausePlaying()` — dừng trừ thời gian |
| Rời khỏi ứng dụng | Đồng hồ dừng **và** trò chơi bị lớp phủ "Đang tạm dừng" che lại |
| Quay lại ứng dụng | Đồng hồ chạy tiếp nếu trò chơi vẫn đang mở |
| Hết giờ hoặc hết hạn mức ngày | Trò chơi **tự đóng**, quay về màn hình khoá |

Ngoài lưới game còn nút **"Chỉ bấm giờ"** cho trường hợp chơi game *ngoài* ứng dụng.

## Quy tắc quy đổi

Đổi trong `constants/mockData.ts`:

| Hằng số | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `POINTS_PER_CORRECT` | `10` | Điểm cho mỗi câu đúng |
| `QUESTIONS_PER_QUIZ` | `6` | Số câu mỗi lượt của môn rút đề ngẫu nhiên |
| `rewardMinutes` (từng câu) | `2`–`3` | Phút chơi game khi trả lời đúng |
| `MAX_ACCUMULATED_MINUTES` | `120` | Trần **ví** thời gian tích luỹ |
| `REPEAT_ANSWER_GIVES_MINUTES` | `false` | Câu đã từng đúng thì lần sau chỉ cộng điểm |

### Cấu hình của phụ huynh

Nằm sau mã PIN, lưu trong `parentSettings` và đồng bộ lên Turso DB:

| Cấu hình | Lựa chọn | Ý nghĩa |
| --- | --- | --- |
| `dailyLimitMinutes` | 0 / 15 / 30 / 45 / 60 / 90 / 120 | Trần phút **tiêu** trong một ngày. `0` = không giới hạn |
| `rewardMultiplier` | ×0.5 / ×1 / ×1.5 / ×2 | Nhân phút thưởng mỗi câu đúng, làm tròn xuống |

Hạn mức ngày khác `MAX_ACCUMULATED_MINUTES`: cái đó là trần cho ví thời gian, còn cái
này giới hạn số phút được tiêu trong một ngày — con tích được 120 phút thì vẫn không
chơi quá hạn mức ngày. Hết hạn mức thì Góc Game khoá kèm câu đúng lý do ("Hết hạn mức
hôm nay", không phải "học thêm đi"), vì học thêm cũng không mở lại được hôm đó.

## Tài khoản và phân quyền

### Đăng ký tinh gọn

Form đăng ký gồm đúng bốn mục: **Họ và tên** → **Tên đăng nhập** → **Khối lớp** →
**Mật khẩu**. Không chọn vai trò, không nhập mã PIN.

Vai trò được **chốt ở server** chứ không đọc từ body request: nếu `api/auth.ts` đọc
`body.role` thì bất kỳ ai gửi `{"role":"parent"}` bằng curl là tự cấp quyền được. Mọi
tài khoản mới là `student`; cột `role` chỉ còn để các tài khoản `parent` tạo từ bản cũ
đăng nhập được.

### Mã PIN là cổng, không phải vai trò

Quyền vào khu vực phụ huynh dựa vào **mã PIN 4 số**, không dựa vào cột `role`. Phụ huynh
đặt PIN sau, trong Cài đặt → Khu vực phụ huynh.

| Khu vực | Chưa nhập PIN | Đã nhập PIN |
| --- | --- | --- |
| Học tập, Góc Game, 5 trò chơi | ✅ | ✅ |
| Hồ sơ (avatar, họ tên, khối lớp), âm thanh | ✅ | ✅ |
| Cấu hình thời gian chơi game | **Không render** | ✅ |
| Đổi mã PIN | **Không render** | ✅ |
| Báo cáo học tập | **Không render** | ✅ |
| Khoá ứng dụng | **Không render** | ✅ |
| "Phụ huynh cấp thêm giờ" trong Góc Game | **Không render** | ✅ |

Các mục quản lý **không được render** chứ không phải ẩn bằng style — không có ô nào
trong cây component để dò ra.

PIN được xác thực ở server (`/api/account?action=verify-pin`), băm bằng PBKDF2 giống mật
khẩu. App không giữ PIN nên không thể đọc từ bundle.

> **Đánh đổi:** kiểm tra PIN **cần có mạng** (trừ Local Mode). Bù lại: không đọc trộm
> được PIN, không brute-force ngoại tuyến được.

Sau lần nhập đúng đầu tiên, trạng thái mở khoá được giữ **trong bộ nhớ** cho tới khi
đóng app.

### Khoá ứng dụng

Tuỳ chọn trong Cài đặt (mặc định **tắt**). Bật lên thì mỗi lần mở app đều hỏi PIN — kể
cả khi con muốn vào học, nên chỉ hợp khi máy dùng chung.

### Mật khẩu và PIN

Băm bằng **PBKDF2-SHA256** qua WebCrypto (`lib/authCrypto.ts`), lưu dạng
`pbkdf2$<vòng>$<salt>$<hash>`, so sánh theo thời gian hằng số.

| Nơi | Số vòng | Vì sao |
| --- | --- | --- |
| Server (`api/*`) | 100 000 | Máy chủ có CPU, không ảnh hưởng trải nghiệm |
| Local Mode (`lib/localAuth.ts`) | 10 000 | Android không có `crypto.subtle`, PBKDF2 phải chạy bằng JavaScript thuần; 100 000 vòng làm màn hình đăng nhập treo vài giây |

Cố tình **không băm ở client** khi có server: nếu client băm thì chính cái hash trở thành
mật khẩu.

## Kiến trúc Offline-First

Ứng dụng coi **Local là nguồn dữ liệu chính**.

```
Thao tác  ->  state React (tức thì)  ->  AsyncStorage  ->  sync_queue  ->  Turso DB
                    UI cập nhật ngay        nguồn chính      ngầm, có retry
```

| File | Vai trò |
| --- | --- |
| `lib/storage.ts` | Đọc/ghi tiến độ theo `userId`, quản lý `sync_queue`, `resolveConflict` |
| `lib/syncEngine.ts` | Lắng nghe NetInfo, đẩy hàng đợi, tự thử lại với backoff |

**Hàng đợi gộp theo tài khoản.** Tiến độ là ảnh chụp toàn phần, không phải delta — nên
chỉ ảnh chụp mới nhất của mỗi tài khoản là có ý nghĩa. `enqueueProgress` **thay thế** mục
cũ cùng `userId` thay vì nối thêm: offline cả ngày thì hàng đợi vẫn chỉ có 1 mục, và
không có nguy cơ một ảnh chụp cũ ghi đè lên ảnh chụp mới.

**Giải quyết xung đột.** `resolveConflict(localLastUpdated, remoteLastUpdated)` —
timestamp mới nhất thắng. `localLastUpdated === null` (máy mới cài) thì luôn lấy dữ liệu
server. So sánh bằng `Date.parse` chứ không so chuỗi, vì server trả `+00:00` còn `Date`
trả `Z`.

**Thử lại khi lỗi.** Backoff 5s → 10s → 20s → … tối đa 5 phút. Trạng thái `offline` luôn
thắng khi đặt status, để một lượt `flush()` đang dở không báo nhầm "đã đồng bộ" sau khi
thiết bị đã rớt mạng.

**Tối ưu render.** `WeekCard`, `WeekPicker`, `OptionButton`, `SubjectCard`, `GameGrid`
đều bọc `React.memo`. Quan trọng nhất là `WeekCard`: khi đồng hồ chạy, context đổi mỗi
giây, không memo thì **cả 35 thẻ tuần re-render mỗi giây**. `WeekCard` nhận
`onSelect(weekNumber)` thay vì closure `() => onChooseWeek(n)` để prop không đổi giữa
các lần render — dùng closure thì `React.memo` vô tác dụng.

**Preload asset.** `App.tsx` nạp trước font icon Ionicons và ảnh trong `assets/`, nhưng
**có hạn 2 giây** và bắt mọi lỗi: trên web `Asset.loadAsync`/`Font.loadAsync` đi qua
mạng, mất mạng là chúng không bao giờ kết thúc — chặn UI chờ nó thì app đứng ở màn splash
vĩnh viễn.

## Turso DB (libSQL)

Database chính thức và duy nhất của dự án: `libsql://min-bamin7718.aws-ap-northeast-1.turso.io`

### Vì sao app không nối trực tiếp

```
App (chỉ fetch + session token)  ->  /api/auth, /api/account, /api/progress  ->  Turso DB
```

Nối trực tiếp bằng `EXPO_PUBLIC_TURSO_AUTH_TOKEN` sẽ **vô hiệu hoá toàn bộ tính năng đăng
nhập**, vì:

- Tiền tố `EXPO_PUBLIC_` khiến Metro nhúng giá trị **thẳng vào bundle JavaScript** lúc
  build. Token nằm trong APK, ai giải nén cũng đọc được.
- Token Turso có **toàn quyền** đọc/ghi/xoá và libSQL **không có Row Level Security**.
  Nên bảng `users` (kèm `password_hash`) ai cũng đọc được, và `DROP TABLE` được.
- `WHERE user_id = ?` chạy ở client thì chính client chọn điều kiện — chỉ cần
  `SELECT * FROM user_progress` là lấy hết dữ liệu mọi học sinh.

Nên điểm thực thi phân quyền đặt ở server: **`user_id` lấy TỪ session token đã ký
HMAC**, không phải từ tham số client gửi lên.

`lib/turso.ts` chỉ được `api/*` import; app không import nó, nhờ vậy `@libsql/client`
không vào bundle app. Job `publish-ota` trong CI có một bước quét bundle đã xuất tìm
`libsql://` / `TURSO_AUTH_TOKEN` để canh đúng chỗ này.

### Bảng

| Bảng | Cột |
| --- | --- |
| `users` | `id`, `username` (UNIQUE), `display_name`, `grade`, `avatar`, `password_hash`, `role`, `pin_code`, `created_at` |
| `user_progress` | `id`, `user_id` (FK), `subject`, `completed_week`, `completed_weeks`, `total_points`, `accumulated_game_minutes`, `mastered_question_ids`, `answer_stats`, `parent_settings`, `updated_at`, UNIQUE(`user_id`,`subject`) |
| `quiz_results` | Lịch sử bài làm (chưa dùng) |
| `app_version` | Một dòng duy nhất (id = 1) mô tả bản phát hành mới nhất |

Vài điểm lệch so với spec ban đầu, đều có lý do:

- `mastered_question_ids`: thiếu nó thì quy tắc "câu đã trả lời đúng không cộng phút nữa"
  mất hiệu lực mỗi khi đổi thiết bị.
- `subject` hiện luôn là `'chung'` (một dòng cho mỗi học sinh), vì điểm và phút chơi game
  là giá trị tổng chứ không tách theo môn. Giữ cột lại để sau tách được mà không phải đổi
  schema.
- `answer_stats` chỉ lưu `{answered, correct}`; số câu sai = `answered - correct`. Giữ cả
  ba thì chỉ cần một lần cộng lệch là ba số tự mâu thuẫn nhau.

`initDatabase()` tự chạy migration mỗi lần gọi (thêm cột, chuyển schema cũ), nên không
bao giờ phải dựng lại database bằng tay.

### Bật lên

**1. Tạo bảng:**
```bash
turso db shell min-bamin7718 < db/schema.sql
```

**2. Vercel → Settings → Environment Variables** (không có tiền tố `EXPO_PUBLIC_` nên
chỉ server đọc được):

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
| `POST /api/auth?action=register` | `{username, password, displayName, grade?}` → session |
| `POST /api/auth?action=login` | `{username, password}` → session |
| `POST /api/account?action=set-profile` | `{displayName?, grade?, avatar?}` → session |
| `POST /api/account?action=verify-pin` | `{pin}` |
| `POST /api/account?action=change-pin` | `{oldPin, newPin}` — chưa có PIN thì đây là lần đặt đầu |
| `GET /api/progress` | Đọc tiến độ (Bearer token) |
| `PUT /api/progress` | Ghi tiến độ (Bearer token) |

Server không tin client: tên đăng nhập phải khớp `^[a-zA-Z0-9_.-]{3,24}$`, mật khẩu >= 6
ký tự, họ tên 2-48 ký tự, PIN đúng 4 số, khối lớp kẹp về 1-12, số âm về 0, danh sách id
cắt ở 2000. Đăng nhập sai và tài khoản không tồn tại trả **cùng một thông báo** để không
tiết lộ tên nào đang dùng.

### Local Mode

Không cấu hình `EXPO_PUBLIC_PROGRESS_API_URL`, hoặc máy chủ không có API (ví dụ đang chạy
Metro ở localhost — nó trả HTML cho mọi đường dẫn), thì `lib/authApi.ts` tự chuyển hướng
sang `lib/localAuth.ts`. Đăng ký, đăng nhập, đổi hồ sơ, đặt PIN, tính giờ chơi game đều
hoạt động; chỉ là dữ liệu nằm trên chính máy đó.

Đây **không phải lỗi cấu hình** — với gia đình chỉ dùng một máy thì đó là chế độ chạy
bình thường, nên màn hình Cài đặt gọi nó là "Chế độ lưu trên máy (Local Mode)".

## Cập nhật ứng dụng

Hai đường, dùng cho hai loại thay đổi khác nhau:

| Đường | Đẩy được gì | Khi nào cần |
| --- | --- | --- |
| **Cập nhật ngầm (OTA)** | JavaScript và hình ảnh: đề bài mới, sửa giao diện, sửa luật chơi | Gần như mọi lần |
| **Tải lại APK** | Cả phần native | Thêm/bỏ thư viện native, đổi icon launcher |

### Cập nhật ngầm

`expo-updates` + `api/manifest.ts` (Expo Updates protocol v1) + nhánh `ota` của repo.
`runtimeVersion` theo chính sách **fingerprint**: Expo băm toàn bộ phần native, nên sửa
JavaScript thì chuỗi này không đổi và bản OTA vẫn hợp với APK đang cài; thêm thư viện
native thì nó đổi và máy cũ **tự động không nhận** bản OTA không hợp — thay vì nhận rồi
crash.

Luồng: có phiên đăng nhập → `checkForInAppUpdate()` chạy ngầm → có bản mới thì hiện
`OtaUpdateModal` với nút **Cập nhật ngay** / **Để sau**. Cũng có nút **⚡ Cập nhật nhanh
OTA** trong Cài đặt.

Chế độ dev không cập nhật ngầm được (Metro đã lo việc nạp lại mã). Muốn xem thử hộp
thoại: đặt `EXPO_PUBLIC_OTA_DEMO=1` rồi `npx expo start -c`.

### Kiểm tra bản APK mới

`checkAppUpdate()` so `APP_VERSION` với phiên bản máy chủ báo về, theo thứ tự ưu tiên:
`EXPO_PUBLIC_UPDATE_SERVER_URL` → `<API>/api/check-version` (đọc GitHub Releases) →
`<API>/api/version` (bảng `app_version` trên Turso DB).

So sánh phiên bản theo **số từng phần** chứ không so chuỗi — so chuỗi thì `1.0.10` lại bị
coi là cũ hơn `1.0.9`. Server báo phiên bản **cũ hơn** thì app im lặng.

`force_update = true` → khoá hẳn, không vào được app cho tới khi tải bản mới.

## CI/CD

Workflow duy nhất: `.github/workflows/build-apk.yml`.

| Trigger | Làm gì |
| --- | --- |
| push `main` (bỏ qua `**.md`) | Build APK → **artifact**, và phát hành OTA lên nhánh `ota` |
| push tag `v*` | Build APK **và tạo GitHub Release** |
| `workflow_dispatch` | Chạy tay, chỉ ra artifact |

Phát hành:

```bash
npm run bump-version          # hoặc bump-minor / bump-major
npx tsc --noEmit
git commit -am "chore: 1.0.8"
git tag v1.0.8                # PHẢI bằng version trong package.json
git push origin main v1.0.8
```

Tải APK: `https://min-silk-iota.vercel.app/api/download-apk` (chuyển hướng tới
`releases/latest/download/min-eg-app.apk`).

**Chi tiết đầy đủ — danh sách secrets, cách sinh keystore base64, kết quả rà soát cấu
hình, và ba chỗ công thức của SoFin không port sang được — xem
[`DEVOPS_CHECKLIST.md`](./DEVOPS_CHECKLIST.md).** Công thức gốc ở
[`BUILD-APK.md`](./BUILD-APK.md).

### Chữ ký APK — đọc trước khi phát hành

Template Expo kèm sẵn `android/app/debug.keystore` (một tệp thật, cố định) và cấu hình
`release` dùng chính `signingConfigs.debug`, nên mọi lần build đều ký bằng cùng một khoá
và người dùng cài đè được.

- **Dùng riêng trong nhà thì ổn.**
- **KHÔNG dùng để phát hành lên Google Play.** Khoá trong template là **công khai** (nằm
  trong gói npm), ai cũng ký được một APK giả mạo cùng package
  `com.bamin7718.lop3studygame`.

Workflow ký đè bằng khoá của bạn (`ANDROID_DEBUG_KEYSTORE_B64`) và có một **cổng chặn
chữ ký** đối chiếu vân tay SHA-256. Đổi khoá ký sẽ khiến người dùng bản cũ không cài đè
được và phải gỡ app — mà gỡ app là xoá sạch AsyncStorage. Xem `DEVOPS_CHECKLIST.md` §2.4.

## Giới hạn đã biết

Những chỗ app **chưa** làm được, nói rõ để không ai hiểu sai:

**Khối lớp chỉ là dữ liệu hồ sơ ở Lớp 6-12.** Chọn Lớp 8 thì vẫn ra đề Lớp 3. Màn hình
Học Tập có ghi rõ điều này.

**Chưa có nhạc nền.** Dự án không kèm tệp nhạc nào và không có thư viện phát nhạc. Công
tắc "Nhạc nền" trong Cài đặt có, lưu được, nhưng `isBgmSupported()` trả `false` kèm giải
thích trên UI. BGM thật cần `expo-audio` — là native module, nên `runtimeVersion` đổi và
mọi máy đang cài mất đường cập nhật ngầm cho tới khi cài lại APK.

**Hiệu ứng âm thanh chỉ kêu trên web.** `lib/gameSound.ts` sinh tiếng bằng Web Audio API;
React Native trên Android không có API đó nên bản APK im lặng. **Rung thì thật** — dùng
`Vibration` có sẵn trong React Native core.

**Báo cáo học tập chỉ có dữ liệu từ bản 1.0.8.** Trước đó app chỉ lưu id câu đã đúng,
không đếm câu sai.

**Hạn mức ngày tính riêng cho từng máy.** `dailyUsage` không đồng bộ lên server: tiến độ
được đẩy lên dưới dạng ảnh chụp toàn phần với luật "mốc mới nhất thắng", nên nếu đồng bộ
thì hai máy chơi song song sẽ liên tục ghi đè số giây của nhau. Đánh đổi: con đổi sang
máy khác là được thêm một hạn mức nữa.

**Khoá là khoá trong ứng dụng.** Hết giờ thì Góc Game hiển thị lớp khoá và không cho bấm
chơi; đồng hồ tự tạm dừng khi app rời nền (`AppState`). Ứng dụng Expo **không thể khoá
các app game khác** trên máy — muốn cưỡng chế ở cấp hệ điều hành thì cần native module
(Android `UsageStatsManager` / Device Admin) và phải build development build thay vì
Expo Go.

**Session lưu ở AsyncStorage không mã hoá.** Với thiết bị gia đình thì đủ dùng. Muốn mã
hoá thì cần thêm `expo-secure-store`.

**`quiz_results` chưa được ghi.** App hiện chỉ đồng bộ tiến độ tổng, chưa lưu lịch sử
từng bài làm.

**Đá Penalty chưa hỗ trợ vuốt.** Spec cho phép "vuốt hoặc bấm chọn góc sút"; chọn **chạm**
vì rõ ràng hơn với học sinh nhỏ và không cần `PanResponder`.

**Sắp Xếp Màu chững độ khó sau màn 3.** Không gian trạng thái của 4 màu / 5 ống là hữu
hạn nên tăng số bước xáo trộn không làm đề dài thêm (trung vị ~7-8 nước đi). Muốn khó hơn
phải thêm màu thứ 5 (6 ống), lúc đó lưới ống sẽ chật trên màn hình điện thoại.
