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
  POINTS_PER_CORRECT,
  QUESTIONS_PER_QUIZ,
  SUBJECTS,
  getQuestionsBySubject,
  pickQuizQuestions,
} from '../constants/mockData';
import {
  CONTENT_MAX_WIDTH,
  TABLET_BREAKPOINT,
  colors,
  radius,
  spacing,
} from '../constants/theme';
import { usePlaytime, type RewardOutcome } from '../context/PlaytimeContext';
import type { RootTabParamList, Subject, SubjectInfo } from '../types';

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

  const { totalPoints, availableMinutes, masteredQuestionIds, submitAnswer } =
    usePlaytime();

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
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

  const questions = useMemo(
    () =>
      selectedSubject ? pickQuizQuestions(selectedSubject, masteredRef.current) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSubject, sessionId],
  );
  const currentQuestion = questions[questionIndex];

  // Hiệu ứng nảy nhẹ cho khung phản hồi đúng/sai
  const feedbackAnim = useRef(new Animated.Value(0)).current;

  const playFeedbackAnimation = useCallback(() => {
    feedbackAnim.setValue(0);
    Animated.spring(feedbackAnim, {
      toValue: 1,
      friction: 5,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [feedbackAnim]);

  const resetSession = useCallback(() => {
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setOutcome(null);
    setSummary(EMPTY_SUMMARY);
    setIsFinished(false);
  }, []);

  const handleChooseSubject = useCallback(
    (subject: Subject) => {
      resetSession();
      setSelectedSubject(subject);
      setSessionId((prev) => prev + 1);
    },
    [resetSession],
  );

  const handleBackToSubjects = useCallback(() => {
    resetSession();
    setSelectedSubject(null);
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
      playFeedbackAnimation();
    },
    [currentQuestion, playFeedbackAnimation, selectedAnswer, submitAnswer],
  );

  const handleNextQuestion = useCallback(() => {
    if (questionIndex + 1 >= questions.length) {
      setIsFinished(true);
      return;
    }
    setQuestionIndex((prev) => prev + 1);
    setSelectedAnswer(null);
    setOutcome(null);
  }, [questionIndex, questions.length]);

  const contentStyle = [
    styles.content,
    isTablet && styles.contentTablet,
    { paddingBottom: insets.bottom + spacing.xxl },
  ];

  return (
    <View style={styles.container}>
      <HeaderBar
        totalPoints={totalPoints}
        availableMinutes={availableMinutes}
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
            onChoose={handleChooseSubject}
          />
        ) : isFinished ? (
          <SummaryCard
            subject={selectedSubject}
            summary={summary}
            onRetry={() => handleChooseSubject(selectedSubject)}
            onBack={handleBackToSubjects}
            onGoToGame={() => navigation.navigate('GocGame')}
          />
        ) : currentQuestion ? (
          <View style={styles.quizWrapper}>
            <QuizProgress
              subject={selectedSubject}
              current={questionIndex + 1}
              total={questions.length}
              onBack={handleBackToSubjects}
            />

            <View style={styles.questionCard}>
              <Text style={styles.questionBadge}>
                Câu {questionIndex + 1} · Thưởng {currentQuestion.rewardMinutes} phút
                chơi game
              </Text>
              <Text style={[styles.questionText, isTablet && styles.questionTextTablet]}>
                {currentQuestion.content}
              </Text>
            </View>

            <View style={[styles.optionList, isTablet && styles.optionListTablet]}>
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
            </View>

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
  topInset,
}: {
  totalPoints: number;
  availableMinutes: number;
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
          <Text style={styles.statValue}>{totalPoints}</Text>
          <Text style={styles.statLabel}>điểm</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statEmoji}>🎮</Text>
          <Text style={styles.statValue}>{availableMinutes}</Text>
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
  onChoose,
}: {
  isTablet: boolean;
  masteredQuestionIds: string[];
  onChoose: (subject: Subject) => void;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Chọn môn em muốn học hôm nay</Text>
      <Text style={styles.sectionSubtitle}>
        Mỗi lượt {QUESTIONS_PER_QUIZ} câu rút ngẫu nhiên. Trả lời đúng được +
        {POINTS_PER_CORRECT} điểm và cộng thêm phút chơi game nhé!
      </Text>

      <View style={[styles.subjectGrid, isTablet && styles.subjectGridTablet]}>
        {SUBJECTS.map((subject) => (
          <SubjectCard
            key={subject.key}
            subject={subject}
            isTablet={isTablet}
            masteredQuestionIds={masteredQuestionIds}
            onPress={() => onChoose(subject.key)}
          />
        ))}
      </View>
    </View>
  );
}

function SubjectCard({
  subject,
  isTablet,
  masteredQuestionIds,
  onPress,
}: {
  subject: SubjectInfo;
  isTablet: boolean;
  masteredQuestionIds: string[];
  onPress: () => void;
}) {
  const questions = getQuestionsBySubject(subject.key);
  const masteredCount = questions.filter((question) =>
    masteredQuestionIds.includes(question.id),
  ).length;
  const isCompleted = masteredCount === questions.length;

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
          Mỗi lượt {QUESTIONS_PER_QUIZ} câu · đã chinh phục {masteredCount}/
          {questions.length} câu
        </Text>

        {/* Thanh tiến độ chinh phục cả bộ câu hỏi của môn */}
        <View style={styles.masteryTrack}>
          <View
            style={[
              styles.masteryFill,
              {
                backgroundColor: subject.color,
                width: `${Math.round((masteredCount / questions.length) * 100)}%`,
              },
            ]}
          />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={24} color={subject.color} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Thanh tiến độ bài test                                              */
/* ------------------------------------------------------------------ */

function QuizProgress({
  subject,
  current,
  total,
  onBack,
}: {
  subject: Subject;
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
          accessibilityLabel="Quay lại chọn môn"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backButtonText}>Đổi môn</Text>
        </Pressable>
        <Text style={styles.progressText}>
          {subject} · Câu {current}/{total}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Nút lựa chọn đáp án                                                 */
/* ------------------------------------------------------------------ */

function OptionButton({
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
}

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
  summary,
  onRetry,
  onBack,
  onGoToGame,
}: {
  subject: Subject;
  summary: SessionSummary;
  onRetry: () => void;
  onBack: () => void;
  onGoToGame: () => void;
}) {
  const allCorrect =
    summary.totalQuestions > 0 && summary.correctCount === summary.totalQuestions;

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryEmoji}>{allCorrect ? '🏆' : '🌟'}</Text>
      <Text style={styles.summaryTitle}>
        {allCorrect ? 'Xuất sắc! Đúng hết luôn!' : 'Hoàn thành bài rồi!'}
      </Text>
      <Text style={styles.summarySubtitle}>Môn {subject}</Text>

      <View style={styles.summaryStats}>
        <SummaryStat
          value={`${summary.correctCount}/${summary.totalQuestions}`}
          label="Câu đúng"
        />
        <SummaryStat value={`+${summary.pointsEarned}`} label="Điểm" />
        <SummaryStat value={`+${summary.minutesEarned}`} label="Phút game" />
      </View>

      <Pressable
        onPress={onGoToGame}
        accessibilityRole="button"
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>Sang Góc Game chơi thôi 🎮</Text>
      </Pressable>

      <View style={styles.summaryActions}>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Ionicons name="refresh" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Đề khác</Text>
        </Pressable>

        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Ionicons name="grid-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Chọn môn khác</Text>
        </Pressable>
      </View>
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
    borderRadius: radius.lg,
    borderWidth: 2,
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
    height: 10,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },

  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
    marginBottom: spacing.sm,
  },
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
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 60,
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    alignSelf: 'stretch',
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
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '700', fontSize: 14 },

  // Tổng kết
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
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

  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
