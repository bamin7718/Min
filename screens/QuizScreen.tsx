import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getCurriculumWeek,
  getUnitsOf,
  hasCurriculum,
  totalWeeks,
  weekStatusFor,
} from '../constants/curriculum';
import { weekBonusMinutes } from '../constants/mathCurriculum';
import {
  POINTS_PER_CORRECT,
  SUBJECTS,
  getQuestionsBySubject,
  pickQuizQuestions,
  shuffleAllOptions,
} from '../constants/mockData';
import {
  QUESTIONS_PER_QUIZ,
  bankSize,
  generateQuizForWeek,
  rebuildQuiz,
  type QuizSession,
} from '../lib/quizEngine';
import {
  CONTENT_MAX_WIDTH,
  TABLET_BREAKPOINT,
  TAB_BAR_SPACE,
  colors,
  elevation,
  radius,
  spacing,
  touch,
} from '../constants/theme';
import {
  usePlaytime,
  type RewardOutcome,
  type WeekOutcome,
} from '../context/PlaytimeContext';
import type {
  RootTabParamList,
  Subject,
  SubjectInfo,
  SubjectWeekProgress,
  WeekStatus,
  WeekTopic,
} from '../types';

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

/** Tổng kết một lượt làm bài */
interface SessionSummary {
  correctCount: number;
  totalQuestions: number;
  pointsEarned: number;
  minutesEarned: number;
}

const EMPTY_SUMMARY: SessionSummary = {
  correctCount: 0,
  totalQuestions: 0,
  pointsEarned: 0,
  minutesEarned: 0,
};

