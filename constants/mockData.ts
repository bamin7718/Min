import type { Question, Subject, SubjectInfo } from '../types';
import { MATH_QUESTIONS } from './mathCurriculum';
import { VIETNAMESE_QUESTIONS } from './vietnameseCurriculum';
import { colors } from './theme';

/** Điểm thưởng cho mỗi câu trả lời đúng */
export const POINTS_PER_CORRECT = 10;

/**
 * Số câu mỗi lượt làm bài. Bộ câu hỏi có 20 câu/môn nhưng học sinh Lớp 3 không
 * nên làm liền 20 câu, nên mỗi lượt chỉ rút ngẫu nhiên một phần.
 */
export const QUESTIONS_PER_QUIZ = 6;

/**
 * Câu đã từng trả lời đúng thì lần sau KHÔNG cộng gì thêm — cả điểm lẫn phút.
 *
 * Đây là chốt chặn chống "cày" phần thưởng: không có nó, học sinh chỉ cần làm
 * đi làm lại một đề dễ là có phút chơi game vô hạn. Làm lại vẫn được luyện tập
 * và vẫn thấy đúng/sai, chỉ là không sinh thêm phần thưởng.
 */
export const REPEAT_ANSWER_GIVES_MINUTES = false;
export const REPEAT_ANSWER_GIVES_POINTS = false;

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
    color: colors.math,
    softColor: colors.mathSoft,
  },
  {
    key: 'Tiếng Việt',
    emoji: '📖',
    description: 'Chính tả, từ loại, mẫu câu, so sánh và nhân hoá',
    color: colors.vietnamese,
    softColor: colors.vietnameseSoft,
  },
  {
    key: 'Tiếng Anh',
    emoji: '🌏',
    description: 'Từ vựng và câu giao tiếp đơn giản',
    color: colors.english,
    softColor: colors.englishSoft,
  },
];

/**
 * Câu hỏi Tiếng Anh — môn duy nhất chưa tổ chức theo tuần nên vẫn rút đề
 * ngẫu nhiên.
 *
 * Toán và Tiếng Việt KHÔNG nằm ở đây: hai môn đó theo lộ trình 35 tuần trong
 * `mathCurriculum.ts` và `vietnameseCurriculum.ts`, để tránh hai nguồn dữ liệu
 * trùng id.
 *
 * LƯU Ý: không đổi `id` của câu đã có, vì `masteredQuestionIds` lưu trong
 * AsyncStorage/Supabase tham chiếu tới các id này.
 */
const LANGUAGE_QUESTIONS: Question[] = [
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
export const QUESTIONS: Question[] = [
  ...MATH_QUESTIONS,
  ...VIETNAMESE_QUESTIONS,
  ...LANGUAGE_QUESTIONS,
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
