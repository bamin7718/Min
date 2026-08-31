import type { Question, Subject, SubjectInfo } from '../types';
import { colors } from './theme';

/** Điểm thưởng cho mỗi câu trả lời đúng */
export const POINTS_PER_CORRECT = 10;

/**
 * Số câu mỗi lượt làm bài. Bộ câu hỏi có 20 câu/môn nhưng học sinh Lớp 3 không
 * nên làm liền 20 câu, nên mỗi lượt chỉ rút ngẫu nhiên một phần.
 */
export const QUESTIONS_PER_QUIZ = 6;

/**
 * Câu đã từng trả lời đúng thì lần sau chỉ cộng điểm, không cộng thêm phút chơi game.
 * Đổi thành `true` nếu muốn cộng phút mỗi lần trả lời đúng (kể cả làm lại).
 */
export const REPEAT_ANSWER_GIVES_MINUTES = false;

/** Mã PIN mặc định của phụ huynh */
export const DEFAULT_PARENT_PIN = '1234';

/** Các mốc phút phụ huynh có thể cấp thêm nhanh */
export const PARENT_GRANT_OPTIONS = [5, 10, 15, 30] as const;

/** Trần thời gian chơi game tích luỹ (phút) để tránh dồn quá nhiều */
export const MAX_ACCUMULATED_MINUTES = 120;

/** Thông tin hiển thị của từng môn học */
export const SUBJECTS: SubjectInfo[] = [
  {
    key: 'Toán',
    emoji: '🔢',
    description: 'Nhân chia, giải toán có lời văn, hình học và đơn vị đo',
    color: colors.primary,
    softColor: colors.primarySoft,
  },
  {
    key: 'Tiếng Việt',
    emoji: '📖',
    description: 'Chính tả, từ loại, mẫu câu, so sánh và nhân hoá',
    color: colors.success,
    softColor: colors.successSoft,
  },
  {
    key: 'Tiếng Anh',
    emoji: '🌏',
    description: 'Từ vựng và câu giao tiếp đơn giản',
    color: colors.purple,
    softColor: colors.purpleSoft,
  },
];

/**
 * Bộ câu hỏi trắc nghiệm kiến thức Lớp 3 — 20 câu mỗi môn.
 *
 * LƯU Ý: không đổi `id` của câu đã có, vì `masteredQuestionIds` lưu trong
 * AsyncStorage/Supabase tham chiếu tới các id này.
 */
