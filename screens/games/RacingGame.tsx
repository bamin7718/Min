import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { getCurriculum, totalWeeks } from '../../constants/curriculum';
import { colors, elevation, radius, spacing, TABLET_BREAKPOINT } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { usePlaytime } from '../../context/PlaytimeContext';
import { generateQuizForWeek } from '../../lib/quizEngine';
import { playGameSound } from '../../lib/gameSound';
import { DEFAULT_GRADE, type Question, type Subject } from '../../types';
import GameShell from './GameShell';
import {
  advanceRace,
  applyAnswer,
  carOf,
  createRace,
  EFFECT_LABEL,
  FAST_ANSWER_MS,
  raceSnapshot,
  TRACK_LENGTH,
  type CarId,
  type RaceFrame,
  type RaceMode,
  type RaceState,
} from './racingLogic';

/** Môn có ngân hàng câu hỏi theo tuần — Tiếng Anh chưa có nên không đua được */
const RACE_SUBJECTS: Subject[] = ['Toán', 'Tiếng Việt'];

type Screen = 'mode' | 'setup' | 'race' | 'result';

/** Câu hỏi đang hiển thị cho một tay đua, kèm mốc thời gian bắt đầu nghĩ */
interface Prompt {
  question: Question;
  startedAt: number;
  /** Chỉ số phương án vừa bấm, để tô màu đúng/sai trước khi sang câu mới */
  picked: number | null;
}

/* ------------------------------------------------------------------ */
/* Thanh tiến trình của một xe                                         */
/* ------------------------------------------------------------------ */

