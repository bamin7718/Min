import type { Question, WeekStatus, WeekTopic } from '../types';

/**
 * Lộ trình Toán Lớp 3 theo 35 tuần học (Chương trình GDPT 2018).
 *
 * Tuần 1-10 được soạn chi tiết 5 câu/tuần; tuần 11-35 có đủ tên bài và 3 câu/tuần
 * làm khung để mở rộng thêm.
 *
 * LƯU Ý: không đổi `id` của câu đã có (`toan-01`..`toan-20` là các câu từ bản
 * trước, được xếp vào tuần phù hợp) vì `masteredQuestionIds` lưu trong
 * AsyncStorage tham chiếu tới các id này.
 */

/** Tổng số tuần của lộ trình */
export const TOTAL_WEEKS = 35;

/**
 * Tỉ lệ câu đúng tối thiểu để vượt qua một tuần.
 * Dùng 2/3 chứ không phải 0.7: với tuần chỉ có 3 câu thì 0.7 làm tròn lên thành
 * 3/3 — bắt học sinh 8 tuổi phải đúng tuyệt đối mới qua được là quá khắt khe.
 */
export const WEEK_PASS_RATIO = 2 / 3;

/** Phút chơi game thưởng thêm cho mỗi bậc độ khó khi hoàn thành tuần */
export const WEEK_BONUS_MINUTES_PER_DIFFICULTY = 2;

/** Số phút thưởng khi hoàn thành một tuần */
export function weekBonusMinutes(week: WeekTopic): number {
  return week.difficulty * WEEK_BONUS_MINUTES_PER_DIFFICULTY;
}

/** Số câu cần trả lời đúng để vượt qua một tuần */
export function weekPassThreshold(week: WeekTopic): number {
  return Math.ceil(week.questions.length * WEEK_PASS_RATIO);
}

const UNIT_1 = 'Ôn tập & Phép nhân, phép chia trong phạm vi 1000';
const UNIT_2 = 'Hình học & Đơn vị đo';
const UNIT_3 = 'Nhân, chia số có 2-3 chữ số với số có một chữ số';
const UNIT_4 = 'Các số đến 10 000 & phép tính trong phạm vi 10 000';
const UNIT_5 = 'Các số đến 100 000, diện tích & ôn tập cuối năm';