export const QUESTIONS: Question[] = [
  /* ==================== TOÁN ==================== */
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
    id: 'toan-02',
    subject: 'Toán',
    content:
      'Một cửa hàng có 245 kg gạo, đã bán 128 kg. Hỏi cửa hàng còn lại bao nhiêu kg gạo?',
    options: ['113 kg', '117 kg', '123 kg', '127 kg'],
    correctAnswer: 1,
    rewardMinutes: 3,
    explanation: '245 − 128 = 117 (kg).',
  },
  {
    id: 'toan-03',
    subject: 'Toán',
    content: 'Một hình vuông có cạnh 6 cm. Chu vi hình vuông đó là bao nhiêu?',
    options: ['12 cm', '18 cm', '24 cm', '36 cm'],
    correctAnswer: 2,
    rewardMinutes: 2,
    explanation: 'Chu vi hình vuông = cạnh × 4 = 6 × 4 = 24 (cm).',
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
    id: 'toan-06',
    subject: 'Toán',
    content: 'Tính 1234 + 2345 = ?',
    options: ['3479', '3589', '3679', '3579'],
    correctAnswer: 3,
    rewardMinutes: 3,
    explanation: '1234 + 2345 = 3579. Em cộng lần lượt từ hàng đơn vị nhé.',
  },
  {
    id: 'toan-07',
    subject: 'Toán',
    content: 'Số lớn nhất có ba chữ số khác nhau là số nào?',
    options: ['789', '987', '999', '978'],
    correctAnswer: 1,
    rewardMinutes: 3,
    explanation:
      '987 — chọn chữ số lớn nhất cho hàng trăm, rồi lần lượt các chữ số lớn tiếp theo. 999 có ba chữ số giống nhau nên không hợp lệ.',
  },
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
    id: 'toan-09',
    subject: 'Toán',
    content: 'Tìm x, biết: x × 4 = 32',
    options: ['6', '7', '9', '8'],
    correctAnswer: 3,
    rewardMinutes: 3,
    explanation: 'x = 32 : 4 = 8.',
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
    id: 'toan-12',
    subject: 'Toán',
    content: 'Một phần tư (1/4) của 20 là bao nhiêu?',
    options: ['4', '5', '6', '80'],
    correctAnswer: 1,
    rewardMinutes: 2,
    explanation: 'Muốn tìm 1/4 của 20 thì lấy 20 : 4 = 5.',
  },
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
    id: 'toan-15',
    subject: 'Toán',
    content: '1 m bằng bao nhiêu xăng-ti-mét?',
    options: ['1000 cm', '10 cm', '100 cm', '60 cm'],
    correctAnswer: 2,
    rewardMinutes: 2,
    explanation: '1 m = 100 cm.',
  },
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
    id: 'toan-17',
    subject: 'Toán',
    content: 'Số La Mã VIII đọc là số nào?',
    options: ['6', '13', '7', '8'],
    correctAnswer: 3,
    rewardMinutes: 2,
    explanation: 'V là 5, thêm III là 3 nữa: 5 + 3 = 8.',
  },
  {
    id: 'toan-18',
    subject: 'Toán',
    content: '1 giờ có bao nhiêu phút?',
    options: ['24 phút', '30 phút', '60 phút', '100 phút'],
    correctAnswer: 2,
    rewardMinutes: 2,
    explanation: '1 giờ = 60 phút.',
  },
  {
    id: 'toan-19',
    subject: 'Toán',
    content:
      'Lan có 8 cái kẹo. Hùng có nhiều hơn Lan 5 cái kẹo. Hỏi Hùng có bao nhiêu cái kẹo?',
    options: ['13 cái', '3 cái', '40 cái', '12 cái'],
    correctAnswer: 0,
    rewardMinutes: 3,
    explanation: '"Nhiều hơn" thì làm phép cộng: 8 + 5 = 13 (cái).',
  },
  {
    id: 'toan-20',
    subject: 'Toán',
    content:
      'Một thùng có 6 hộp bánh, mỗi hộp có 8 chiếc bánh. Hỏi thùng đó có bao nhiêu chiếc bánh?',
    options: ['14 chiếc', '48 chiếc', '42 chiếc', '68 chiếc'],
    correctAnswer: 1,
    rewardMinutes: 3,
    explanation: '6 hộp, mỗi hộp 8 chiếc: 6 × 8 = 48 (chiếc).',
  },

  /* ==================== TIẾNG VIỆT ==================== */
  {
    id: 'tv-01',
    subject: 'Tiếng Việt',
    content: 'Từ nào dưới đây là từ chỉ hoạt động?',
    options: ['bàn ghế', 'chạy nhảy', 'xinh đẹp', 'con mèo'],
    correctAnswer: 1,
    rewardMinutes: 2,
    explanation:
      '"chạy nhảy" chỉ hoạt động. "bàn ghế", "con mèo" chỉ sự vật; "xinh đẹp" chỉ đặc điểm.',
  },
  {
    id: 'tv-02',
    subject: 'Tiếng Việt',
    content: 'Từ nào dưới đây viết ĐÚNG chính tả?',
    options: ['xanh xao', 'sanh sao', 'xanh sao', 'sanh xao'],
    correctAnswer: 0,
    rewardMinutes: 2,
    explanation: 'Viết đúng là "xanh xao" (cả hai tiếng đều bắt đầu bằng "x").',
  },
  {
    id: 'tv-03',
    subject: 'Tiếng Việt',
    content: 'Câu "Bạn Lan đang tưới cây." thuộc mẫu câu nào?',
    options: ['Ai là gì?', 'Ai làm gì?', 'Ai thế nào?', 'Ở đâu?'],
    correctAnswer: 1,
    rewardMinutes: 3,
    explanation:
      '"Bạn Lan" trả lời cho câu hỏi "Ai?", "đang tưới cây" trả lời cho "làm gì?".',
  },
  {
    id: 'tv-04',
    subject: 'Tiếng Việt',
    content: 'Từ nào TRÁI NGHĨA với từ "siêng năng"?',
    options: ['chăm chỉ', 'cần mẫn', 'lười biếng', 'nhanh nhẹn'],
    correctAnswer: 2,
    rewardMinutes: 2,
    explanation:
      '"lười biếng" trái nghĩa với "siêng năng". "chăm chỉ" và "cần mẫn" lại cùng nghĩa.',
  },
  {
    id: 'tv-05',
    subject: 'Tiếng Việt',
    content: 'Từ nào dưới đây là từ chỉ đặc điểm?',
    options: ['học sinh', 'tròn xoe', 'đọc sách', 'cái bút'],
    correctAnswer: 1,
    rewardMinutes: 2,
    explanation:
      '"tròn xoe" chỉ đặc điểm (hình dáng). "học sinh", "cái bút" chỉ sự vật; "đọc sách" chỉ hoạt động.',
  },
  {
    id: 'tv-06',
    subject: 'Tiếng Việt',
    content: 'Từ nào dưới đây là từ chỉ sự vật?',
    options: ['viết bài', 'xanh tươi', 'chạy nhanh', 'quyển vở'],
    correctAnswer: 3,
    rewardMinutes: 2,
    explanation: '"quyển vở" là đồ vật nên là từ chỉ sự vật.',
  },
  {
    id: 'tv-07',
    subject: 'Tiếng Việt',
    content: 'Câu "Mẹ em là giáo viên." thuộc mẫu câu nào?',
    options: ['Ai là gì?', 'Ai làm gì?', 'Ai thế nào?', 'Ở đâu?'],
    correctAnswer: 0,
    rewardMinutes: 2,
    explanation: 'Có từ "là" và giới thiệu về nghề nghiệp nên thuộc mẫu "Ai là gì?".',
  },
  {
    id: 'tv-08',
    subject: 'Tiếng Việt',
    content: 'Câu "Bầu trời rất trong xanh." thuộc mẫu câu nào?',
    options: ['Ai làm gì?', 'Ai là gì?', 'Ai thế nào?', 'Khi nào?'],
    correctAnswer: 2,
    rewardMinutes: 2,
    explanation:
      '"rất trong xanh" nói về đặc điểm của bầu trời nên thuộc mẫu "Ai thế nào?".',
  },
  {
    id: 'tv-09',
    subject: 'Tiếng Việt',
    content: 'Từ nào dưới đây viết ĐÚNG chính tả?',
    options: ['no lắng', 'lo nắng', 'lo lắng', 'no nắng'],
    correctAnswer: 2,
    rewardMinutes: 2,
    explanation: 'Viết đúng là "lo lắng" — cả hai tiếng đều bắt đầu bằng "l".',
  },
  {
    id: 'tv-10',
    subject: 'Tiếng Việt',
    content: 'Từ nào dưới đây viết ĐÚNG chính tả?',
    options: ['che chở', 'tre chở', 'che trở', 'tre trở'],
    correctAnswer: 0,
    rewardMinutes: 2,
    explanation: 'Viết đúng là "che chở" (nghĩa là bảo vệ, giúp đỡ).',
  },
  {
    id: 'tv-11',
    subject: 'Tiếng Việt',
    content: 'Từ nào dưới đây viết ĐÚNG chính tả?',
    options: ['suy nghỉ', 'suy nghĩ', 'suy nghi', 'suy nghịt'],
    correctAnswer: 1,
    rewardMinutes: 3,
    explanation: 'Viết đúng là "suy nghĩ" (dấu ngã). "nghỉ" (dấu hỏi) là nghỉ ngơi.',
  },
  {
    id: 'tv-12',
    subject: 'Tiếng Việt',
    content:
      'Trong câu "Mắt em bé sáng như ngôi sao.", sự vật nào được so sánh với ngôi sao?',
    options: ['em bé', 'ngôi sao', 'ánh sáng', 'mắt em bé'],
    correctAnswer: 3,
    rewardMinutes: 3,
    explanation:
      '"Mắt em bé" được so sánh với "ngôi sao" qua từ so sánh "như".',
  },
  {
    id: 'tv-13',
    subject: 'Tiếng Việt',
    content: 'Câu nào dưới đây có dùng biện pháp NHÂN HOÁ?',
    options: [
      'Trời rất tối.',
      'Mây có màu xám.',
      'Ông trời mặc áo giáp đen ra trận.',
      'Mưa rơi rất to.',
    ],
    correctAnswer: 2,
    rewardMinutes: 3,
    explanation:
      'Trời được gọi là "ông" và biết "mặc áo giáp ra trận" như người — đó là nhân hoá.',
  },
  {
    id: 'tv-14',
    subject: 'Tiếng Việt',
    content: 'Cuối câu kể "Em rất thích đọc truyện" cần đặt dấu câu nào?',
    options: ['dấu chấm', 'dấu chấm hỏi', 'dấu chấm than', 'dấu phẩy'],
    correctAnswer: 0,
    rewardMinutes: 2,
    explanation: 'Câu kể thì kết thúc bằng dấu chấm.',
  },
  {
    id: 'tv-15',
    subject: 'Tiếng Việt',
    content: 'Câu "Vì trời mưa nên em không đi chơi." trả lời cho câu hỏi nào?',
    options: ['Ở đâu?', 'Khi nào?', 'Bằng gì?', 'Vì sao?'],
    correctAnswer: 3,
    rewardMinutes: 3,
    explanation: 'Bộ phận "Vì trời mưa" nêu lí do nên trả lời cho câu hỏi "Vì sao?".',
  },
  {
    id: 'tv-16',
    subject: 'Tiếng Việt',
    content: 'Từ nào dưới đây CÙNG NGHĨA với từ "to"?',
    options: ['nhỏ', 'bé', 'lớn', 'thấp'],
    correctAnswer: 2,
    rewardMinutes: 2,
    explanation: '"lớn" cùng nghĩa với "to". "nhỏ" và "bé" là trái nghĩa.',
  },
  {
    id: 'tv-17',
    subject: 'Tiếng Việt',
    content:
      'Trong câu "Các bạn học sinh chơi bóng ở sân trường.", bộ phận nào trả lời cho câu hỏi "Ở đâu?"',
    options: ['Các bạn học sinh', 'ở sân trường', 'chơi bóng', 'bóng'],
    correctAnswer: 1,
    rewardMinutes: 3,
    explanation: '"ở sân trường" chỉ địa điểm nên trả lời cho câu hỏi "Ở đâu?".',
  },
  {
    id: 'tv-18',
    subject: 'Tiếng Việt',
    content: 'Từ nào dưới đây viết ĐÚNG chính tả?',
    options: ['dúp đỡ', 'giúp đở', 'giúp đỡ', 'rúp đỡ'],
    correctAnswer: 2,
    rewardMinutes: 2,
    explanation: 'Viết đúng là "giúp đỡ" — "gi" và dấu ngã ở tiếng "đỡ".',
  },
  {
    id: 'tv-19',
    subject: 'Tiếng Việt',
    content: 'Từ nào KHÔNG cùng nhóm với các từ còn lại?',
    options: ['bàn', 'ghế', 'chạy', 'tủ'],
    correctAnswer: 2,
    rewardMinutes: 2,
    explanation:
      '"bàn", "ghế", "tủ" đều chỉ đồ vật; còn "chạy" chỉ hoạt động nên khác nhóm.',
  },
  {
    id: 'tv-20',
    subject: 'Tiếng Việt',
    content:
      'Trong câu: Bạn Nam nói: "Mình rất thích môn Toán." — dấu hai chấm dùng để làm gì?',
    options: [
      'báo hiệu lời nói của nhân vật',
      'kết thúc câu kể',
      'ngăn cách các từ cùng loại',
      'dùng để hỏi',
    ],
    correctAnswer: 0,
    rewardMinutes: 3,
    explanation: 'Dấu hai chấm ở đây báo hiệu phần tiếp theo là lời nói của bạn Nam.',
  },

  /* ==================== TIẾNG ANH ==================== */
  {
    id: 'ta-01',
    subject: 'Tiếng Anh',
    content: 'Chọn từ đúng: "My mother is a ____. She teaches at school."',
    options: ['doctor', 'teacher', 'farmer', 'driver'],
    correctAnswer: 1,
    rewardMinutes: 2,
    explanation: '"teacher" nghĩa là giáo viên — người dạy học ở trường.',
  },
  {
    id: 'ta-02',
    subject: 'Tiếng Anh',
    content: '"Con mèo" trong tiếng Anh là từ nào?',
    options: ['dog', 'cat', 'bird', 'fish'],
    correctAnswer: 1,
    rewardMinutes: 2,
    explanation: '"cat" là con mèo, "dog" là con chó.',
  },
  {
    id: 'ta-03',
    subject: 'Tiếng Anh',
    content: 'Buổi sáng gặp cô giáo, em chào như thế nào?',
    options: ['Good night!', 'Good morning!', 'Goodbye!', 'Good evening!'],
    correctAnswer: 1,
    rewardMinutes: 3,
    explanation: '"Good morning!" là lời chào vào buổi sáng.',
  },
  {
    id: 'ta-04',
    subject: 'Tiếng Anh',
    content: 'Bạn hỏi: "How old are you?" — em trả lời thế nào?',
    options: [
      "I'm fine, thank you.",
      'My name is Nam.',
      "I'm eight years old.",
      "It's a cat.",
    ],
    correctAnswer: 2,
    rewardMinutes: 3,
    explanation: '"How old are you?" là hỏi tuổi, nên trả lời bằng số tuổi.',
  },
  {
    id: 'ta-05',
    subject: 'Tiếng Anh',
    content: 'Bạn hỏi: "What\'s your name?" — em trả lời thế nào?',
    options: ['My name is Mai.', "I'm nine.", 'Yes, I am.', 'Good morning.'],
    correctAnswer: 0,
    rewardMinutes: 2,
    explanation: '"What\'s your name?" là hỏi tên, nên trả lời "My name is...".',
  },
  {
    id: 'ta-06',
    subject: 'Tiếng Anh',
    content: '"Con chó" trong tiếng Anh là từ nào?',
    options: ['cat', 'bird', 'fish', 'dog'],
    correctAnswer: 3,
    rewardMinutes: 2,
    explanation: '"dog" là con chó.',
  },
  {
    id: 'ta-07',
    subject: 'Tiếng Anh',
    content: 'Màu đỏ trong tiếng Anh là từ nào?',
    options: ['red', 'blue', 'green', 'yellow'],
    correctAnswer: 0,
    rewardMinutes: 2,
    explanation: '"red" là màu đỏ, "blue" là màu xanh dương.',
  },
  {
    id: 'ta-08',
    subject: 'Tiếng Anh',
    content: 'Số 7 trong tiếng Anh là từ nào?',
    options: ['six', 'eight', 'seven', 'nine'],
    correctAnswer: 2,
    rewardMinutes: 2,
    explanation: '"seven" là số 7.',
  },
  {
    id: 'ta-09',
    subject: 'Tiếng Anh',
    content: 'Chọn từ đúng: "This is my ____. He is my father\'s father."',
    options: ['brother', 'uncle', 'grandfather', 'sister'],
    correctAnswer: 2,
    rewardMinutes: 3,
    explanation: 'Bố của bố em chính là ông — "grandfather".',
  },
  {
    id: 'ta-10',
    subject: 'Tiếng Anh',
    content: '"Cái bút chì" trong tiếng Anh là từ nào?',
    options: ['pencil', 'pen', 'book', 'ruler'],
    correctAnswer: 0,
    rewardMinutes: 2,
    explanation: '"pencil" là bút chì, "pen" là bút mực.',
  },
  {
    id: 'ta-11',
    subject: 'Tiếng Anh',
    content: '"Goodbye!" có nghĩa là gì?',
    options: ['Xin chào!', 'Cảm ơn!', 'Xin lỗi!', 'Tạm biệt!'],
    correctAnswer: 3,
    rewardMinutes: 2,
    explanation: '"Goodbye!" là lời chào khi chia tay — "Tạm biệt!".',
  },
  {
    id: 'ta-12',
    subject: 'Tiếng Anh',
    content: 'Chọn từ đúng: "I have ____ books." (em có 3 quyển sách)',
    options: ['three', 'tree', 'thirty', 'third'],
    correctAnswer: 0,
    rewardMinutes: 3,
    explanation: '"three" là số 3. "tree" là cái cây, "thirty" là 30.',
  },
  {
    id: 'ta-13',
    subject: 'Tiếng Anh',
    content: 'Cô giáo nói "Sit down, please." — nghĩa là gì?',
    options: [
      'Mời em đứng lên.',
      'Mời em đọc bài.',
      'Mời em ngồi xuống.',
      'Mời em ra ngoài.',
    ],
    correctAnswer: 2,
    rewardMinutes: 2,
    explanation: '"Sit down" là ngồi xuống, "Stand up" là đứng lên.',
  },
  {
    id: 'ta-14',
    subject: 'Tiếng Anh',
    content: 'Muốn nói "Cảm ơn" bằng tiếng Anh, em nói gì?',
    options: ['Sorry.', 'Hello.', 'Goodbye.', 'Thank you.'],
    correctAnswer: 3,
    rewardMinutes: 2,
    explanation: '"Thank you." nghĩa là "Cảm ơn".',
  },
  {
    id: 'ta-15',
    subject: 'Tiếng Anh',
    content: 'Chọn từ đúng: "I ____ a student."',
    options: ['is', 'am', 'are', 'be'],
    correctAnswer: 1,
    rewardMinutes: 3,
    explanation: 'Với "I" thì luôn dùng "am": I am a student.',
  },
  {
    id: 'ta-16',
    subject: 'Tiếng Anh',
    content: 'Chọn từ đúng: "____ is your teacher?" (Ai là cô giáo của bạn?)',
    options: ['What', 'Where', 'Who', 'When'],
    correctAnswer: 2,
    rewardMinutes: 3,
    explanation: '"Who" dùng để hỏi về người.',
  },
  {
    id: 'ta-17',
    subject: 'Tiếng Anh',
    content: '"Cái mũi" trong tiếng Anh là từ nào?',
    options: ['nose', 'ear', 'eye', 'mouth'],
    correctAnswer: 0,
    rewardMinutes: 2,
    explanation: '"nose" là mũi, "ear" là tai, "eye" là mắt, "mouth" là miệng.',
  },
  {
    id: 'ta-18',
    subject: 'Tiếng Anh',
    content: 'Chọn từ đúng: "These are my ____." (nhiều quyển sách)',
    options: ['book', 'bookes', 'books', 'bookies'],
    correctAnswer: 2,
    rewardMinutes: 3,
    explanation: 'Số nhiều của "book" là "books" (thêm -s).',
  },
  {
    id: 'ta-19',
    subject: 'Tiếng Anh',
    content: 'Bạn hỏi "Can you swim?" — em trả lời "Yes, I ____."',
    options: ['am', 'do', 'is', 'can'],
    correctAnswer: 3,
    rewardMinutes: 3,
    explanation: 'Câu hỏi với "Can" thì trả lời bằng "can": Yes, I can.',
  },
  {
    id: 'ta-20',
    subject: 'Tiếng Anh',
    content: '"Trường học" trong tiếng Anh là từ nào?',
    options: ['school', 'house', 'park', 'shop'],
    correctAnswer: 0,
    rewardMinutes: 2,
    explanation: '"school" là trường học, "house" là ngôi nhà.',
  },
];

/** Lấy toàn bộ câu hỏi của một môn học */
export function getQuestionsBySubject(subject: Subject): Question[] {
  return QUESTIONS.filter((question) => question.subject === subject);
}

/** Đếm số câu hỏi của một môn học */
export function countQuestionsBySubject(subject: Subject): number {
  return getQuestionsBySubject(subject).length;
}

/** Trộn ngẫu nhiên một mảng (Fisher–Yates), không làm thay đổi mảng gốc */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Rút đề cho một lượt làm bài.
 * Ưu tiên các câu chưa từng trả lời đúng để học sinh được gặp kiến thức mới,
 * khi đã chinh phục hết mới quay lại các câu cũ.
 */
export function pickQuizQuestions(
  subject: Subject,
  masteredQuestionIds: string[] = [],
  count: number = QUESTIONS_PER_QUIZ,
): Question[] {
  const pool = getQuestionsBySubject(subject);
  const mastered = new Set(masteredQuestionIds);

  const fresh = shuffle(pool.filter((question) => !mastered.has(question.id)));
  const reviewed = shuffle(pool.filter((question) => mastered.has(question.id)));

  return [...fresh, ...reviewed].slice(0, count);
}