const TrackBar = React.memo(function TrackBar({
  name,
  emoji,
  progress,
  remaining,
  effect,
  streak,
  highlight,
}: {
  name: string;
  emoji: string;
  progress: number;
  remaining: number;
  effect: keyof typeof EFFECT_LABEL;
  streak: number;
  highlight: boolean;
}) {
  return (
    <View style={styles.trackRow}>
      <View style={styles.trackHead}>
        <Text style={[styles.trackName, highlight && styles.trackNameMe]} numberOfLines={1}>
          {emoji} {name}
        </Text>
        {streak >= 2 && <Text style={styles.streak}>🔥 chuỗi {streak}</Text>}
        <Text style={styles.trackRemaining}>còn {remaining}m</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
        {/* Xe chạy dọc theo thanh; kẹp trong khoảng 0-92% để không tràn ra ngoài */}
        <Text style={[styles.trackCar, { left: `${Math.min(92, progress * 92)}%` }]}>
          {emoji}
        </Text>
        <Text style={styles.trackFlag}>🏁</Text>
      </View>

      {effect !== 'none' && <Text style={styles.effectLabel}>{EFFECT_LABEL[effect]}</Text>}
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Khung câu hỏi của một tay đua                                       */
/* ------------------------------------------------------------------ */

function QuestionPanel({
  title,
  prompt,
  compact,
  disabled,
  onAnswer,
}: {
  title: string;
  prompt: Prompt | null;
  /** Chế độ 2 người: hai khung chia đôi màn hình nên chữ phải nhỏ lại */
  compact: boolean;
  disabled: boolean;
  onAnswer: (index: number) => void;
}) {
  if (!prompt) {
    return (
      <View style={[styles.panel, compact && styles.panelCompact]}>
        <Text style={styles.panelTitle}>{title}</Text>
        <Text style={styles.panelEmpty}>Đang lấy câu hỏi...</Text>
      </View>
    );
  }

  const { question, picked } = prompt;

  return (
    <View style={[styles.panel, compact && styles.panelCompact]}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>{title}</Text>
        {question.skill ? <Text style={styles.panelSkill}>{question.skill}</Text> : null}
      </View>

      {question.passage ? (
        <Text style={[styles.passage, compact && styles.passageCompact]} numberOfLines={compact ? 3 : 6}>
          {question.passage}
        </Text>
      ) : null}

      <Text style={[styles.questionText, compact && styles.questionTextCompact]}>
        {question.content}
      </Text>

      <View style={styles.answerGrid}>
        {question.options.map((option, index) => {
          const isPicked = picked === index;
          const isRight = index === question.correctAnswer;
          const showResult = picked !== null;
          return (
            <Pressable
              key={`${question.id}-${index}`}
              onPress={() => onAnswer(index)}
              disabled={disabled || showResult}
              accessibilityRole="button"
              accessibilityLabel={`${title} đáp án ${'ABCD'[index]}: ${option}`}
              style={({ pressed }) => [
                styles.answer,
                compact && styles.answerCompact,
                showResult && isRight && styles.answerRight,
                showResult && isPicked && !isRight && styles.answerWrong,
                pressed && !showResult && styles.pressed,
              ]}
            >
              <Text style={styles.answerKey}>{'ABCD'[index]}</Text>
              <Text
                style={[styles.answerText, compact && styles.answerTextCompact]}
                numberOfLines={compact ? 2 : 3}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Màn hình chính                                                      */
/* ------------------------------------------------------------------ */

export default function RacingGame({ onExit }: { onExit: () => void }) {
  const { isPlaying, submitAnswer } = usePlaytime();
  /**
   * Câu hỏi trong trò đua lấy từ lộ trình của CHÍNH khối lớp học sinh đang học.
   * Không cho chọn lớp ở đây: đây là game, không phải chỗ đổi hồ sơ.
   */
  const { session } = useAuth();
  const grade = session?.grade ?? DEFAULT_GRADE;
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  const [screen, setScreen] = useState<Screen>('mode');
  const [mode, setMode] = useState<RaceMode>('pve');
  const [subject, setSubject] = useState<Subject>('Toán');
  const [week, setWeek] = useState(1);

  const [frame, setFrame] = useState<RaceFrame | null>(null);
  const [prompts, setPrompts] = useState<Record<'p1' | 'p2', Prompt | null>>({
    p1: null,
    p2: null,
  });
  const [minutesEarned, setMinutesEarned] = useState(0);

  const raceRef = useRef<RaceState | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  /** Câu hỏi đã dùng, để không hỏi lại ngay câu vừa xong */
  const usedRef = useRef<string[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) clearTimeout(timer);
    timersRef.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  /** Rút một câu mới cho tuần đang chọn */
  const drawQuestion = useCallback((): Question | null => {
    const drawn = generateQuizForWeek(grade, subject, week, usedRef.current, 1);
    if (drawn && drawn.questions.length > 0) {
      usedRef.current = [...usedRef.current, drawn.questions[0].id];
      return drawn.questions[0];
    }
    // Hết câu chưa dùng thì bắt đầu lại vòng mới
    usedRef.current = [];
    const fresh = generateQuizForWeek(grade, subject, week, [], 1);
    return fresh?.questions[0] ?? null;
  }, [grade, subject, week]);

  const nextPrompt = useCallback(
    (who: 'p1' | 'p2') => {
      const question = drawQuestion();
      setPrompts((prev) => ({
        ...prev,
        [who]: question ? { question, startedAt: Date.now(), picked: null } : null,
      }));
    },
    [drawQuestion],
  );

  const startRace = useCallback(() => {
    clearTimers();
    usedRef.current = [];
    raceRef.current = createRace(mode, { seed: Date.now() % 2147483647 });
    setFrame(raceSnapshot(raceRef.current));
    setMinutesEarned(0);

    const first = drawQuestion();
    const second = mode === 'pvp' ? drawQuestion() : null;
    setPrompts({
      p1: first ? { question: first, startedAt: Date.now(), picked: null } : null,
      p2: second ? { question: second, startedAt: Date.now(), picked: null } : null,
    });
    setScreen('race');
  }, [clearTimers, drawQuestion, mode]);

  // Vòng lặp đua — chỉ chạy khi đồng hồ giờ chơi đang đếm
  useEffect(() => {
    if (!isPlaying || screen !== 'race' || !raceRef.current) return;

    lastTimeRef.current = Date.now();
    const step = () => {
      const race = raceRef.current;
      if (!race) return;

      const now = Date.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      advanceRace(race, dt);
      setFrame(raceSnapshot(race));

      if (race.status === 'finished') {
        playGameSound('wave');
        setScreen('result');
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying, screen]);

  const handleAnswer = useCallback(
    (who: 'p1' | 'p2', index: number) => {
      const race = raceRef.current;
      const prompt = prompts[who];
      if (!race || !prompt || prompt.picked !== null || race.status !== 'racing') return;

      const elapsedMs = Date.now() - prompt.startedAt;
      const isCorrect = index === prompt.question.correctAnswer;

      applyAnswer(race, who as CarId, isCorrect, elapsedMs);
      playGameSound(isCorrect ? (elapsedMs < FAST_ANSWER_MS ? 'powerup' : 'gold') : 'hurt');

      // Trả lời đúng vẫn được cộng điểm và phút chơi game như khi làm bài
      if (isCorrect) {
        const result = submitAnswer(prompt.question, index);
        if (result.minutesEarned > 0) {
          setMinutesEarned((prev) => prev + result.minutesEarned);
        }
      }

      setPrompts((prev) => ({ ...prev, [who]: { ...prompt, picked: index } }));
      setFrame(raceSnapshot(race));

      // Cho học sinh nhìn đáp án đúng một nhịp rồi mới sang câu mới
      const timer = setTimeout(() => nextPrompt(who), 900);
      timersRef.current.push(timer);
    },
    [nextPrompt, prompts, submitAnswer],
  );

  const weeks = useMemo(() => getCurriculum(grade, subject) ?? [], [grade, subject]);
  const weekTitle = weeks.find((w) => w.weekNumber === week)?.title ?? '';

  const me = frame ? frame.cars.find((car) => car.id === 'p1') : undefined;
  const rival = frame ? frame.cars.find((car) => car.id !== 'p1') : undefined;

  /* ---------------- Chọn chế độ ---------------- */
  if (screen === 'mode') {
    return (
      <GameShell title="Đua Xe Tri Thức" emoji="🏁" color="#B45309" onExit={onExit}>
        <ScrollView contentContainerStyle={styles.setupContent}>
          <Text style={styles.setupTitle}>Chọn chế độ đua</Text>
          <Text style={styles.setupHint}>
            Xe không có nút ga! Trả lời đúng và nhanh thì xe bứt phá, trả lời sai thì xe
            khựng lại. Ai về đích trước sẽ giành cúp vàng 🏆
          </Text>

          {(
            [
              {
                id: 'pve' as RaceMode,
                emoji: '🤖',
                name: 'Đua với Máy',
                desc: 'Một mình thi tốc độ với xe máy tính điều khiển',
              },
              {
                id: 'pvp' as RaceMode,
                emoji: '👫',
                name: 'Đua 2 Người',
                desc: 'Hai bạn cùng chơi trên một máy, màn hình chia đôi',
              },
            ] as const
          ).map((option) => (
            <Pressable
              key={option.id}
              onPress={() => {
                setMode(option.id);
                setScreen('setup');
              }}
              accessibilityRole="button"
              accessibilityLabel={`Chế độ ${option.name}`}
              style={({ pressed }) => [styles.modeCard, pressed && styles.pressed]}
            >
              <Text style={styles.modeEmoji}>{option.emoji}</Text>
              <View style={styles.modeText}>
                <Text style={styles.modeName}>{option.name}</Text>
                <Text style={styles.modeDesc}>{option.desc}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </GameShell>
    );
  }

  /* ---------------- Chọn môn và tuần ---------------- */
  if (screen === 'setup') {
    return (
      <GameShell title="Đua Xe Tri Thức" emoji="🏁" color="#B45309" onExit={onExit}>
        <ScrollView contentContainerStyle={styles.setupContent}>
          <Text style={styles.setupTitle}>Chọn môn và tuần học</Text>
          <Text style={styles.setupHint}>
            Câu hỏi trong trận đua lấy từ đúng tuần em chọn, theo bộ sách Kết nối tri
            thức với cuộc sống.
          </Text>

          <View style={styles.subjectRow}>
            {RACE_SUBJECTS.map((item) => (
              <Pressable
                key={item}
                onPress={() => setSubject(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: subject === item }}
                accessibilityLabel={`Chọn môn ${item}`}
                style={({ pressed }) => [
                  styles.subjectChip,
                  subject === item && styles.subjectChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.subjectText,
                    subject === item && styles.subjectTextActive,
                  ]}
                >
                  {item === 'Toán' ? '🔢' : '📖'} {item}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.setupLabel}>
            Tuần {week}
            {weekTitle ? ` · ${weekTitle}` : ''}
          </Text>
          <View style={styles.weekGrid}>
            {Array.from({ length: totalWeeks(grade, subject) }, (_, i) => i + 1).map((number) => (
              <Pressable
                key={number}
                onPress={() => setWeek(number)}
                accessibilityRole="button"
                accessibilityState={{ selected: week === number }}
                accessibilityLabel={`Chọn tuần ${number}`}
                style={({ pressed }) => [
                  styles.weekChip,
                  isTablet && styles.weekChipTablet,
                  week === number && styles.weekChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.weekText, week === number && styles.weekTextActive]}
                >
                  {number}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={startRace}
            accessibilityRole="button"
            accessibilityLabel="Bắt đầu đua"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>🏁 VÀO ĐUA</Text>
          </Pressable>

          <Pressable
            onPress={() => setScreen('mode')}
            accessibilityRole="button"
            accessibilityLabel="Chọn lại chế độ"
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
          >
            <Text style={styles.ghostButtonText}>← Chọn lại chế độ</Text>
          </Pressable>
        </ScrollView>
      </GameShell>
    );
  }

  /* ---------------- Kết quả ---------------- */
  if (screen === 'result' && frame) {
    const iWon = frame.winner === 'p1';
    const winnerCar = frame.cars.find((car) => car.id === frame.winner);
    return (
      <GameShell title="Đua Xe Tri Thức" emoji="🏁" color="#B45309" onExit={onExit}>
        <ScrollView contentContainerStyle={styles.setupContent}>
          <Text style={styles.resultEmoji}>
            {mode === 'pvp' ? '🏆' : iWon ? '🏆' : '😅'}
          </Text>
          <Text style={styles.resultTitle}>
            {mode === 'pvp'
              ? `${winnerCar?.emoji} ${winnerCar?.name} thắng!`
              : iWon
                ? 'Em đã thắng máy!'
                : 'Máy về đích trước rồi!'}
          </Text>
          <Text style={styles.setupHint}>
            Thời gian: {frame.elapsed.toFixed(1)} giây · Đường đua {frame.trackLength}m
          </Text>

          {frame.cars.map((car) => (
            <View key={car.id} style={styles.resultRow}>
              <Text style={styles.resultName}>
                {car.emoji} {car.name}
                {car.id === frame.winner ? ' 🏆' : ''}
              </Text>
              <Text style={styles.resultStat}>
                {car.correct} đúng · {car.wrong} sai · {Math.round(car.distance)}m
              </Text>
            </View>
          ))}

          {minutesEarned > 0 && (
            <Text style={styles.rewardText}>
              🎮 Em kiếm thêm được {minutesEarned} phút chơi game từ trận đua này!
            </Text>
          )}

          <Pressable
            onPress={startRace}
            accessibilityRole="button"
            accessibilityLabel="Đua lại"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>🔁 ĐUA LẠI</Text>
          </Pressable>
          <Pressable
            onPress={() => setScreen('setup')}
            accessibilityRole="button"
            accessibilityLabel="Đổi môn hoặc tuần"
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
          >
            <Text style={styles.ghostButtonText}>← Đổi môn / tuần</Text>
          </Pressable>
        </ScrollView>
      </GameShell>
    );
  }

  /* ---------------- Đang đua ---------------- */
  return (
    <GameShell
      title="Đua Xe Tri Thức"
      emoji="🏁"
      color="#B45309"
      scoreLabel={me ? `${Math.round(me.distance)}m / ${frame?.trackLength}m` : undefined}
      onExit={onExit}
    >
      <View style={styles.raceRoot}>
        {/* Thanh tiến trình hai xe, luôn ở trên cùng */}
        <View style={styles.tracks}>
          {frame?.cars.map((car) => (
            <TrackBar
              key={car.id}
              name={car.name}
              emoji={car.emoji}
              progress={car.progress}
              remaining={car.remaining}
              effect={car.effect}
              streak={car.streak}
              highlight={car.id === 'p1'}
            />
          ))}
        </View>

        <Text style={styles.raceMeta}>
          {subject} · Tuần {week}
          {weekTitle ? ` · ${weekTitle}` : ''}
        </Text>

        {mode === 'pve' ? (
          <QuestionPanel
            title="Câu hỏi của em"
            prompt={prompts.p1}
            compact={false}
            disabled={!isPlaying}
            onAnswer={(index) => handleAnswer('p1', index)}
          />
        ) : (
          <View style={styles.splitRoot}>
            <QuestionPanel
              title="👫 Người 1"
              prompt={prompts.p1}
              compact
              disabled={!isPlaying}
              onAnswer={(index) => handleAnswer('p1', index)}
            />
            <QuestionPanel
              title="👫 Người 2"
              prompt={prompts.p2}
              compact
              disabled={!isPlaying}
              onAnswer={(index) => handleAnswer('p2', index)}
            />
          </View>
        )}

        {rival && mode === 'pve' && (
          <Text style={styles.rivalHint}>
            🚙 Máy đang ở {Math.round(rival.distance)}m — trả lời nhanh để vượt lên!
          </Text>
        )}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  /* ---- Màn chọn ---- */
  setupContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  setupTitle: { fontSize: 19, fontWeight: '800', color: colors.text },
  setupHint: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  setupLabel: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: spacing.sm },

  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    ...elevation(1),
  },
  modeEmoji: { fontSize: 34 },
  modeText: { flex: 1 },
  modeName: { fontSize: 16, fontWeight: '800', color: colors.text },
  modeDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  subjectRow: { flexDirection: 'row', gap: spacing.sm },
  subjectChip: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  subjectChipActive: { borderColor: '#B45309', backgroundColor: '#FEF3C7' },
  subjectText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  subjectTextActive: { color: '#92400E' },

  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weekChip: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  weekChipTablet: { width: 46, height: 46 },
  weekChipActive: { backgroundColor: '#B45309', borderColor: '#B45309' },
  weekText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  weekTextActive: { color: '#FFFFFF' },

  primaryButton: {
    minHeight: 56,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#B45309',
    marginTop: spacing.sm,
    ...elevation(2),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  ghostButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  ghostButtonText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  pressed: { opacity: 0.7 },

  /* ---- Đường đua ---- */
  raceRoot: { flex: 1, padding: spacing.md, gap: spacing.sm },
  tracks: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...elevation(1),
  },
  trackRow: { gap: 3 },
  trackHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trackName: { flex: 1, fontSize: 12, fontWeight: '800', color: colors.textMuted },
  trackNameMe: { color: '#B45309' },
  streak: { fontSize: 10, fontWeight: '800', color: colors.danger },
  trackRemaining: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  track: {
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FDE68A',
  },
  trackCar: { position: 'absolute', fontSize: 15 },
  trackFlag: { position: 'absolute', right: 3, fontSize: 13 },
  effectLabel: { fontSize: 11, fontWeight: '800', color: '#B45309' },

  raceMeta: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  rivalHint: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },

  /* ---- Khung câu hỏi ---- */
  splitRoot: { flex: 1, gap: spacing.sm },
  panel: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...elevation(1),
  },
  panelCompact: { padding: spacing.sm, gap: 6 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  panelTitle: { flex: 1, fontSize: 12, fontWeight: '800', color: '#B45309' },
  panelSkill: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  panelEmpty: { fontSize: 13, color: colors.textMuted },
  passage: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  passageCompact: { fontSize: 11, lineHeight: 16 },
  questionText: { fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 21 },
  questionTextCompact: { fontSize: 13, lineHeight: 18 },

  answerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  answer: {
    width: '48.5%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
  },
  answerCompact: { minHeight: 40, paddingVertical: 4 },
  answerRight: { backgroundColor: colors.successSoft, borderColor: colors.success },
  answerWrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  answerKey: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  answerText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.text },
  answerTextCompact: { fontSize: 11 },

  /* ---- Kết quả ---- */
  resultEmoji: { fontSize: 44, textAlign: 'center' },
  resultTitle: { fontSize: 19, fontWeight: '800', color: colors.text, textAlign: 'center' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...elevation(1),
  },
  resultName: { fontSize: 14, fontWeight: '800', color: colors.text },
  resultStat: { fontSize: 12, color: colors.textMuted },
  rewardText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.success,
    textAlign: 'center',
  },
});