export const MATH_WEEKS: WeekTopic[] = [
  /* ============ GIAI ĐOẠN 1: TUẦN 1-4 ============ */
  {
    weekNumber: 1,
    unit: UNIT_1,
    title: 'Ôn tập các số đến 1000',
    difficulty: 1,
    questions: [
      {
        id: 'toan-w01-q1',
        subject: 'Toán',
        content: 'Số 405 đọc như thế nào?',
        options: ['Bốn trăm linh năm', 'Bốn trăm năm mươi', 'Bốn không năm', 'Bốn trăm năm'],
        correctAnswer: 0,
        rewardMinutes: 2,
        explanation: 'Chữ số hàng chục là 0 nên đọc là "linh": bốn trăm linh năm.',
      },
      {
        id: 'toan-w01-q2',
        subject: 'Toán',
        content: 'Số gồm 6 trăm, 3 chục và 8 đơn vị được viết là số nào?',
        options: ['638', '683', '368', '836'],
        correctAnswer: 0,
        rewardMinutes: 2,
        explanation: '6 trăm viết ở hàng trăm, 3 chục ở hàng chục, 8 đơn vị ở hàng đơn vị: 638.',
      },
      {
        id: 'toan-w01-q3',
        subject: 'Toán',
        content: 'Điền dấu thích hợp: 549 ... 594',
        options: ['>', '<', '=', 'Không so sánh được'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation:
          'Hai số cùng hàng trăm là 5. So hàng chục: 4 < 9 nên 549 < 594.',
      },
      {
        id: 'toan-w01-q4',
        subject: 'Toán',
        content: 'Số liền sau của 799 là số nào?',
        options: ['798', '800', '789', '890'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: 'Số liền sau là số lớn hơn 1 đơn vị: 799 + 1 = 800.',
      },
      {
        id: 'toan-07',
        subject: 'Toán',
        content: 'Số lớn nhất có ba chữ số khác nhau là số nào?',
        options: ['789', '987', '999', '978'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation:
          '987 — chọn chữ số lớn nhất cho hàng trăm rồi lần lượt các chữ số lớn tiếp theo. 999 có ba chữ số giống nhau nên không hợp lệ.',
      },
    ],
  },
  {
    weekNumber: 2,
    unit: UNIT_1,
    title: 'Ôn tập phép cộng, phép trừ trong phạm vi 1000',
    difficulty: 1,
    questions: [
      {
        id: 'toan-w02-q1',
        subject: 'Toán',
        content: 'Tính: 356 + 217 = ?',
        options: ['563', '573', '673', '553'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: '6 + 7 = 13 (viết 3 nhớ 1); 5 + 1 + 1 = 7; 3 + 2 = 5. Kết quả 573.',
      },
      {
        id: 'toan-w02-q2',
        subject: 'Toán',
        content: 'Tính: 800 − 465 = ?',
        options: ['335', '345', '435', '325'],
        correctAnswer: 0,
        rewardMinutes: 2,
        explanation: '800 − 465 = 335. Em có thể thử lại: 335 + 465 = 800.',
      },
      {
        id: 'toan-w02-q3',
        subject: 'Toán',
        content:
          'Một thư viện có 620 quyển sách, mua thêm 175 quyển. Thư viện có tất cả bao nhiêu quyển sách?',
        options: ['445', '785', '795', '895'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: '"Mua thêm" thì làm phép cộng: 620 + 175 = 795 (quyển).',
      },
      {
        id: 'toan-02',
        subject: 'Toán',
        content:
          'Một cửa hàng có 245 kg gạo, đã bán 128 kg. Hỏi cửa hàng còn lại bao nhiêu kg gạo?',
        options: ['113 kg', '117 kg', '123 kg', '127 kg'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: '245 − 128 = 117 (kg).',
      },
      {
        id: 'toan-19',
        subject: 'Toán',
        content:
          'Lan có 8 cái kẹo. Hùng có nhiều hơn Lan 5 cái kẹo. Hỏi Hùng có bao nhiêu cái kẹo?',
        options: ['13 cái', '3 cái', '40 cái', '12 cái'],
        correctAnswer: 0,
        rewardMinutes: 2,
        explanation: '"Nhiều hơn" thì làm phép cộng: 8 + 5 = 13 (cái).',
      },
    ],
  },
  {
    weekNumber: 3,
    unit: UNIT_1,
    title: 'Bảng nhân 2, bảng nhân 5 và bảng chia 2, bảng chia 5',
    difficulty: 1,
    questions: [
      {
        id: 'toan-w03-q1',
        subject: 'Toán',
        content: 'Tính: 5 × 7 = ?',
        options: ['30', '35', '40', '45'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: '5 × 7 = 35. Bảng nhân 5 tăng dần 5, 10, 15, ... 35.',
      },
      {
        id: 'toan-w03-q2',
        subject: 'Toán',
        content: 'Tính: 2 × 9 = ?',
        options: ['16', '18', '20', '11'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: '2 × 9 = 18, bằng 9 + 9.',
      },
      {
        id: 'toan-w03-q3',
        subject: 'Toán',
        content: 'Tính: 10 : 2 = ?',
        options: ['4', '5', '6', '8'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: '10 : 2 = 5, vì 2 × 5 = 10.',
      },
      {
        id: 'toan-w03-q4',
        subject: 'Toán',
        content: 'Tính: 45 : 5 = ?',
        options: ['7', '8', '9', '10'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: '45 : 5 = 9, vì 5 × 9 = 45.',
      },
      {
        id: 'toan-w03-q5',
        subject: 'Toán',
        content: 'Mỗi bàn học có 2 bạn. Hỏi 8 bàn như thế có bao nhiêu bạn?',
        options: ['10', '14', '16', '18'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: 'Mỗi bàn 2 bạn, có 8 bàn: 2 × 8 = 16 (bạn).',
      },
    ],
  },
  {
    weekNumber: 4,
    unit: UNIT_1,
    title: 'Bảng nhân 3, 4, 6, 7 và các bảng chia tương ứng',
    difficulty: 1,
    questions: [
      {
        id: 'toan-01',
        subject: 'Toán',
        content: 'Kết quả của phép tính 7 × 8 là bao nhiêu?',
        options: ['54', '56', '58', '63'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: '7 × 8 = 56. Em nhớ lại bảng nhân 7 nhé!',
      },
      {
        id: 'toan-04',
        subject: 'Toán',
        content: 'Kết quả của phép tính 6 × 9 là bao nhiêu?',
        options: ['54', '45', '56', '63'],
        correctAnswer: 0,
        rewardMinutes: 2,
        explanation: '6 × 9 = 54.',
      },
      {
        id: 'toan-05',
        subject: 'Toán',
        content: 'Kết quả của phép tính 42 : 6 là bao nhiêu?',
        options: ['6', '8', '7', '9'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: '42 : 6 = 7, vì 6 × 7 = 42.',
      },
      {
        id: 'toan-w04-q1',
        subject: 'Toán',
        content: 'Tính: 28 : 4 = ?',
        options: ['6', '7', '8', '9'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: '28 : 4 = 7, vì 4 × 7 = 28.',
      },
      {
        id: 'toan-20',
        subject: 'Toán',
        content:
          'Một thùng có 6 hộp bánh, mỗi hộp có 8 chiếc bánh. Hỏi thùng đó có bao nhiêu chiếc bánh?',
        options: ['14 chiếc', '48 chiếc', '42 chiếc', '68 chiếc'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: '6 hộp, mỗi hộp 8 chiếc: 6 × 8 = 48 (chiếc).',
      },
    ],
  },

  /* ============ GIAI ĐOẠN 2: TUẦN 5-10 ============ */
  {
    weekNumber: 5,
    unit: UNIT_2,
    title: 'Gấp một số lên nhiều lần, giảm một số đi nhiều lần',
    difficulty: 1,
    questions: [
      {
        id: 'toan-13',
        subject: 'Toán',
        content: 'Gấp số 7 lên 5 lần thì được số nào?',
        options: ['12', '40', '35', '2'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: 'Gấp lên nhiều lần thì làm phép nhân: 7 × 5 = 35.',
      },
      {
        id: 'toan-14',
        subject: 'Toán',
        content: 'Giảm số 36 đi 4 lần thì được số nào?',
        options: ['32', '9', '40', '144'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: 'Giảm đi nhiều lần thì làm phép chia: 36 : 4 = 9.',
      },
      {
        id: 'toan-w05-q1',
        subject: 'Toán',
        content: 'Gấp số 6 lên 4 lần thì được số nào?',
        options: ['10', '24', '2', '64'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: '6 × 4 = 24.',
      },
      {
        id: 'toan-w05-q2',
        subject: 'Toán',
        content: 'Giảm số 40 đi 5 lần thì được số nào?',
        options: ['8', '35', '45', '200'],
        correctAnswer: 0,
        rewardMinutes: 2,
        explanation: '40 : 5 = 8.',
      },
      {
        id: 'toan-12',
        subject: 'Toán',
        content: 'Một phần tư (1/4) của 20 là bao nhiêu?',
        options: ['4', '5', '6', '80'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: 'Muốn tìm 1/4 của 20 thì lấy 20 : 4 = 5.',
      },
      {
        id: 'toan-w05-q3',
        subject: 'Toán',
        content:
          'Hà có 4 cái bút. Số bút của Nam gấp 3 lần số bút của Hà. Hỏi Nam có bao nhiêu cái bút?',
        options: ['7', '12', '1', '43'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: 'Gấp 3 lần thì nhân với 3: 4 × 3 = 12 (cái bút).',
      },
    ],
  },
  {
    weekNumber: 6,
    unit: UNIT_2,
    title: 'Điểm ở giữa, trung điểm của đoạn thẳng',
    difficulty: 1,
    questions: [
      {
        id: 'toan-w06-q1',
        subject: 'Toán',
        content:
          'Ba điểm A, O, B thẳng hàng theo đúng thứ tự đó. Điểm nào ở giữa hai điểm còn lại?',
        options: ['Điểm A', 'Điểm O', 'Điểm B', 'Không có điểm nào'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: 'Điểm O nằm giữa A và B nên O là điểm ở giữa.',
      },
      {
        id: 'toan-w06-q2',
        subject: 'Toán',
        content:
          'M là trung điểm của đoạn thẳng AB. Biết AB dài 10 cm. Độ dài đoạn AM là bao nhiêu?',
        options: ['2 cm', '5 cm', '10 cm', '20 cm'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: 'Trung điểm chia đoạn thẳng thành hai phần bằng nhau: 10 : 2 = 5 (cm).',
      },
      {
        id: 'toan-w06-q3',
        subject: 'Toán',
        content: 'Điểm I là trung điểm của đoạn thẳng CD. Khi đó ta có điều gì?',
        options: ['IC = ID', 'IC > ID', 'IC < ID', 'IC = CD'],
        correctAnswer: 0,
        rewardMinutes: 2,
        explanation: 'Trung điểm cách đều hai đầu đoạn thẳng nên IC = ID.',
      },
      {
        id: 'toan-w06-q4',
        subject: 'Toán',
        content:
          'Đoạn thẳng PQ dài 8 cm, K là trung điểm của PQ. Độ dài đoạn KQ là bao nhiêu?',
        options: ['3 cm', '4 cm', '6 cm', '16 cm'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: '8 : 2 = 4 (cm).',
      },
      {
        id: 'toan-w06-q5',
        subject: 'Toán',
        content: 'Một điểm là trung điểm của đoạn thẳng khi điểm đó thoả mãn điều gì?',
        options: [
          'Ở giữa và cách đều hai đầu đoạn thẳng',
          'Chỉ cần ở giữa hai đầu đoạn thẳng',
          'Nằm ngoài đoạn thẳng',
          'Trùng với một đầu đoạn thẳng',
        ],
        correctAnswer: 0,
        rewardMinutes: 2,
        explanation: 'Trung điểm phải vừa ở giữa, vừa cách đều hai đầu đoạn thẳng.',
      },
    ],
  },
  {
    weekNumber: 7,
    unit: UNIT_2,
    title: 'Mi-li-mét và bảng đơn vị đo độ dài',
    difficulty: 1,
    questions: [
      {
        id: 'toan-w07-q1',
        subject: 'Toán',
        content: '1 cm bằng bao nhiêu mi-li-mét?',
        options: ['5 mm', '10 mm', '100 mm', '1000 mm'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: '1 cm = 10 mm.',
      },
      {
        id: 'toan-w07-q2',
        subject: 'Toán',
        content: '1 dm bằng bao nhiêu xăng-ti-mét?',
        options: ['10 cm', '100 cm', '1 cm', '1000 cm'],
        correctAnswer: 0,
        rewardMinutes: 2,
        explanation: '1 dm = 10 cm.',
      },
      {
        id: 'toan-15',
        subject: 'Toán',
        content: '1 m bằng bao nhiêu xăng-ti-mét?',
        options: ['1000 cm', '10 cm', '100 cm', '60 cm'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: '1 m = 100 cm.',
      },
      {
        id: 'toan-w07-q3',
        subject: 'Toán',
        content: '1 km bằng bao nhiêu mét?',
        options: ['10 m', '100 m', '1000 m', '10 000 m'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: '1 km = 1000 m.',
      },
      {
        id: 'toan-w07-q4',
        subject: 'Toán',
        content: 'Điền số thích hợp: 4 cm = ... mm',
        options: ['4', '14', '40', '400'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: 'Mỗi cm bằng 10 mm nên 4 cm = 4 × 10 = 40 (mm).',
      },
    ],
  },
  {
    weekNumber: 8,
    unit: UNIT_2,
    title: 'Gam — đơn vị đo khối lượng',
    difficulty: 1,
    questions: [
      {
        id: 'toan-16',
        subject: 'Toán',
        content: '1 kg bằng bao nhiêu gam?',
        options: ['1000 g', '100 g', '10 g', '500 g'],
        correctAnswer: 0,
        rewardMinutes: 2,
        explanation: '1 kg = 1000 g.',
      },
      {
        id: 'toan-w08-q1',
        subject: 'Toán',
        content: 'Điền số thích hợp: 3 kg = ... g',
        options: ['30', '300', '3000', '30 000'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: '3 kg = 3 × 1000 = 3000 (g).',
      },
      {
        id: 'toan-w08-q2',
        subject: 'Toán',
        content:
          'Một gói bánh nặng 250 g, một gói kẹo nặng 400 g. Hỏi cả hai gói nặng bao nhiêu gam?',
        options: ['150 g', '550 g', '650 g', '750 g'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: '250 + 400 = 650 (g).',
      },
      {
        id: 'toan-w08-q3',
        subject: 'Toán',
        content: 'Vật nào dưới đây nặng khoảng 1 kg?',
        options: ['Một quyển vở', 'Một túi gạo nhỏ', 'Một chiếc bút chì', 'Một tờ giấy'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation:
          'Một túi gạo nhỏ nặng khoảng 1 kg; quyển vở, bút chì, tờ giấy nhẹ hơn rất nhiều.',
      },
      {
        id: 'toan-w08-q4',
        subject: 'Toán',
        content: 'Điền số thích hợp: 500 g + 500 g = ... kg',
        options: ['1 kg', '2 kg', '10 kg', '1000 kg'],
        correctAnswer: 0,
        rewardMinutes: 2,
        explanation: '500 + 500 = 1000 (g) = 1 kg.',
      },
    ],
  },
  {
    weekNumber: 9,
    unit: UNIT_2,
    title: 'Mi-li-lít và lít — đơn vị đo dung tích',
    difficulty: 1,
    questions: [
      {
        id: 'toan-w09-q1',
        subject: 'Toán',
        content: '1 lít bằng bao nhiêu mi-li-lít?',
        options: ['10 ml', '100 ml', '1000 ml', '10 000 ml'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: '1 l = 1000 ml.',
      },
      {
        id: 'toan-w09-q2',
        subject: 'Toán',
        content:
          'Một can đựng 5 l nước, đã dùng hết 2 l. Hỏi trong can còn lại bao nhiêu lít nước?',
        options: ['2 l', '3 l', '7 l', '10 l'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: '5 − 2 = 3 (l).',
      },
      {
        id: 'toan-w09-q3',
        subject: 'Toán',
        content: 'Điền số thích hợp: 2 l = ... ml',
        options: ['20', '200', '2000', '20 000'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: '2 l = 2 × 1000 = 2000 (ml).',
      },
      {
        id: 'toan-w09-q4',
        subject: 'Toán',
        content:
          'Có 3 cái ca, mỗi ca đựng 250 ml nước. Hỏi cả 3 ca đựng bao nhiêu mi-li-lít nước?',
        options: ['253 ml', '500 ml', '750 ml', '850 ml'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: '250 × 3 = 750 (ml).',
      },
      {
        id: 'toan-w09-q5',
        subject: 'Toán',
        content: 'Đại lượng nào dưới đây thường được đo bằng đơn vị lít?',
        options: [
          'Chiều dài cái bàn',
          'Lượng nước trong xô',
          'Khối lượng bao gạo',
          'Thời gian học bài',
        ],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation:
          'Lít đo dung tích (lượng chất lỏng). Chiều dài đo bằng mét, khối lượng bằng ki-lô-gam.',
      },
    ],
  },
  {
    weekNumber: 10,
    unit: UNIT_2,
    title: 'Góc, góc vuông và góc không vuông',
    difficulty: 1,
    questions: [
      {
        id: 'toan-w10-q1',
        subject: 'Toán',
        content: 'Em dùng dụng cụ nào để kiểm tra một góc có phải góc vuông hay không?',
        options: ['Thước dây', 'Ê-ke', 'Com-pa', 'Bút chì'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: 'Ê-ke có một góc vuông nên dùng để kiểm tra góc vuông.',
      },
      {
        id: 'toan-w10-q2',
        subject: 'Toán',
        content: 'Hình nào dưới đây có 4 góc vuông?',
        options: ['Hình tam giác', 'Hình chữ nhật', 'Hình tròn', 'Hình thang thường'],
        correctAnswer: 1,
        rewardMinutes: 2,
        explanation: 'Hình chữ nhật có bốn góc đều là góc vuông.',
      },
      {
        id: 'toan-w10-q3',
        subject: 'Toán',
        content: 'Lúc 3 giờ đúng, hai kim đồng hồ tạo thành góc gì?',
        options: ['Góc vuông', 'Góc không vuông', 'Không tạo thành góc', 'Góc bẹt'],
        correctAnswer: 0,
        rewardMinutes: 2,
        explanation:
          'Lúc 3 giờ đúng, kim giờ chỉ số 3 và kim phút chỉ số 12, hai kim tạo thành một góc vuông.',
      },
      {
        id: 'toan-w10-q4',
        subject: 'Toán',
        content: 'Một hình tam giác có cả ba góc đều không vuông thì có mấy góc vuông?',
        options: ['0 góc vuông', '1 góc vuông', '2 góc vuông', '3 góc vuông'],
        correctAnswer: 0,
        rewardMinutes: 2,
        explanation: 'Cả ba góc đều không vuông nên hình đó không có góc vuông nào.',
      },
      {
        id: 'toan-w10-q5',
        subject: 'Toán',
        content: 'Hình vuông có mấy góc vuông?',
        options: ['2 góc vuông', '3 góc vuông', '4 góc vuông', 'Không có góc vuông'],
        correctAnswer: 2,
        rewardMinutes: 2,
        explanation: 'Hình vuông có bốn góc và cả bốn đều là góc vuông.',
      },
    ],
  },

  /* ============ GIAI ĐOẠN 3: TUẦN 11-18 ============ */
  {
    weekNumber: 11,
    unit: UNIT_3,
    title: 'Nhân số có hai chữ số với số có một chữ số (không nhớ)',
    difficulty: 2,
    questions: [
      {
        id: 'toan-w11-q1',
        subject: 'Toán',
        content: 'Tính: 23 × 3 = ?',
        options: ['66', '69', '26', '93'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '3 × 3 = 9; 2 × 3 = 6. Kết quả 69.',
      },
      {
        id: 'toan-w11-q2',
        subject: 'Toán',
        content: 'Tính: 12 × 4 = ?',
        options: ['16', '44', '48', '84'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: '2 × 4 = 8; 1 × 4 = 4. Kết quả 48.',
      },
      {
        id: 'toan-w11-q3',
        subject: 'Toán',
        content: 'Mỗi hộp có 21 cái kẹo. Hỏi 4 hộp như thế có bao nhiêu cái kẹo?',
        options: ['25 cái', '84 cái', '81 cái', '64 cái'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '21 × 4 = 84 (cái kẹo).',
      },
    ],
  },
  {
    weekNumber: 12,
    unit: UNIT_3,
    title: 'Nhân số có hai chữ số với số có một chữ số (có nhớ)',
    difficulty: 2,
    questions: [
      {
        id: 'toan-w12-q1',
        subject: 'Toán',
        content: 'Tính: 27 × 3 = ?',
        options: ['61', '81', '621', '71'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '7 × 3 = 21 (viết 1 nhớ 2); 2 × 3 = 6, thêm 2 nhớ được 8. Kết quả 81.',
      },
      {
        id: 'toan-w12-q2',
        subject: 'Toán',
        content: 'Tính: 48 × 2 = ?',
        options: ['86', '96', '816', '88'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '8 × 2 = 16 (viết 6 nhớ 1); 4 × 2 = 8, thêm 1 nhớ được 9. Kết quả 96.',
      },
      {
        id: 'toan-w12-q3',
        subject: 'Toán',
        content: 'Một lớp có 26 bạn. Hỏi ba lớp như thế có bao nhiêu bạn?',
        options: ['29 bạn', '68 bạn', '78 bạn', '618 bạn'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: '26 × 3 = 78 (bạn).',
      },
    ],
  },
  {
    weekNumber: 13,
    unit: UNIT_3,
    title: 'Chia số có hai chữ số cho số có một chữ số',
    difficulty: 2,
    questions: [
      {
        id: 'toan-w13-q1',
        subject: 'Toán',
        content: 'Tính: 84 : 4 = ?',
        options: ['12', '21', '22', '41'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '84 : 4 = 21, thử lại 21 × 4 = 84.',
      },
      {
        id: 'toan-w13-q2',
        subject: 'Toán',
        content: 'Tính: 96 : 3 = ?',
        options: ['23', '31', '32', '33'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: '96 : 3 = 32, thử lại 32 × 3 = 96.',
      },
      {
        id: 'toan-w13-q3',
        subject: 'Toán',
        content: 'Có 72 quyển vở chia đều cho 6 bạn. Hỏi mỗi bạn được bao nhiêu quyển vở?',
        options: ['11 quyển', '12 quyển', '66 quyển', '78 quyển'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '"Chia đều" thì làm phép chia: 72 : 6 = 12 (quyển).',
      },
    ],
  },
  {
    weekNumber: 14,
    unit: UNIT_3,
    title: 'Phép chia có dư',
    difficulty: 2,
    questions: [
      {
        id: 'toan-08',
        subject: 'Toán',
        content: 'Thực hiện phép chia 17 : 5, em được kết quả nào?',
        options: ['3 dư 2', '2 dư 7', '3 dư 1', '4 dư 1'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: '5 × 3 = 15, còn lại 17 − 15 = 2. Vậy 17 : 5 = 3 (dư 2).',
      },
      {
        id: 'toan-w14-q1',
        subject: 'Toán',
        content: 'Trong phép chia cho 4, số dư lớn nhất có thể là bao nhiêu?',
        options: ['1', '2', '3', '4'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Số dư luôn bé hơn số chia, nên số dư lớn nhất khi chia cho 4 là 3.',
      },
      {
        id: 'toan-w14-q2',
        subject: 'Toán',
        content: 'Thực hiện phép chia 25 : 6, em được kết quả nào?',
        options: ['4 dư 1', '3 dư 7', '4 dư 2', '5 dư 0'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: '6 × 4 = 24, còn lại 25 − 24 = 1. Vậy 25 : 6 = 4 (dư 1).',
      },
    ],
  },
  {
    weekNumber: 15,
    unit: UNIT_3,
    title: 'Nhân số có ba chữ số với số có một chữ số',
    difficulty: 2,
    questions: [
      {
        id: 'toan-w15-q1',
        subject: 'Toán',
        content: 'Tính: 123 × 3 = ?',
        options: ['369', '363', '396', '339'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: '3 × 3 = 9; 2 × 3 = 6; 1 × 3 = 3. Kết quả 369.',
      },
      {
        id: 'toan-w15-q2',
        subject: 'Toán',
        content: 'Tính: 214 × 4 = ?',
        options: ['846', '856', '884', '816'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '4 × 4 = 16 (viết 6 nhớ 1); 1 × 4 = 4, thêm 1 được 5; 2 × 4 = 8. Kết quả 856.',
      },
      {
        id: 'toan-w15-q3',
        subject: 'Toán',
        content: 'Mỗi thùng đựng 105 quả trứng. Hỏi 5 thùng đựng bao nhiêu quả trứng?',
        options: ['505 quả', '510 quả', '525 quả', '555 quả'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: '105 × 5 = 525 (quả trứng).',
      },
    ],
  },
  {
    weekNumber: 16,
    unit: UNIT_3,
    title: 'Chia số có ba chữ số cho số có một chữ số',
    difficulty: 2,
    questions: [
      {
        id: 'toan-w16-q1',
        subject: 'Toán',
        content: 'Tính: 648 : 2 = ?',
        options: ['314', '322', '324', '342'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: '648 : 2 = 324, thử lại 324 × 2 = 648.',
      },
      {
        id: 'toan-w16-q2',
        subject: 'Toán',
        content: 'Tính: 555 : 5 = ?',
        options: ['101', '110', '111', '115'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: '555 : 5 = 111, thử lại 111 × 5 = 555.',
      },
      {
        id: 'toan-w16-q3',
        subject: 'Toán',
        content: 'Có 396 quyển sách xếp đều vào 3 giá sách. Hỏi mỗi giá có bao nhiêu quyển?',
        options: ['122 quyển', '131 quyển', '132 quyển', '133 quyển'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: '396 : 3 = 132 (quyển).',
      },
    ],
  },
  {
    weekNumber: 17,
    unit: UNIT_3,
    title: 'Biểu thức số và tính giá trị của biểu thức',
    difficulty: 2,
    questions: [
      {
        id: 'toan-w17-q1',
        subject: 'Toán',
        content: 'Tính giá trị của biểu thức: 20 + 5 × 3',
        options: ['35', '75', '28', '45'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: 'Làm phép nhân trước: 5 × 3 = 15, rồi 20 + 15 = 35.',
      },
      {
        id: 'toan-w17-q2',
        subject: 'Toán',
        content: 'Tính giá trị của biểu thức: (16 + 4) : 5',
        options: ['4', '16', '20', '17'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: 'Làm trong ngoặc trước: 16 + 4 = 20, rồi 20 : 5 = 4.',
      },
      {
        id: 'toan-w17-q3',
        subject: 'Toán',
        content: 'Tính giá trị của biểu thức: 40 − 12 : 4',
        options: ['7', '28', '37', '34'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Làm phép chia trước: 12 : 4 = 3, rồi 40 − 3 = 37.',
      },
    ],
  },
  {
    weekNumber: 18,
    unit: UNIT_3,
    title: 'Tìm thành phần chưa biết của phép tính',
    difficulty: 2,
    questions: [
      {
        id: 'toan-09',
        subject: 'Toán',
        content: 'Tìm x, biết: x × 4 = 32',
        options: ['6', '7', '9', '8'],
        correctAnswer: 3,
        rewardMinutes: 3,
        explanation: 'Muốn tìm một thừa số thì lấy tích chia cho thừa số kia: x = 32 : 4 = 8.',
      },
      {
        id: 'toan-w18-q1',
        subject: 'Toán',
        content: 'Tìm x, biết: x + 25 = 70',
        options: ['35', '45', '95', '55'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: 'Muốn tìm số hạng thì lấy tổng trừ số hạng kia: x = 70 − 25 = 45.',
      },
      {
        id: 'toan-w18-q2',
        subject: 'Toán',
        content: 'Tìm x, biết: x : 6 = 7',
        options: ['13', '42', '1', '36'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: 'Muốn tìm số bị chia thì lấy thương nhân số chia: x = 7 × 6 = 42.',
      },
    ],
  },

  /* ============ GIAI ĐOẠN 4: TUẦN 19-25 ============ */
  {
    weekNumber: 19,
    unit: UNIT_4,
    title: 'Các số trong phạm vi 10 000',
    difficulty: 2,
    questions: [
      {
        id: 'toan-w19-q1',
        subject: 'Toán',
        content: 'Số 3 205 đọc như thế nào?',
        options: [
          'Ba nghìn hai trăm linh năm',
          'Ba nghìn hai trăm năm mươi',
          'Ba trăm hai nghìn năm',
          'Ba nghìn hai trăm năm',
        ],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: 'Hàng chục là 0 nên đọc "linh": ba nghìn hai trăm linh năm.',
      },
      {
        id: 'toan-w19-q2',
        subject: 'Toán',
        content: 'Số gồm 5 nghìn, 0 trăm, 4 chục và 2 đơn vị được viết là số nào?',
        options: ['5042', '5402', '5420', '542'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: 'Viết lần lượt theo hàng nghìn, trăm, chục, đơn vị: 5042.',
      },
      {
        id: 'toan-w19-q3',
        subject: 'Toán',
        content: 'Số lớn nhất có bốn chữ số là số nào?',
        options: ['1000', '9990', '9999', '10 000'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Cả bốn chữ số đều lớn nhất là 9 nên số đó là 9999.',
      },
    ],
  },
  {
    weekNumber: 20,
    unit: UNIT_4,
    title: 'Phép cộng, phép trừ trong phạm vi 10 000',
    difficulty: 2,
    questions: [
      {
        id: 'toan-06',
        subject: 'Toán',
        content: 'Tính 1234 + 2345 = ?',
        options: ['3479', '3589', '3679', '3579'],
        correctAnswer: 3,
        rewardMinutes: 3,
        explanation: '1234 + 2345 = 3579. Em cộng lần lượt từ hàng đơn vị nhé.',
      },
      {
        id: 'toan-w20-q1',
        subject: 'Toán',
        content: 'Tính: 5678 − 2345 = ?',
        options: ['3333', '3343', '3433', '2333'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: '5678 − 2345 = 3333, thử lại 3333 + 2345 = 5678.',
      },
      {
        id: 'toan-w20-q2',
        subject: 'Toán',
        content:
          'Một cửa hàng có 4500 kg gạo, đã bán được 1750 kg. Hỏi còn lại bao nhiêu ki-lô-gam gạo?',
        options: ['2650 kg', '2750 kg', '2850 kg', '6250 kg'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '4500 − 1750 = 2750 (kg).',
      },
    ],
  },
  {
    weekNumber: 21,
    unit: UNIT_4,
    title: 'Phép nhân, phép chia trong phạm vi 10 000',
    difficulty: 3,
    questions: [
      {
        id: 'toan-w21-q1',
        subject: 'Toán',
        content: 'Tính: 1234 × 2 = ?',
        options: ['2468', '2464', '2438', '2268'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: 'Nhân từng hàng với 2: 1234 × 2 = 2468.',
      },
      {
        id: 'toan-w21-q2',
        subject: 'Toán',
        content: 'Tính: 8000 : 4 = ?',
        options: ['200', '2000', '20 000', '400'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '8 nghìn chia 4 được 2 nghìn: 8000 : 4 = 2000.',
      },
      {
        id: 'toan-w21-q3',
        subject: 'Toán',
        content: 'Tính: 2105 × 3 = ?',
        options: ['6305', '6315', '6335', '6215'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '5 × 3 = 15 (viết 5 nhớ 1); 0 × 3 = 0, thêm 1 được 1; 1 × 3 = 3; 2 × 3 = 6. Kết quả 6315.',
      },
    ],
  },
  {
    weekNumber: 22,
    unit: UNIT_4,
    title: 'Giải bài toán có lời văn bằng hai bước tính',
    difficulty: 3,
    questions: [
      {
        id: 'toan-w22-q1',
        subject: 'Toán',
        content:
          'Buổi sáng một cửa hàng bán 125 kg gạo, buổi chiều bán gấp 2 lần buổi sáng. Hỏi cả ngày cửa hàng bán bao nhiêu ki-lô-gam gạo?',
        options: ['250 kg', '325 kg', '375 kg', '500 kg'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Buổi chiều: 125 × 2 = 250 (kg). Cả ngày: 125 + 250 = 375 (kg).',
      },
      {
        id: 'toan-w22-q2',
        subject: 'Toán',
        content:
          'Lớp 3A có 32 bạn, chia đều thành 4 nhóm. Hỏi 3 nhóm có bao nhiêu bạn?',
        options: ['8 bạn', '12 bạn', '24 bạn', '28 bạn'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Mỗi nhóm: 32 : 4 = 8 (bạn). Ba nhóm: 8 × 3 = 24 (bạn).',
      },
      {
        id: 'toan-w22-q3',
        subject: 'Toán',
        content:
          'Có 45 quả cam, đã bán 15 quả. Số cam còn lại xếp đều vào 6 túi. Hỏi mỗi túi có bao nhiêu quả cam?',
        options: ['5 quả', '6 quả', '7 quả', '30 quả'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: 'Còn lại: 45 − 15 = 30 (quả). Mỗi túi: 30 : 6 = 5 (quả).',
      },
    ],
  },
  {
    weekNumber: 23,
    unit: UNIT_4,
    title: 'Xem đồng hồ, tháng và năm',
    difficulty: 3,
    questions: [
      {
        id: 'toan-18',
        subject: 'Toán',
        content: '1 giờ có bao nhiêu phút?',
        options: ['24 phút', '30 phút', '60 phút', '100 phút'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: '1 giờ = 60 phút.',
      },
      {
        id: 'toan-w23-q1',
        subject: 'Toán',
        content: 'Một năm có bao nhiêu tháng?',
        options: ['10 tháng', '11 tháng', '12 tháng', '24 tháng'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Một năm có 12 tháng, từ tháng 1 đến tháng 12.',
      },
      {
        id: 'toan-w23-q2',
        subject: 'Toán',
        content: 'Tháng 2 của năm không nhuận có bao nhiêu ngày?',
        options: ['28 ngày', '29 ngày', '30 ngày', '31 ngày'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: 'Năm không nhuận thì tháng 2 có 28 ngày; năm nhuận có 29 ngày.',
      },
    ],
  },
  {
    weekNumber: 24,
    unit: UNIT_4,
    title: 'Số La Mã',
    difficulty: 3,
    questions: [
      {
        id: 'toan-17',
        subject: 'Toán',
        content: 'Số La Mã VIII đọc là số nào?',
        options: ['6', '13', '7', '8'],
        correctAnswer: 3,
        rewardMinutes: 3,
        explanation: 'V là 5, thêm III là 3 nữa: 5 + 3 = 8.',
      },
      {
        id: 'toan-w24-q1',
        subject: 'Toán',
        content: 'Số 12 viết bằng số La Mã là gì?',
        options: ['IIX', 'XII', 'XX', 'VII'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: 'X là 10, thêm II là 2 nữa: XII = 12.',
      },
      {
        id: 'toan-w24-q2',
        subject: 'Toán',
        content: 'Số La Mã IV đọc là số nào?',
        options: ['6', '4', '5', '9'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: 'I đứng trước V nghĩa là bớt 1 khỏi 5: IV = 4.',
      },
    ],
  },
  {
    weekNumber: 25,
    unit: UNIT_4,
    title: 'Ôn tập giữa học kì 2',
    difficulty: 3,
    questions: [
      {
        id: 'toan-w25-q1',
        subject: 'Toán',
        content: 'Tính: 306 × 3 = ?',
        options: ['908', '918', '928', '819'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '6 × 3 = 18 (viết 8 nhớ 1); 0 × 3 = 0, thêm 1 được 1; 3 × 3 = 9. Kết quả 918.',
      },
      {
        id: 'toan-w25-q2',
        subject: 'Toán',
        content: 'Tính: 480 : 6 = ?',
        options: ['8', '70', '80', '90'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: '480 : 6 = 80, thử lại 80 × 6 = 480.',
      },
      {
        id: 'toan-w25-q3',
        subject: 'Toán',
        content: 'Tìm x, biết: x − 128 = 372',
        options: ['244', '490', '500', '510'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Muốn tìm số bị trừ thì lấy hiệu cộng số trừ: x = 372 + 128 = 500.',
      },
    ],
  },

  /* ============ GIAI ĐOẠN 5: TUẦN 26-35 ============ */
  {
    weekNumber: 26,
    unit: UNIT_5,
    title: 'Các số trong phạm vi 100 000',
    difficulty: 3,
    questions: [
      {
        id: 'toan-w26-q1',
        subject: 'Toán',
        content: 'Số 45 302 đọc như thế nào?',
        options: [
          'Bốn mươi lăm nghìn ba trăm linh hai',
          'Bốn mươi lăm nghìn ba trăm hai mươi',
          'Bốn nghìn năm trăm ba mươi hai',
          'Bốn mươi lăm nghìn ba trăm hai',
        ],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: 'Hàng chục là 0 nên đọc "linh": bốn mươi lăm nghìn ba trăm linh hai.',
      },
      {
        id: 'toan-w26-q2',
        subject: 'Toán',
        content:
          'Số gồm 6 chục nghìn, 2 nghìn, 0 trăm, 5 chục và 3 đơn vị được viết là số nào?',
        options: ['62 053', '62 503', '60 253', '6253'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: 'Viết lần lượt theo hàng: 6 − 2 − 0 − 5 − 3, được 62 053.',
      },
      {
        id: 'toan-w26-q3',
        subject: 'Toán',
        content: 'Số lớn nhất có năm chữ số là số nào?',
        options: ['10 000', '99 990', '99 999', '100 000'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Cả năm chữ số đều là 9 nên số đó là 99 999.',
      },
    ],
  },
  {
    weekNumber: 27,
    unit: UNIT_5,
    title: 'So sánh các số trong phạm vi 100 000',
    difficulty: 3,
    questions: [
      {
        id: 'toan-w27-q1',
        subject: 'Toán',
        content: 'Điền dấu thích hợp: 45 678 ... 45 687',
        options: ['>', '<', '=', 'Không so sánh được'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation:
          'Ba chữ số đầu giống nhau (4, 5, 6). So hàng chục: 7 < 8 nên 45 678 < 45 687.',
      },
      {
        id: 'toan-w27-q2',
        subject: 'Toán',
        content: 'Trong các số 32 100; 32 010; 32 001; 31 999 số nào lớn nhất?',
        options: ['32 100', '32 010', '32 001', '31 999'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: 'So từ hàng cao nhất xuống, 32 100 có hàng trăm là 1 lớn nhất.',
      },
      {
        id: 'toan-w27-q3',
        subject: 'Toán',
        content:
          'Sắp xếp các số 8900; 9800; 8090; 9080 theo thứ tự từ bé đến lớn thì số đứng đầu là số nào?',
        options: ['8900', '9800', '8090', '9080'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Số bé nhất là 8090 (thứ tự đúng: 8090 < 8900 < 9080 < 9800).',
      },
    ],
  },
  {
    weekNumber: 28,
    unit: UNIT_5,
    title: 'Phép cộng, phép trừ trong phạm vi 100 000',
    difficulty: 3,
    questions: [
      {
        id: 'toan-w28-q1',
        subject: 'Toán',
        content: 'Tính: 23 456 + 12 344 = ?',
        options: ['35 700', '35 800', '35 900', '34 800'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '23 456 + 12 344 = 35 800.',
      },
      {
        id: 'toan-w28-q2',
        subject: 'Toán',
        content: 'Tính: 50 000 − 27 500 = ?',
        options: ['22 500', '23 500', '32 500', '22 400'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: '50 000 − 27 500 = 22 500, thử lại 22 500 + 27 500 = 50 000.',
      },
      {
        id: 'toan-w28-q3',
        subject: 'Toán',
        content:
          'Một nhà máy sản xuất được 34 500 sản phẩm, đã xuất bán 12 700 sản phẩm. Hỏi còn lại bao nhiêu sản phẩm?',
        options: ['21 800', '22 800', '21 700', '47 200'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: '34 500 − 12 700 = 21 800 (sản phẩm).',
      },
    ],
  },
  {
    weekNumber: 29,
    unit: UNIT_5,
    title: 'Diện tích của một hình, xăng-ti-mét vuông',
    difficulty: 3,
    questions: [
      {
        id: 'toan-w29-q1',
        subject: 'Toán',
        content: 'Đơn vị đo diện tích em học ở Lớp 3 là đơn vị nào?',
        options: ['cm', 'cm²', 'ml', 'kg'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: 'cm² (xăng-ti-mét vuông) là đơn vị đo diện tích; cm đo độ dài.',
      },
      {
        id: 'toan-10',
        subject: 'Toán',
        content:
          'Một hình chữ nhật có chiều dài 8 cm, chiều rộng 5 cm. Diện tích hình đó là bao nhiêu?',
        options: ['13 cm²', '26 cm²', '40 cm²', '80 cm²'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Diện tích = dài × rộng = 8 × 5 = 40 (cm²).',
      },
      {
        id: 'toan-w29-q2',
        subject: 'Toán',
        content:
          'Một hình được ghép từ 12 ô vuông, mỗi ô vuông có diện tích 1 cm². Diện tích hình đó là bao nhiêu?',
        options: ['6 cm²', '12 cm²', '24 cm²', '144 cm²'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '12 ô vuông, mỗi ô 1 cm² nên diện tích là 12 cm².',
      },
    ],
  },
  {
    weekNumber: 30,
    unit: UNIT_5,
    title: 'Chu vi và diện tích hình chữ nhật',
    difficulty: 3,
    questions: [
      {
        id: 'toan-11',
        subject: 'Toán',
        content:
          'Một hình chữ nhật có chiều dài 9 cm, chiều rộng 4 cm. Chu vi hình đó là bao nhiêu?',
        options: ['26 cm', '13 cm', '22 cm', '36 cm'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: 'Chu vi = (dài + rộng) × 2 = (9 + 4) × 2 = 26 (cm).',
      },
      {
        id: 'toan-w30-q1',
        subject: 'Toán',
        content:
          'Một hình chữ nhật có chiều dài 12 cm, chiều rộng 5 cm. Diện tích hình đó là bao nhiêu?',
        options: ['17 cm²', '34 cm²', '60 cm²', '120 cm²'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Diện tích = dài × rộng = 12 × 5 = 60 (cm²).',
      },
      {
        id: 'toan-w30-q2',
        subject: 'Toán',
        content: 'Muốn tính chu vi hình chữ nhật em làm thế nào?',
        options: [
          'Lấy dài nhân rộng',
          'Lấy (dài + rộng) nhân 2',
          'Lấy dài cộng rộng',
          'Lấy dài nhân 4',
        ],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: 'Chu vi hình chữ nhật = (chiều dài + chiều rộng) × 2.',
      },
    ],
  },
  {
    weekNumber: 31,
    unit: UNIT_5,
    title: 'Chu vi và diện tích hình vuông',
    difficulty: 3,
    questions: [
      {
        id: 'toan-03',
        subject: 'Toán',
        content: 'Một hình vuông có cạnh 6 cm. Chu vi hình vuông đó là bao nhiêu?',
        options: ['12 cm', '18 cm', '24 cm', '36 cm'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Chu vi hình vuông = cạnh × 4 = 6 × 4 = 24 (cm).',
      },
      {
        id: 'toan-w31-q1',
        subject: 'Toán',
        content: 'Một hình vuông có cạnh 7 cm. Diện tích hình vuông đó là bao nhiêu?',
        options: ['14 cm²', '28 cm²', '49 cm²', '77 cm²'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Diện tích hình vuông = cạnh × cạnh = 7 × 7 = 49 (cm²).',
      },
      {
        id: 'toan-w31-q2',
        subject: 'Toán',
        content: 'Chu vi một hình vuông bằng 20 cm. Cạnh hình vuông đó dài bao nhiêu?',
        options: ['4 cm', '5 cm', '10 cm', '80 cm'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: 'Cạnh = chu vi : 4 = 20 : 4 = 5 (cm).',
      },
    ],
  },
  {
    weekNumber: 32,
    unit: UNIT_5,
    title: 'Phép nhân, phép chia trong phạm vi 100 000',
    difficulty: 3,
    questions: [
      {
        id: 'toan-w32-q1',
        subject: 'Toán',
        content: 'Tính: 12 345 × 2 = ?',
        options: ['24 680', '24 690', '24 590', '22 690'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '12 345 × 2 = 24 690.',
      },
      {
        id: 'toan-w32-q2',
        subject: 'Toán',
        content: 'Tính: 36 000 : 6 = ?',
        options: ['600', '6000', '60 000', '5000'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '36 nghìn chia 6 được 6 nghìn: 36 000 : 6 = 6000.',
      },
      {
        id: 'toan-w32-q3',
        subject: 'Toán',
        content: 'Tính: 10 250 × 4 = ?',
        options: ['40 100', '41 000', '41 200', '40 000'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: '10 250 × 4 = 41 000.',
      },
    ],
  },
  {
    weekNumber: 33,
    unit: UNIT_5,
    title: 'Thu thập, phân loại và kiểm đếm số liệu',
    difficulty: 3,
    questions: [
      {
        id: 'toan-w33-q1',
        subject: 'Toán',
        content:
          'Bảng kiểm đếm màu yêu thích ghi: Đỏ ||||, Xanh ||, Vàng |||. Màu nào được chọn nhiều nhất?',
        options: ['Màu đỏ', 'Màu xanh', 'Màu vàng', 'Ba màu bằng nhau'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: 'Đỏ có 4 vạch, vàng 3 vạch, xanh 2 vạch. Nhiều nhất là màu đỏ.',
      },
      {
        id: 'toan-w33-q2',
        subject: 'Toán',
        content:
          'Có 3 bạn thích môn Toán, 5 bạn thích Tiếng Việt và 2 bạn thích Tiếng Anh. Hỏi tổng số bạn được hỏi là bao nhiêu?',
        options: ['8 bạn', '9 bạn', '10 bạn', '11 bạn'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: '3 + 5 + 2 = 10 (bạn).',
      },
      {
        id: 'toan-w33-q3',
        subject: 'Toán',
        content: 'Để ghi lại số lần xuất hiện của mỗi loại khi kiểm đếm, người ta dùng gì?',
        options: ['Vạch kiểm đếm', 'Thước kẻ', 'Com-pa', 'Ê-ke'],
        correctAnswer: 0,
        rewardMinutes: 3,
        explanation: 'Mỗi lần xuất hiện ghi một vạch kiểm đếm, đếm vạch là biết số lượng.',
      },
    ],
  },
  {
    weekNumber: 34,
    unit: UNIT_5,
    title: 'Ôn tập cuối năm — số và phép tính',
    difficulty: 3,
    questions: [
      {
        id: 'toan-w34-q1',
        subject: 'Toán',
        content: 'Tính giá trị của biểu thức: 25 × 4 − 30',
        options: ['40', '70', '80', '130'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: 'Nhân trước: 25 × 4 = 100, rồi 100 − 30 = 70.',
      },
      {
        id: 'toan-w34-q2',
        subject: 'Toán',
        content: 'Tìm x, biết: x × 5 = 4500',
        options: ['90', '900', '9000', '4495'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: 'x = 4500 : 5 = 900.',
      },
      {
        id: 'toan-w34-q3',
        subject: 'Toán',
        content: 'Tính giá trị của biểu thức: (2400 + 600) : 3',
        options: ['800', '1000', '2600', '3000'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: 'Trong ngoặc trước: 2400 + 600 = 3000, rồi 3000 : 3 = 1000.',
      },
    ],
  },
  {
    weekNumber: 35,
    unit: UNIT_5,
    title: 'Ôn tập cuối năm — hình học và đo lường',
    difficulty: 3,
    questions: [
      {
        id: 'toan-w35-q1',
        subject: 'Toán',
        content: 'Một hình vuông có cạnh 9 cm. Chu vi hình vuông đó là bao nhiêu?',
        options: ['18 cm', '27 cm', '36 cm', '81 cm'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: 'Chu vi hình vuông = cạnh × 4 = 9 × 4 = 36 (cm).',
      },
      {
        id: 'toan-w35-q2',
        subject: 'Toán',
        content: 'Điền số thích hợp: 5 km = ... m',
        options: ['50', '500', '5000', '50 000'],
        correctAnswer: 2,
        rewardMinutes: 3,
        explanation: '1 km = 1000 m nên 5 km = 5 × 1000 = 5000 (m).',
      },
      {
        id: 'toan-w35-q3',
        subject: 'Toán',
        content:
          'Một hình chữ nhật có diện tích 24 cm² và chiều rộng 4 cm. Chiều dài hình đó là bao nhiêu?',
        options: ['4 cm', '6 cm', '8 cm', '20 cm'],
        correctAnswer: 1,
        rewardMinutes: 3,
        explanation: 'Chiều dài = diện tích : chiều rộng = 24 : 4 = 6 (cm).',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Hàm truy vấn                                                        */
/* ------------------------------------------------------------------ */

/** Lấy thông tin một tuần theo số tuần */
export function getWeek(weekNumber: number): WeekTopic | undefined {
  return MATH_WEEKS.find((week) => week.weekNumber === weekNumber);
}

/** Lấy danh sách câu hỏi của một tuần */
export function getWeekQuestions(weekNumber: number): Question[] {
  return getWeek(weekNumber)?.questions ?? [];
}

/** Toàn bộ câu hỏi Toán của cả lộ trình */
export const MATH_QUESTIONS: Question[] = MATH_WEEKS.flatMap((week) => week.questions);

/**
 * Trạng thái của một tuần dựa trên tuần cao nhất học sinh đã vượt qua.
 * Tuần kế tiếp luôn được mở để học sinh có thể học tiếp.
 */
export function weekStatus(weekNumber: number, highestCompletedWeek: number): WeekStatus {
  if (weekNumber <= highestCompletedWeek) return 'completed';
  if (weekNumber === highestCompletedWeek + 1) return 'current';
  return 'locked';
}

/** Danh sách các giai đoạn lớn, kèm khoảng tuần, để hiển thị theo nhóm */
export function getUnits(): { unit: string; from: number; to: number }[] {
  const units: { unit: string; from: number; to: number }[] = [];
  for (const week of MATH_WEEKS) {
    const last = units[units.length - 1];
    if (last && last.unit === week.unit) {
      last.to = week.weekNumber;
    } else {
      units.push({ unit: week.unit, from: week.weekNumber, to: week.weekNumber });
    }
  }
  return units;
}