export default function QuizScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  const {
    totalPoints,
    availableMinutes,
    masteredQuestionIds,
    completedWeeks,
    submitAnswer,
    completeWeek,
    hydrated,
  } = usePlaytime();

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  /** Tuần đang làm bài — chỉ dùng cho môn Toán */
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  /** Kết quả vượt tuần, hiện ở màn tổng kết */
  const [weekOutcome, setWeekOutcome] = useState<WeekOutcome | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<RewardOutcome | null>(null);
  const [summary, setSummary] = useState<SessionSummary>(EMPTY_SUMMARY);
  const [isFinished, setIsFinished] = useState(false);
  /** Tăng lên mỗi lượt làm bài để rút đề mới, kể cả khi chọn lại cùng môn */
  const [sessionId, setSessionId] = useState(0);

  /**
   * Đọc danh sách câu đã chinh phục qua ref: nếu để làm dependency của useMemo
   * thì đề sẽ bị rút lại ngay giữa lượt làm bài (vì mỗi câu đúng đều cập nhật nó).
   */
  const masteredRef = useRef(masteredQuestionIds);
  masteredRef.current = masteredQuestionIds;

  /**
   * Đề đang làm. `null` khi chưa chọn tuần.
   * Giữ trong state (không phải useMemo) để nút "Làm lại đề này" dựng lại đúng
   * bộ câu cũ mà không rút đề khác.
   */
  const [session, setSession] = useState<QuizSession | null>(null);

  const questions = useMemo(() => {
    if (!selectedSubject) return [];
    if (hasCurriculum(selectedSubject)) return session?.questions ?? [];

    // Môn chưa có lộ trình: rút ngẫu nhiên từ bộ đề chung
    return shuffleAllOptions(pickQuizQuestions(selectedSubject, masteredRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, session, sessionId]);

  const currentQuestion = questions[questionIndex];
  const activeWeek =
    selectedSubject === null || selectedWeek === null
      ? undefined
      : getCurriculumWeek(selectedSubject, selectedWeek);

  // Hiệu ứng nảy nhẹ cho khung phản hồi đúng/sai
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  /** Rung ngang khi trả lời sai — phản hồi tức thì, không cần đọc chữ */
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const playFeedbackAnimation = useCallback(
    (isCorrect: boolean) => {
      feedbackAnim.setValue(0);
      Animated.spring(feedbackAnim, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }).start();

      if (isCorrect) return;
      shakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]).start();
    },
    [feedbackAnim, shakeAnim],
  );

  const resetSession = useCallback(() => {
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setOutcome(null);
    setSummary(EMPTY_SUMMARY);
    setIsFinished(false);
    setWeekOutcome(null);
  }, []);

  const handleChooseSubject = useCallback(
    (subject: Subject) => {
      resetSession();
      setSelectedSubject(subject);
      // Môn có lộ trình: vào màn chọn tuần trước, chưa vào bài ngay
      setSelectedWeek(null);
      setSessionId((prev) => prev + 1);
    },
    [resetSession],
  );

  const handleChooseWeek = useCallback(
    (weekNumber: number) => {
      if (!selectedSubject) return;
      resetSession();
      setSelectedWeek(weekNumber);
      setSession(generateQuizForWeek(selectedSubject, weekNumber, masteredRef.current));
      setSessionId((prev) => prev + 1);
    },
    [resetSession, selectedSubject],
  );

  /** Rút một bộ câu hoàn toàn mới trong ngân hàng của tuần */
  const handleNewQuiz = useCallback(() => {
    if (!selectedSubject || selectedWeek === null) return;
    resetSession();
    setSession(generateQuizForWeek(selectedSubject, selectedWeek, masteredRef.current));
    setSessionId((prev) => prev + 1);
  }, [resetSession, selectedSubject, selectedWeek]);

  /** Giữ nguyên bộ câu vừa làm, chỉ trộn lại đáp án và xoá lựa chọn cũ */
  const handleRetrySameQuiz = useCallback(() => {
    if (!session) return;
    resetSession();
    setSession(rebuildQuiz(session));
    setSessionId((prev) => prev + 1);
  }, [resetSession, session]);

  const handleBackToSubjects = useCallback(() => {
    resetSession();
    setSelectedSubject(null);
    setSelectedWeek(null);
    setSession(null);
  }, [resetSession]);

  /** Từ màn làm bài Toán quay về danh sách tuần */
  const handleBackToWeeks = useCallback(() => {
    resetSession();
    setSelectedWeek(null);
    setSession(null);
  }, [resetSession]);

  const handleSelectAnswer = useCallback(
    (index: number) => {
      // Đã trả lời rồi thì không cho đổi đáp án
      if (selectedAnswer !== null || !currentQuestion) return;

      const result = submitAnswer(currentQuestion, index);
      setSelectedAnswer(index);
      setOutcome(result);
      setSummary((prev) => ({
        correctCount: prev.correctCount + (result.isCorrect ? 1 : 0),
        totalQuestions: prev.totalQuestions + 1,
        pointsEarned: prev.pointsEarned + result.pointsEarned,
        minutesEarned: prev.minutesEarned + result.minutesEarned,
      }));
      playFeedbackAnimation(result.isCorrect);
    },
    [currentQuestion, playFeedbackAnimation, selectedAnswer, submitAnswer],
  );

  const handleNextQuestion = useCallback(() => {
    if (questionIndex + 1 >= questions.length) {
      // Làm xong một tuần Toán thì ghi nhận để mở tuần kế tiếp
      if (activeWeek) {
        setWeekOutcome(
          completeWeek(activeWeek, summary.correctCount, summary.totalQuestions),
        );
      }
      setIsFinished(true);
      return;
    }
    setQuestionIndex((prev) => prev + 1);
    setSelectedAnswer(null);
    setOutcome(null);
  }, [
    activeWeek,
    completeWeek,
    questionIndex,
    questions.length,
    summary.correctCount,
    summary.totalQuestions,
  ]);

  const contentStyle = [
    styles.content,
    isTablet && styles.contentTablet,
    { paddingBottom: insets.bottom + TAB_BAR_SPACE },
  ];

  return (
    <View style={styles.container}>
      <HeaderBar
        totalPoints={totalPoints}
        availableMinutes={availableMinutes}
        hydrated={hydrated}
        topInset={insets.top}
      />

      <ScrollView
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
      >
        {selectedSubject === null ? (
          <SubjectPicker
            isTablet={isTablet}
            masteredQuestionIds={masteredQuestionIds}
            completedWeeks={completedWeeks}
            onChoose={handleChooseSubject}
          />
        ) : hasCurriculum(selectedSubject) && selectedWeek === null ? (
          <WeekPicker
            subject={selectedSubject}
            isTablet={isTablet}
            completedWeeks={completedWeeks}
            onChooseWeek={handleChooseWeek}
            onBack={handleBackToSubjects}
          />
        ) : isFinished ? (
          <SummaryCard
            subject={selectedSubject}
            week={activeWeek}
            weekOutcome={weekOutcome}
            summary={summary}
            onNewQuiz={
              activeWeek ? handleNewQuiz : () => handleChooseSubject(selectedSubject)
            }
            onRetrySame={activeWeek ? handleRetrySameQuiz : undefined}
            onBack={activeWeek ? handleBackToWeeks : handleBackToSubjects}
            onNextWeek={
              weekOutcome?.unlockedWeek
                ? () => handleChooseWeek(weekOutcome.unlockedWeek as number)
                : undefined
            }
            onGoToGame={() => navigation.navigate('GocGame')}
          />
        ) : currentQuestion ? (
          <View style={styles.quizWrapper}>
            <QuizProgress
              subject={selectedSubject}
              week={activeWeek}
              current={questionIndex + 1}
              total={questions.length}
              onBack={activeWeek ? handleBackToWeeks : handleBackToSubjects}
            />

            {/* Đoạn văn của dạng bài Tập đọc — hiện phía trên câu hỏi */}
            {currentQuestion.passage && (
              <View style={styles.passageCard}>
                <Text style={styles.passageLabel}>📖 Đọc đoạn văn sau</Text>
                <Text
                  style={[styles.passageText, isTablet && styles.passageTextTablet]}
                >
                  {currentQuestion.passage}
                </Text>
              </View>
            )}

            <View style={styles.questionCard}>
              <View style={styles.questionBadgeRow}>
                <Text style={styles.questionBadge}>
                  Câu {questionIndex + 1} · Thưởng {currentQuestion.rewardMinutes} phút
                  chơi game
                </Text>
                {currentQuestion.skill && (
                  <Text style={styles.skillBadge}>{currentQuestion.skill}</Text>
                )}
              </View>
              <Text style={[styles.questionText, isTablet && styles.questionTextTablet]}>
                {currentQuestion.content}
              </Text>
            </View>

            <Animated.View
              style={[
                styles.optionList,
                isTablet && styles.optionListTablet,
                {
                  transform: [
                    {
                      translateX: shakeAnim.interpolate({
                        inputRange: [-1, 1],
                        outputRange: [-10, 10],
                      }),
                    },
                  ],
                },
              ]}
            >
              {currentQuestion.options.map((option, index) => (
                <OptionButton
                  key={`${currentQuestion.id}-${index}`}
                  label={OPTION_LABELS[index]}
                  text={option}
                  isTablet={isTablet}
                  isSelected={selectedAnswer === index}
                  isCorrectAnswer={currentQuestion.correctAnswer === index}
                  isRevealed={selectedAnswer !== null}
                  onPress={() => handleSelectAnswer(index)}
                />
              ))}
            </Animated.View>

            {outcome && (
              <FeedbackCard
                outcome={outcome}
                explanation={currentQuestion.explanation}
                animation={feedbackAnim}
                isLastQuestion={questionIndex + 1 >= questions.length}
                onNext={handleNextQuestion}
              />
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Thanh trạng thái điểm & phút chơi game                              */
/* ------------------------------------------------------------------ */

function HeaderBar({
  totalPoints,
  availableMinutes,
  hydrated,
  topInset,
}: {
  totalPoints: number;
  availableMinutes: number;
  /** Chưa nạp xong Local thì hiện "…" thay vì số 0 để không nháy sai số */
  hydrated: boolean;
  topInset: number;
}) {
  return (
    <View style={[styles.header, { paddingTop: topInset + spacing.md }]}>
      <View style={styles.headerTextGroup}>
        <Text style={styles.headerGreeting}>Chào em học sinh Lớp 3 👋</Text>
        <Text style={styles.headerTitle}>Học bài kiếm giờ chơi game</Text>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statChip}>
          <Text style={styles.statEmoji}>⭐</Text>
          <Text style={styles.statValue}>{hydrated ? totalPoints : '…'}</Text>
          <Text style={styles.statLabel}>điểm</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statEmoji}>🎮</Text>
          <Text style={styles.statValue}>{hydrated ? availableMinutes : '…'}</Text>
          <Text style={styles.statLabel}>phút</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Màn hình chọn môn học                                               */
/* ------------------------------------------------------------------ */

function SubjectPicker({
  isTablet,
  masteredQuestionIds,
  completedWeeks,
  onChoose,
}: {
  isTablet: boolean;
  masteredQuestionIds: string[];
  completedWeeks: SubjectWeekProgress;
  onChoose: (subject: Subject) => void;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Chọn môn em muốn học hôm nay</Text>
      <Text style={styles.sectionSubtitle}>
        Toán và Tiếng Việt đi theo lộ trình {totalWeeks('Toán')} tuần; Tiếng Anh mỗi
        lượt {QUESTIONS_PER_QUIZ} câu rút ngẫu nhiên. Trả lời đúng được +
        {POINTS_PER_CORRECT} điểm và cộng thêm phút chơi game nhé!
      </Text>

      <View style={[styles.subjectGrid, isTablet && styles.subjectGridTablet]}>
        {SUBJECTS.map((subject) => (
          <SubjectCard
            key={subject.key}
            subject={subject}
            isTablet={isTablet}
            masteredQuestionIds={masteredQuestionIds}
            completedWeeks={completedWeeks}
            onPress={() => onChoose(subject.key)}
          />
        ))}
      </View>
    </View>
  );
}

const SubjectCard = React.memo(function SubjectCard({
  subject,
  isTablet,
  masteredQuestionIds,
  completedWeeks,
  onPress,
}: {
  subject: SubjectInfo;
  isTablet: boolean;
  masteredQuestionIds: string[];
  completedWeeks: SubjectWeekProgress;
  onPress: () => void;
}) {
  // Môn có lộ trình thì đo tiến độ theo tuần, môn còn lại theo số câu đã đúng
  const isWeekly = hasCurriculum(subject.key);
  const questions = getQuestionsBySubject(subject.key);
  const doneCount = isWeekly
    ? (completedWeeks[subject.key] ?? 0)
    : questions.filter((question) => masteredQuestionIds.includes(question.id)).length;
  const totalCount = isWeekly ? totalWeeks(subject.key) : questions.length;
  const isCompleted = totalCount > 0 && doneCount === totalCount;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Học môn ${subject.key}`}
      style={({ pressed }) => [
        styles.subjectCard,
        isTablet && styles.subjectCardTablet,
        { backgroundColor: subject.softColor, borderColor: subject.color },
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.subjectEmoji}>{subject.emoji}</Text>
      <View style={styles.subjectTextGroup}>
        <Text style={[styles.subjectName, { color: subject.color }]}>
          {subject.key} {isCompleted ? '🏆' : ''}
        </Text>
        <Text style={styles.subjectDescription}>{subject.description}</Text>
        <Text style={styles.subjectMeta}>
          {isWeekly
            ? `Lộ trình ${totalCount} tuần · đã qua ${doneCount}/${totalCount} tuần`
            : `Mỗi lượt ${QUESTIONS_PER_QUIZ} câu · đã chinh phục ${doneCount}/${totalCount} câu`}
        </Text>

        {/* Thanh tiến độ chinh phục cả bộ câu hỏi của môn */}
        <View style={styles.masteryTrack}>
          <View
            style={[
              styles.masteryFill,
              {
                backgroundColor: subject.color,
                width: `${totalCount ? Math.round((doneCount / totalCount) * 100) : 0}%`,
              },
            ]}
          />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={24} color={subject.color} />
    </Pressable>
  );
});

/* ------------------------------------------------------------------ */
/* Màn hình chọn tuần (môn Toán)                                       */
/* ------------------------------------------------------------------ */

const WEEK_STATUS_META: Record<
  WeekStatus,
  { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }
> = {
  completed: { label: 'Đã hoàn thành', icon: 'checkmark-circle', color: colors.success },
  current: { label: 'Đang học', icon: 'play-circle', color: colors.primary },
  locked: { label: 'Khoá', icon: 'lock-closed', color: colors.textMuted },
};

const WeekPicker = React.memo(function WeekPicker({
  subject,
  isTablet,
  completedWeeks,
  onChooseWeek,
  onBack,
}: {
  subject: Subject;
  isTablet: boolean;
  completedWeeks: SubjectWeekProgress;
  onChooseWeek: (weekNumber: number) => void;
  onBack: () => void;
}) {
  const done = completedWeeks[subject] ?? 0;
  const total = totalWeeks(subject);
  const currentWeek = Math.min(done + 1, total);

  /** Mặc định mở đúng học kỳ chứa tuần em đang học */
  const [semester, setSemester] = useState<1 | 2>(currentWeek > 18 ? 2 : 1);

  // Nhóm theo giai đoạn, rồi lọc theo học kỳ đang chọn
  const groups = useMemo(() => {
    const range = semester === 1 ? [1, 18] : [19, 35];
    return getUnitsOf(subject)
      .map((group) => ({
        ...group,
        weeks: group.weeks.filter(
          (week) => week.weekNumber >= range[0] && week.weekNumber <= range[1],
        ),
      }))
      .filter((group) => group.weeks.length > 0);
  }, [subject, semester]);

  return (
    <View>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Quay lại chọn môn"
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backButtonText}>Đổi môn</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Lộ trình {subject} Lớp 3</Text>
      <Text style={styles.sectionSubtitle}>
        Đã hoàn thành {done}/{total} tuần. Em đang học{' '}
        <Text style={styles.sectionSubtitleStrong}>Tuần {currentWeek}</Text> — học xong
        một tuần sẽ mở tuần tiếp theo.
      </Text>

      {/* Chuyển nhanh giữa hai học kỳ */}
      <View style={styles.semesterTabs}>
        {([1, 2] as const).map((value) => {
          const isActive = semester === value;
          return (
            <Pressable
              key={value}
              onPress={() => setSemester(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={
                value === 1 ? 'Xem Học kỳ 1, tuần 1 đến 18' : 'Xem Học kỳ 2, tuần 19 đến 35'
              }
              style={({ pressed }) => [
                styles.semesterTab,
                isActive && styles.semesterTabActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.semesterText, isActive && styles.semesterTextActive]}
              >
                {value === 1 ? 'Học kỳ 1' : 'Học kỳ 2'}
              </Text>
              <Text
                style={[styles.semesterRange, isActive && styles.semesterRangeActive]}
              >
                {value === 1 ? 'Tuần 1 – 18' : 'Tuần 19 – 35'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {groups.map((group) => (
        <View key={group.unit} style={styles.weekGroup}>
          <Text style={styles.weekGroupTitle}>
            {group.unit} (Tuần {group.weeks[0].weekNumber}–
            {group.weeks[group.weeks.length - 1].weekNumber})
          </Text>

          <View style={styles.weekGrid}>
            {group.weeks.map((week) => (
              <WeekCard
                key={week.weekNumber}
                week={week}
                status={weekStatusFor(subject, week.weekNumber, completedWeeks)}
                isTablet={isTablet}
                onSelect={onChooseWeek}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
});

const WeekCard = React.memo(function WeekCard({
  week,
  status,
  isTablet,
  onSelect,
}: {
  week: WeekTopic;
  status: WeekStatus;
  isTablet: boolean;
  /** Nhận số tuần thay vì closure, để prop không đổi giữa các lần render */
  onSelect: (weekNumber: number) => void;
}) {
  const meta = WEEK_STATUS_META[status];
  const isLocked = status === 'locked';
  const handlePress = useCallback(() => onSelect(week.weekNumber), [onSelect, week.weekNumber]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={isLocked}
      accessibilityRole="button"
      accessibilityState={{ disabled: isLocked }}
      accessibilityLabel={`Tuần ${week.weekNumber}: ${week.title}. ${meta.label}`}
      style={({ pressed }) => [
        styles.weekCard,
        isTablet && styles.weekCardTablet,
        status === 'current' && styles.weekCardCurrent,
        status === 'completed' && styles.weekCardCompleted,
        isLocked && styles.weekCardLocked,
        pressed && !isLocked && styles.pressed,
      ]}
    >
      <View style={styles.weekCardHeader}>
        <Text style={[styles.weekNumber, { color: meta.color }]}>
          Tuần {week.weekNumber}
        </Text>
        <Ionicons name={meta.icon} size={18} color={meta.color} />
      </View>

      <Text style={styles.weekTitle} numberOfLines={3}>
        {week.title}
      </Text>

      <Text style={[styles.weekStatusLabel, { color: meta.color }]}>
        {meta.label}
        {!isLocked && ` · ${week.questions.length} câu · +${weekBonusMinutes(week)}′`}
      </Text>
    </Pressable>
  );
});

/* ------------------------------------------------------------------ */
/* Thanh tiến độ bài test                                              */
/* ------------------------------------------------------------------ */

function QuizProgress({
  subject,
  week,
  current,
  total,
  onBack,
}: {
  subject: Subject;
  week?: WeekTopic;
  current: number;
  total: number;
  onBack: () => void;
}) {
  const percent = Math.round((current / total) * 100);

  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressHeader}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={week ? 'Quay lại chọn tuần' : 'Quay lại chọn môn'}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backButtonText}>{week ? 'Đổi tuần' : 'Đổi môn'}</Text>
        </Pressable>
        <Text style={styles.progressText}>
          {week ? `Tuần ${week.weekNumber}` : subject} · Câu {current}/{total}
        </Text>
      </View>

      {week && (
        <Text style={styles.weekLessonTitle} numberOfLines={2}>
          {week.title}
        </Text>
      )}

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Nút lựa chọn đáp án                                                 */
/* ------------------------------------------------------------------ */

const OptionButton = React.memo(function OptionButton({
  label,
  text,
  isTablet,
  isSelected,
  isCorrectAnswer,
  isRevealed,
  onPress,
}: {
  label: string;
  text: string;
  isTablet: boolean;
  isSelected: boolean;
  isCorrectAnswer: boolean;
  isRevealed: boolean;
  onPress: () => void;
}) {
  // Sau khi trả lời: tô xanh đáp án đúng, tô đỏ đáp án sai mà học sinh đã chọn
  const showAsCorrect = isRevealed && isCorrectAnswer;
  const showAsWrong = isRevealed && isSelected && !isCorrectAnswer;

  return (
    <Pressable
      onPress={onPress}
      disabled={isRevealed}
      accessibilityRole="button"
      accessibilityLabel={`Đáp án ${label}: ${text}`}
      style={({ pressed }) => [
        styles.option,
        isTablet && styles.optionTablet,
        showAsCorrect && styles.optionCorrect,
        showAsWrong && styles.optionWrong,
        pressed && !isRevealed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.optionBadge,
          showAsCorrect && styles.optionBadgeCorrect,
          showAsWrong && styles.optionBadgeWrong,
        ]}
      >
        <Text
          style={[
            styles.optionBadgeText,
            (showAsCorrect || showAsWrong) && styles.optionBadgeTextActive,
          ]}
        >
          {label}
        </Text>
      </View>

      <Text style={[styles.optionText, isTablet && styles.optionTextTablet]}>
        {text}
      </Text>

      {showAsCorrect && (
        <Ionicons name="checkmark-circle" size={26} color={colors.success} />
      )}
      {showAsWrong && <Ionicons name="close-circle" size={26} color={colors.danger} />}
    </Pressable>
  );
});

/* ------------------------------------------------------------------ */
/* Khung phản hồi đúng / sai                                           */
/* ------------------------------------------------------------------ */

function FeedbackCard({
  outcome,
  explanation,
  animation,
  isLastQuestion,
  onNext,
}: {
  outcome: RewardOutcome;
  explanation?: string;
  animation: Animated.Value;
  isLastQuestion: boolean;
  onNext: () => void;
}) {
  const scale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  return (
    <Animated.View
      style={[
        styles.feedbackCard,
        outcome.isCorrect ? styles.feedbackCorrect : styles.feedbackWrong,
        { opacity: animation, transform: [{ scale }] },
      ]}
    >
      <Text style={styles.feedbackEmoji}>{outcome.isCorrect ? '🎉' : '💪'}</Text>

      <Text
        style={[
          styles.feedbackTitle,
          { color: outcome.isCorrect ? colors.success : colors.danger },
        ]}
      >
        {outcome.isCorrect ? 'Chính xác! Giỏi lắm!' : 'Chưa đúng rồi, cố lên nhé!'}
      </Text>

      {outcome.isCorrect && (
        <Text style={styles.feedbackReward}>
          +{outcome.pointsEarned} điểm
          {outcome.minutesEarned > 0
            ? ` · +${outcome.minutesEarned} phút chơi game 🎮`
            : ' · câu này em đã làm đúng trước đó nên chỉ cộng điểm'}
        </Text>
      )}

      {explanation && <Text style={styles.feedbackExplanation}>{explanation}</Text>}

      <Pressable
        onPress={onNext}
        accessibilityRole="button"
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>
          {isLastQuestion ? 'Xem kết quả' : 'Câu tiếp theo'}
        </Text>
        <Ionicons name="arrow-forward" size={20} color={colors.textOnPrimary} />
      </Pressable>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Tổng kết bài test                                                   */
/* ------------------------------------------------------------------ */

function SummaryCard({
  subject,
  week,
  weekOutcome,
  summary,
  onNewQuiz,
  onRetrySame,
  onBack,
  onNextWeek,
  onGoToGame,
}: {
  subject: Subject;
  week?: WeekTopic;
  weekOutcome: WeekOutcome | null;
  summary: SessionSummary;
  /** Rút bộ câu hoàn toàn mới */
  onNewQuiz: () => void;
  /** Làm lại đúng bộ câu vừa rồi; bỏ trống với môn chưa có lộ trình */
  onRetrySame?: () => void;
  onBack: () => void;
  onNextWeek?: () => void;
  onGoToGame: () => void;
}) {
  const allCorrect =
    summary.totalQuestions > 0 && summary.correctCount === summary.totalQuestions;
  const failedWeek = weekOutcome !== null && !weekOutcome.passed;

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryEmoji}>
        {failedWeek ? '💪' : allCorrect ? '🏆' : '🌟'}
      </Text>
      <Text style={styles.summaryTitle}>
        {failedWeek
          ? 'Gần được rồi, thử lại nhé!'
          : allCorrect
            ? 'Xuất sắc! Đúng hết luôn!'
            : 'Hoàn thành bài rồi!'}
      </Text>
      <Text style={styles.summarySubtitle}>
        {week ? `Tuần ${week.weekNumber} · ${week.title}` : `Môn ${subject}`}
      </Text>

      <View style={styles.summaryStats}>
        <SummaryStat
          value={`${summary.correctCount}/${summary.totalQuestions}`}
          label="Câu đúng"
        />
        <SummaryStat value={`+${summary.pointsEarned}`} label="Điểm" />
        <SummaryStat value={`+${summary.minutesEarned}`} label="Phút game" />
      </View>

      {/* Kết quả vượt tuần của lộ trình Toán */}
      {weekOutcome && (
        <View
          style={[
            styles.weekResultCard,
            weekOutcome.passed ? styles.weekResultPassed : styles.weekResultFailed,
          ]}
        >
          {weekOutcome.passed ? (
            <>
              <Text style={styles.weekResultTitle}>
                🎉 Em đã vượt qua Tuần {week?.weekNumber}!
              </Text>
              {weekOutcome.bonusMinutes > 0 ? (
                <Text style={styles.weekResultText}>
                  Thưởng thêm +{weekOutcome.bonusMinutes} phút chơi game
                  {weekOutcome.unlockedWeek
                    ? ` và mở Tuần ${weekOutcome.unlockedWeek}.`
                    : '. Em đã hoàn thành cả lộ trình!'}
                </Text>
              ) : (
                <Text style={styles.weekResultText}>
                  Tuần này em đã vượt qua trước đó nên không cộng thêm phút, nhưng ôn
                  lại vẫn được cộng điểm.
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.weekResultTitle}>Chưa qua được tuần này</Text>
              <Text style={styles.weekResultText}>
                Em cần đúng ít nhất {weekOutcome.required}/{summary.totalQuestions} câu.
                Lần này em đúng {summary.correctCount} câu — làm lại là được ngay!
              </Text>
            </>
          )}
        </View>
      )}

      {onNextWeek ? (
        <Pressable
          onPress={onNextWeek}
          accessibilityRole="button"
          accessibilityLabel="Học tuần tiếp theo"
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-forward" size={20} color={colors.textOnPrimary} />
          <Text style={styles.primaryButtonText}>Học tuần tiếp theo</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={onGoToGame}
        accessibilityRole="button"
        accessibilityLabel="Sang Góc Game"
        style={({ pressed }) => [
          onNextWeek ? styles.secondaryWideButton : styles.primaryButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={onNextWeek ? styles.secondaryWideText : styles.primaryButtonText}>
          Sang Góc Game chơi thôi 🎮
        </Text>
      </Pressable>

      <View style={styles.summaryActions}>
        <Pressable
          onPress={onNewQuiz}
          accessibilityRole="button"
          accessibilityLabel="Đổi đề mới"
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Ionicons name="shuffle" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>ĐỔI ĐỀ MỚI</Text>
        </Pressable>

        {onRetrySame && (
          <Pressable
            onPress={onRetrySame}
            accessibilityRole="button"
            accessibilityLabel="Làm lại đề này"
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Ionicons name="refresh" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>LÀM LẠI ĐỀ NÀY</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={week ? 'Chọn tuần khác' : 'Chọn môn khác'}
        style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
      >
        <Ionicons name="grid-outline" size={18} color={colors.textMuted} />
        <Text style={styles.ghostButtonText}>
          {week ? 'Chọn tuần khác' : 'Chọn môn khác'}
        </Text>
      </Pressable>

      {onRetrySame && (
        <Text style={styles.retryHint}>
          Làm lại đề cũ để luyện tập — chỉ câu đúng LẦN ĐẦU mới cộng điểm và phút chơi
          game.
        </Text>
      )}
    </View>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryStatValue}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerTextGroup: { marginBottom: spacing.md },
  headerGreeting: { color: '#DBE4FF', fontSize: 14, fontWeight: '600' },
  headerTitle: {
    color: colors.textOnPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  statRow: { flexDirection: 'row', gap: spacing.md },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  statEmoji: { fontSize: 16 },
  statValue: { color: colors.textOnPrimary, fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#DBE4FF', fontSize: 13, fontWeight: '600' },

  // Nội dung
  content: { padding: spacing.lg, gap: spacing.lg },
  contentTablet: {
    maxWidth: CONTENT_MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
    padding: spacing.xl,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },

  // Thẻ môn học
  subjectGrid: { gap: spacing.md },
  subjectGridTablet: { flexDirection: 'row', flexWrap: 'wrap' },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 2,
    ...elevation(2),
  },
  subjectCardTablet: { flexBasis: '48%', flexGrow: 1 },
  subjectEmoji: { fontSize: 36 },
  subjectTextGroup: { flex: 1 },
  subjectName: { fontSize: 18, fontWeight: '800' },
  subjectDescription: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  subjectMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
  masteryTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  masteryFill: { height: '100%', borderRadius: radius.pill },

  // Chọn tuần
  sectionSubtitleStrong: { fontWeight: '800', color: colors.primary },
  semesterTabs: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  semesterTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: touch.min,
    gap: 2,
  },
  semesterTabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    ...elevation(1),
  },
  semesterText: { fontSize: 15, fontWeight: '800', color: colors.textMuted },
  semesterTextActive: { color: colors.primary },
  semesterRange: { fontSize: 11, color: colors.textMuted },
  semesterRangeActive: { color: colors.primary },
  weekGroup: { marginBottom: spacing.xl },
  weekGroupTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // Thẻ tuần dạng cột mốc: 2 cột trên điện thoại, 3-4 cột trên tablet
  weekCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 126,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    ...elevation(1),
  },
  weekCardTablet: { flexBasis: '30%' },
  weekCardCurrent: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  weekCardCompleted: { borderColor: colors.success, backgroundColor: colors.successSoft },
  weekCardLocked: { opacity: 0.55, backgroundColor: colors.background },
  weekCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekNumber: { fontSize: 15, fontWeight: '800' },
  weekTitle: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },
  weekStatusLabel: { fontSize: 11, fontWeight: '700' },
  weekLessonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 20,
  },

  // Kết quả vượt tuần
  weekResultCard: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    borderWidth: 2,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  weekResultPassed: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  weekResultFailed: { borderColor: colors.warning, backgroundColor: colors.warningSoft },
  weekResultTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  weekResultText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  secondaryWideButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  secondaryWideText: { color: colors.primary, fontSize: 15, fontWeight: '800' },

  // Bài test
  quizWrapper: { gap: spacing.lg },
  progressBlock: { gap: spacing.sm },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backButtonText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  progressText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  progressTrack: {
    height: 14,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },

  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation(2),
  },
  questionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  questionBadge: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.warning },
  skillBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },

  // Đoạn văn bài Tập đọc
  passageCard: {
    backgroundColor: colors.warningSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  passageLabel: { fontSize: 12, fontWeight: '800', color: colors.warning },
  passageText: { fontSize: 15, color: colors.text, lineHeight: 24 },
  passageTextTablet: { fontSize: 17, lineHeight: 28 },
  questionText: { fontSize: 19, fontWeight: '700', color: colors.text, lineHeight: 28 },
  questionTextTablet: { fontSize: 23, lineHeight: 34 },

  // Đáp án
  optionList: { gap: spacing.md },
  optionListTablet: { flexDirection: 'row', flexWrap: 'wrap' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    minHeight: touch.primary + 8,
    ...elevation(1),
  },
  optionTablet: { flexBasis: '48%', flexGrow: 1 },
  optionCorrect: { borderColor: colors.success, backgroundColor: colors.successSoft },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  optionBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBadgeCorrect: { backgroundColor: colors.success },
  optionBadgeWrong: { backgroundColor: colors.danger },
  optionBadgeText: { fontWeight: '800', color: colors.primary, fontSize: 15 },
  optionBadgeTextActive: { color: colors.textOnPrimary },
  optionText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  optionTextTablet: { fontSize: 18 },

  // Phản hồi
  feedbackCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    alignItems: 'center',
    gap: spacing.sm,
  },
  feedbackCorrect: { backgroundColor: colors.successSoft, borderColor: colors.success },
  feedbackWrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  feedbackEmoji: { fontSize: 40 },
  feedbackTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  feedbackReward: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  feedbackExplanation: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Nút
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    alignSelf: 'stretch',
    minHeight: touch.primary,
    ...elevation(2),
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    minHeight: touch.min,
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '700', fontSize: 14 },

  // Tổng kết
  summaryCard: {
    backgroundColor: colors.surface,
    ...elevation(2),
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  summaryEmoji: { fontSize: 56 },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  summarySubtitle: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  summaryStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.lg,
    alignSelf: 'stretch',
  },
  summaryStat: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  summaryStatValue: { fontSize: 20, fontWeight: '800', color: colors.primary },
  summaryStatLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  summaryActions: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch' },

  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'stretch',
    minHeight: touch.min,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  ghostButtonText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  retryHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.sm,
  },

  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
