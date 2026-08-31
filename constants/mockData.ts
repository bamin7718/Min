import type { Question, Subject, SubjectInfo } from '../types';
import { MATH_QUESTIONS } from './mathCurriculum';
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
 * Câu hỏi Tiếng Việt và Tiếng Anh — 20 câu mỗi môn.
 *
 * Câu hỏi Toán KHÔNG nằm ở đây: môn Toán được tổ chức theo lộ trình 35 tuần
 * trong `constants/mathCurriculum.ts` để tránh có hai nguồn dữ liệu trùng id.
 *
 * LƯU Ý: không đổi `id` của câu đã có, vì `masteredQuestionIds` lưu trong
 * AsyncStorage/Supabase tham chiếu tới các id này.
 */
const LANGUAGE_QUESTIONS: Question[] = [
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

/** Toàn bộ câu hỏi của cả ba môn */
export const QUESTIONS: Question[] = [...MATH_QUESTIONS, ...LANGUAGE_QUESTIONS];

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

/**
 * Trả về bản sao của câu hỏi với thứ tự lựa chọn được trộn ngẫu nhiên,
 * `correctAnswer` được tính lại theo vị trí mới.
 *
 * Mục đích: bộ đề tĩnh khó phân bố đáp án đều tay (bản đầu có đáp án D chỉ xuất
 * hiện 3/125 lần), nên học sinh có thể đoán theo vị trí. Trộn khi tạo đề vừa
 * cân bằng vị trí đáp án, vừa khiến làm lại cùng một câu không đoán được.
 */
export function shuffleQuestionOptions(question: Question): Question {
  const indices = shuffle([0, 1, 2, 3]);
  const options = indices.map((i) => question.options[i]) as Question['options'];
  const correctAnswer = indices.indexOf(question.correctAnswer);

  return { ...question, options, correctAnswer };
}

/** Trộn lựa chọn cho cả một danh sách câu hỏi */
export function shuffleAllOptions(questions: Question[]): Question[] {
  return questions.map(shuffleQuestionOptions);
}
