import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors, elevation, radius, spacing, touch } from '../../constants/theme';
import { usePlaytime } from '../../context/PlaytimeContext';
import { playGameSound } from '../../lib/gameSound';
import GameShell from './GameShell';
import {
  aiShot,
  ballAt,
  describeShot,
  diveFromTouch,
  flightMs,
  goalBonus,
  goalPraise,
  keeperDecide,
  OUTCOME_LABEL,
  resolveSave,
  resolveShot,
  saveFeedback,
  shotFromSwipe,
  type KeeperDive,
  type KeeperPose,
  type Shot,
  type ShotOutcome,
} from './penaltyLogic';

const TOTAL_SHOTS = 5;
/** Trình độ thủ môn: 0 là đoán bừa, 1 là đoán đúng hướng sút */
const KEEPER_SKILL = 0.45;
/** Trình độ cầu thủ máy khi BÉ làm thủ môn: 0 sút bừa, 1 sút sát góc */
const AI_STRIKER_SKILL = 0.55;
const BALL_SIZE = 26;
/** Cỡ vòng tròn đánh dấu điểm ngắm / điểm đổ người */
const AIM_MARK_SIZE = 26;
/**
 * Thủ môn cao bằng 60% chiều cao khung thành (trước là 78%).
 *
 * Đi cùng việc hạ `KEEPER_REACH_*` trong `penaltyLogic.ts` — thu nhỏ hình mà giữ
 * tầm với thì bé thấy góc trống, sút vào đó, vẫn bị cản bởi một thủ môn tay dài
 * vô hình.
 */
const KEEPER_HEIGHT_RATIO = 0.6;
/** Thời gian máy chạy đà trước khi sút, ở chế độ bé làm thủ môn */
const RUNUP_MS = 900;

/** Hai chế độ chơi, chọn ở màn hình đầu của trò */
type GameMode = 'striker' | 'keeper';

/**
 * `runup` chỉ có ở chế độ bé làm thủ môn: máy đang chạy đà, bé nhìn hướng chân
 * sút để đoán. Các phase còn lại dùng chung cho cả hai chế độ.
 */
type Phase = 'menu' | 'aiming' | 'runup' | 'flying' | 'result' | 'done';

/**
 * Toạ độ ngón tay so với góc trên bên trái của sân.
 *
 * `locationX` là con số cần dùng, nhưng trên bản web nó do react-native-web tính
 * từ `getBoundingClientRect` và trả về `undefined` nếu chưa đo được — lúc đó lấy
 * `pageX` để vẫn còn cái mà vẽ vệt sáng.
 */
function pointOf(event: GestureResponderEvent): { x: number; y: number } {
  const e = event.nativeEvent;
  return {
    x: typeof e.locationX === 'number' ? e.locationX : e.pageX,
    y: typeof e.locationY === 'number' ? e.locationY : e.pageY,
  };
}

/** Một hạt pháo hoa khi ghi bàn */
interface Spark {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const SPARK_COLORS = ['#FDE047', '#F97316', '#F472B6', '#38BDF8', '#4ADE80'];

/* ------------------------------------------------------------------ */
/* Thủ môn hình người                                                  */
/* ------------------------------------------------------------------ */

/**
 * Thủ môn vẽ bằng các View: đầu, thân, hai tay, hai chân, hai găng.
 *
 * Không dùng ảnh sprite vì dự án không kèm tệp ảnh nào, và cũng không dùng SVG
 * vì thêm `react-native-svg` là thay đổi phần native — mọi máy đang cài sẽ phải
 * tải lại APK thay vì nhận bản cập nhật ngầm.
 *
 * Mỗi dáng chỉ khác nhau ở góc quay của thân, tay và chân, nên toàn bộ động tác
 * gọn trong một bảng tra.
 */
const POSES: Record<
  KeeperPose,
  {
    /** Dịch chuyển thân theo tỉ lệ nửa chiều rộng khung thành */
    shiftX: number;
    /** Dịch chuyển theo chiều cao, âm là bật lên */
    shiftY: number;
    bodyRotate: number;
    armLeft: number;
    armRight: number;
    legLeft: number;
    legRight: number;
  }
> = {
  idle: { shiftX: 0, shiftY: 0, bodyRotate: 0, armLeft: -25, armRight: 25, legLeft: -8, legRight: 8 },
  diveLeft: {
    shiftX: -0.72,
    shiftY: 0.1,
    bodyRotate: -68,
    armLeft: -105,
    armRight: -60,
    legLeft: -20,
    legRight: 12,
  },
  diveRight: {
    shiftX: 0.72,
    shiftY: 0.1,
    bodyRotate: 68,
    armLeft: 60,
    armRight: 105,
    legLeft: -12,
    legRight: 20,
  },
  jumpHigh: {
    shiftX: 0,
    shiftY: -0.34,
    bodyRotate: 0,
    armLeft: -160,
    armRight: 160,
    legLeft: -14,
    legRight: 14,
  },
  catchCenter: {
    shiftX: 0,
    shiftY: 0.04,
    bodyRotate: 0,
    armLeft: -70,
    armRight: 70,
    legLeft: -16,
    legRight: 16,
  },
  beaten: {
    shiftX: 0.15,
    shiftY: 0.26,
    bodyRotate: 86,
    armLeft: -30,
    armRight: 20,
    legLeft: -6,
    legRight: 6,
  },
};

const Keeper = React.memo(function Keeper({
  pose,
  /** Chiều cao thủ môn, tính bằng dp */
  height,
  /** Nửa chiều rộng khung thành, để tính biên độ bay người */
  halfGoal,
  /** Nhún nhảy khi đang chờ: 0..1 */
  bounce,
}: {
  pose: KeeperPose;
  height: number;
  halfGoal: number;
  bounce: number;
}) {
  const p = POSES[pose];
  const w = height * 0.42;

  const headR = height * 0.15;
  const bodyH = height * 0.42;
  const armL = height * 0.34;
  const armW = height * 0.1;
  const legL = height * 0.34;
  const legW = height * 0.12;
  const gloveR = height * 0.09;

  // Đang chờ thì nhún nhẹ sang hai bên; bay người thì dùng đúng dáng
  const idleShift = pose === 'idle' ? Math.sin(bounce * Math.PI * 2) * halfGoal * 0.18 : 0;
  const idleLift = pose === 'idle' ? Math.abs(Math.cos(bounce * Math.PI * 2)) * height * 0.03 : 0;

  return (
    <View
      pointerEvents="none"
      accessibilityLabel="Thủ môn"
      style={{
        position: 'absolute',
        width: w,
        height,
        left: -w / 2,
        top: -height,
        transform: [
          { translateX: p.shiftX * halfGoal + idleShift },
          { translateY: p.shiftY * height - idleLift },
          { rotate: `${p.bodyRotate}deg` },
        ],
      }}
    >
      {/* Chân */}
      <View
        style={{
          position: 'absolute',
          left: w * 0.5 - legW / 2,
          top: height - legL,
          width: legW,
          height: legL,
          borderRadius: legW / 2,
          backgroundColor: '#1E293B',
          transform: [{ rotate: `${p.legLeft}deg` }],
          transformOrigin: 'top center',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: w * 0.5 - legW / 2,
          top: height - legL,
          width: legW,
          height: legL,
          borderRadius: legW / 2,
          backgroundColor: '#0F172A',
          transform: [{ rotate: `${p.legRight}deg` }],
          transformOrigin: 'top center',
        }}
      />

      {/* Thân: áo thủ môn màu rực */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: headR * 2 * 0.85,
          width: w,
          height: bodyH,
          borderRadius: w * 0.34,
          backgroundColor: '#F59E0B',
          borderWidth: 2,
          borderColor: '#B45309',
        }}
      >
        {/* Số áo */}
        <Text
          style={{
            position: 'absolute',
            alignSelf: 'center',
            top: bodyH * 0.18,
            fontSize: bodyH * 0.42,
            fontWeight: '800',
            color: '#FFFFFF',
          }}
        >
          1
        </Text>
      </View>

      {/* Tay */}
      <View
        style={{
          position: 'absolute',
          left: -armW * 0.2,
          top: headR * 2 * 0.95,
          width: armW,
          height: armL,
          borderRadius: armW / 2,
          backgroundColor: '#FBBF24',
          transform: [{ rotate: `${p.armLeft}deg` }],
          transformOrigin: 'top center',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: armW / 2 - gloveR,
            top: armL - gloveR,
            width: gloveR * 2,
            height: gloveR * 2,
            borderRadius: gloveR,
            backgroundColor: '#22C55E',
          }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          left: w - armW * 0.8,
          top: headR * 2 * 0.95,
          width: armW,
          height: armL,
          borderRadius: armW / 2,
          backgroundColor: '#FBBF24',
          transform: [{ rotate: `${p.armRight}deg` }],
          transformOrigin: 'top center',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: armW / 2 - gloveR,
            top: armL - gloveR,
            width: gloveR * 2,
            height: gloveR * 2,
            borderRadius: gloveR,
            backgroundColor: '#22C55E',
          }}
        />
      </View>

      {/* Đầu */}
      <View
        style={{
          position: 'absolute',
          left: w / 2 - headR,
          top: 0,
          width: headR * 2,
          height: headR * 2,
          borderRadius: headR,
          backgroundColor: '#FCD9B6',
          borderWidth: 2,
          borderColor: '#D8A87C',
        }}
      >
        {/* Tóc */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            height: headR * 0.8,
            borderTopLeftRadius: headR,
            borderTopRightRadius: headR,
            backgroundColor: '#3F2A17',
          }}
        />
      </View>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Màn hình chính                                                      */
/* ------------------------------------------------------------------ */

export default function PenaltyGame({ onExit }: { onExit: () => void }) {
  const { isPlaying } = usePlaytime();
  const windowSize = useWindowDimensions();

  const [area, setArea] = useState(() => ({
    width: Math.max(260, windowSize.width - spacing.md * 2),
    height: Math.max(280, Math.min(460, windowSize.height * 0.52)),
  }));

  /** Bắt đầu ở màn hình chọn chế độ, không vào thẳng một chế độ nào */
  const [phase, setPhase] = useState<Phase>('menu');
  const [mode, setMode] = useState<GameMode>('striker');
  const [shotNumber, setShotNumber] = useState(1);
  const [goals, setGoals] = useState(0);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  /** Số quả bé cản được, chỉ dùng ở chế độ làm thủ môn */
  const [saves, setSaves] = useState(0);
  const [bestSaves, setBestSaves] = useState(0);
  /** Cú đổ người của bé trong lượt đang bay; `null` là chưa kịp phản ứng */
  const [playerDive, setPlayerDive] = useState<KeeperDive | null>(null);
  /** Lưới rung khi bóng vào: 0 là yên, giảm dần về 0 sau mỗi bàn */
  const [netShake, setNetShake] = useState(0);
  /** Điểm thưởng và lời khen của bàn thắng vừa ghi */
  const [reward, setReward] = useState<{ points: number; praise: string } | null>(null);
  const [outcome, setOutcome] = useState<ShotOutcome | null>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [keeperPose, setKeeperPose] = useState<KeeperPose>('idle');
  const [hint, setHint] = useState<string | null>(null);

  /** Đường vuốt đang vẽ, toạ độ trong khung chơi */
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);
  /** Vị trí bóng: x là -1..1 theo khung thành, progress 0..1, lift 0..1 */
  const [ball, setBall] = useState({ x: 0, progress: 0, lift: 0 });
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [bounce, setBounce] = useState(0);

  const rafRef = useRef<number | null>(null);
  const swipeRef = useRef<{ points: { x: number; y: number }[]; startedAt: number }>({
    points: [],
    startedAt: 0,
  });
  const areaRef = useRef(area);
  areaRef.current = area;
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  /**
   * Cú đổ người đọc qua ref, không qua state.
   *
   * Vòng lặp bay bóng cần giá trị MỚI NHẤT ở đúng khung hình bé chạm; đọc state
   * trong closure của `tick` sẽ lấy giá trị của lúc bắt đầu lượt, tức luôn `null`.
   */
  const playerDiveRef = useRef<KeeperDive | null>(null);
  const goalRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const nextSparkId = useRef(1);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setArea((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height },
    );
  }, []);

  /* ---------------- Kích thước khung thành ---------------- */
  const goal = useMemo(() => {
    const width = area.width * 0.78;
    const height = area.height * 0.36;
    return {
      left: (area.width - width) / 2,
      top: area.height * 0.08,
      width,
      height,
      centerX: area.width / 2,
    };
  }, [area]);

  const spotY = area.height * 0.86;
  goalRef.current = goal;

  /* ---------------- Lưới rung sau bàn thắng ---------------- */
  // Vòng lặp chỉ khởi động lại khi CHUYỂN từ yên sang rung, không phải mỗi khung
  // hình — nên dependency là một cờ boolean, không phải chính biên độ.
  const netShaking = netShake > 0;
  useEffect(() => {
    if (!netShaking) return;
    let raf: number;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      // Tắt dần theo hàm mũ: rung mạnh lúc đầu rồi lịm đi, giống lưới thật
      setNetShake((prev) => (prev < 0.02 ? 0 : prev * Math.pow(0.02, dt)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [netShaking]);

  /* ---------------- Nhún nhảy khi chờ ---------------- */
  useEffect(() => {
    if (!isPlaying || phase !== 'aiming') return;
    let raf: number;
    const start = Date.now();
    const tick = () => {
      setBounce(((Date.now() - start) / 1600) % 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, phase]);

  /* ---------------- Hạt pháo hoa ---------------- */
  useEffect(() => {
    if (sparks.length === 0) return;
    let raf: number;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      // Đồng hồ dừng thì pháo hoa treo giữa trời. Vẫn cập nhật `last` để lúc chơi
      // tiếp không bị một bước nhảy bằng cả quãng thời gian tạm dừng.
      if (!playingRef.current) {
        raf = requestAnimationFrame(tick);
        return;
      }
      setSparks((prev) =>
        prev
          .map((s) => ({
            ...s,
            x: s.x + s.vx * dt,
            // Trọng lực để hạt rơi xuống như pháo hoa thật
            y: s.y + s.vy * dt,
            vy: s.vy + 260 * dt,
            life: s.life - dt,
          }))
          .filter((s) => s.life > 0),
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sparks.length]);

  const burstFireworks = useCallback((x: number, y: number) => {
    const created: Spark[] = [];
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2;
      const speed = 90 + Math.random() * 130;
      created.push({
        id: nextSparkId.current++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0.7 + Math.random() * 0.4,
        color: SPARK_COLORS[i % SPARK_COLORS.length],
      });
    }
    setSparks((prev) => [...prev, ...created]);
  }, []);

  /* ---------------- Sút bóng ---------------- */
  const takeShot = useCallback(
    (taken: Shot) => {
      if (!taken.valid) {
        setHint(describeShot(taken));
        return;
      }

      const dive = keeperDecide(taken, KEEPER_SKILL, Math.random);
      const resolution = resolveShot(taken, dive);

      setShot(taken);
      setHint(describeShot(taken));
      setPhase('flying');
      playGameSound('kick');

      const duration = flightMs(taken);
      // Thủ môn bay người khi bóng đã đi được khoảng một phần ba đường
      let dived = false;
      // Đếm thời gian bay bằng cách CỘNG DỒN từng khung hình thay vì lấy mốc
      // Date.now() ban đầu: khi đồng hồ giờ chơi tạm dừng, quả sút phải đứng lại
      // cùng nó, chứ không được bay tiếp rồi vào lưới ở sau lớp che.
      let elapsed = 0;
      let last = Date.now();

      const tick = () => {
        const now = Date.now();
        const frame = now - last;
        last = now;
        if (playingRef.current) elapsed += frame;

        const t = Math.min(1, elapsed / duration);
        setBall(ballAt(taken, t));

        if (!dived && t > 0.3) {
          dived = true;
          setKeeperPose(dive.pose);
        }

        if (t >= 1) {
          setKeeperPose(resolution.keeperPose);
          setOutcome(resolution.outcome);
          setPhase('result');

          if (resolution.outcome === 'goal') {
            const bonus = goalBonus(taken);
            setGoals((prev) => prev + 1);
            setScore((prev) => prev + bonus);
            setReward({ points: bonus, praise: goalPraise(taken) });
            playGameSound('cheer');
            setNetShake(1);
            burstFireworks(
              goal.centerX + taken.aimX * (goal.width / 2),
              goal.top + (1 - Math.min(1, taken.aimY)) * goal.height,
            );
          } else if (resolution.outcome === 'saved') {
            setReward(null);
            playGameSound('save');
          } else {
            setReward(null);
            playGameSound('hurt');
          }
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [burstFireworks, goal],
  );

  /* ---------------- Chế độ BÉ LÀM THỦ MÔN: máy sút, bé cản ---------------- */
  const facePenalty = useCallback(() => {
    const taken = aiShot(Math.random, AI_STRIKER_SKILL);
    setShot(taken);
    setPlayerDive(null);
    playerDiveRef.current = null;
    setKeeperPose('idle');
    setHint('Chạm về phía bóng để đổ người!');
    setPhase('flying');
    playGameSound('kick');

    const duration = flightMs(taken);
    let elapsed = 0;
    let last = Date.now();
    /** Đã chuyển dáng thủ môn theo cú chạm của bé chưa */
    let posed = false;

    const tick = () => {
      const now = Date.now();
      const frame = now - last;
      last = now;
      if (playingRef.current) elapsed += frame;

      const t = Math.min(1, elapsed / duration);
      setBall(ballAt(taken, t));

      // Bé chạm lúc nào thì thủ môn đổ người ngay lúc đó
      const dive = playerDiveRef.current;
      if (!posed && dive) {
        posed = true;
        setKeeperPose(dive.pose);
      }

      if (t >= 1) {
        /*
         * Không chạm kịp thì coi như thủ môn đứng nguyên giữa khung, sát đất —
         * chứ không phải "trượt tự động". Đứng im vẫn cản được quả sút vào giữa,
         * đúng như ngoài sân.
         */
        const finalDive: KeeperDive =
          dive ?? { x: 0, y: 0.12, pose: 'catchCenter' };
        const result = resolveSave(taken, finalDive);

        const outOfFrame = taken.aimY > 1 || Math.abs(taken.aimX) > 1;
        setKeeperPose(result.saved ? finalDive.pose : 'beaten');
        setOutcome(result.saved ? 'saved' : outOfFrame ? 'over' : 'goal');
        setHint(saveFeedback(result));
        setPhase('result');

        if (result.saved) {
          // Cản càng sát tay càng nhiều điểm
          const bonus = 100 + Math.round((1 - Math.min(1, result.missBy)) * 80);
          setSaves((prev) => prev + 1);
          setScore((prev) => prev + bonus);
          setReward({ points: bonus, praise: saveFeedback(result) });
          playGameSound('save');
        } else {
          setReward(null);
          if (outOfFrame) {
            playGameSound('hurt');
          } else {
            // Máy ghi bàn: lưới rung và khán giả reo, nhưng không có pháo hoa
            setNetShake(1);
            playGameSound('cheer');
          }
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  /**
   * Máy chạy đà rồi sút.
   *
   * Chờ `RUNUP_MS` để bé kịp nhìn và chuẩn bị; không có nhịp này thì bóng bay
   * ngay lúc lượt bắt đầu và bé không bao giờ phản ứng nổi.
   */
  useEffect(() => {
    if (mode !== 'keeper' || phase !== 'runup' || !isPlaying) return;
    const timer = setTimeout(facePenalty, RUNUP_MS);
    return () => clearTimeout(timer);
  }, [facePenalty, isPlaying, mode, phase]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  /* ---------------- Nhận thao tác vuốt ---------------- */
  const responder = useMemo(
    () =>
      PanResponder.create({
        /*
         * Hai chế độ nhận thao tác ở hai phase khác nhau:
         *  - Sút phạt: lúc `aiming`, bé vuốt để sút.
         *  - Làm thủ môn: lúc `flying`, bé chạm để đổ người trong khi bóng đang bay.
         */
        onStartShouldSetPanResponder: () =>
          playingRef.current &&
          (modeRef.current === 'striker'
            ? phaseRef.current === 'aiming'
            : phaseRef.current === 'flying'),
        onMoveShouldSetPanResponder: () =>
          playingRef.current &&
          (modeRef.current === 'striker'
            ? phaseRef.current === 'aiming'
            : phaseRef.current === 'flying'),
        onPanResponderGrant: (event) => {
          const point = pointOf(event);

          if (modeRef.current === 'keeper') {
            // Chạm là đổ người ngay, không chờ nhấc ngón: cú sút chỉ bay 400-700ms
            const dive = diveFromTouch(point.x, point.y, goalRef.current);
            playerDiveRef.current = dive;
            setPlayerDive(dive);
            setTrail([point]);
            return;
          }

          swipeRef.current = { points: [point], startedAt: Date.now() };
          setTrail([point]);
          setHint(null);
        },
        onPanResponderMove: (event) => {
          const point = pointOf(event);

          if (modeRef.current === 'keeper') {
            // Vuốt thì lấy điểm cuối, cho bé sửa hướng đổ người khi bóng đổi hướng
            const dive = diveFromTouch(point.x, point.y, goalRef.current);
            playerDiveRef.current = dive;
            setPlayerDive(dive);
            setTrail([point]);
            return;
          }

          const points = swipeRef.current.points;
          points.push(point);
          // Chỉ giữ 14 điểm cuối: vệt sáng dài hơn thế vừa rối vừa tốn công vẽ
          if (points.length > 14) points.splice(0, points.length - 14);
          setTrail([...points]);
        },
        onPanResponderRelease: () => {
          if (modeRef.current === 'keeper') {
            setTrail([]);
            return;
          }

          const { points, startedAt } = swipeRef.current;
          setTrail([]);
          if (points.length < 2) return;

          const first = points[0];
          const last = points[points.length - 1];
          const mid = points[Math.floor(points.length / 2)];
          takeShot(
            shotFromSwipe({
              startX: first.x,
              startY: first.y,
              midX: mid.x,
              midY: mid.y,
              endX: last.x,
              endY: last.y,
              durationMs: Date.now() - startedAt,
              fieldWidth: areaRef.current.width,
              fieldHeight: areaRef.current.height,
            }),
          );
        },
        onPanResponderTerminate: () => setTrail([]),
      }),
    [takeShot],
  );

  /* ---------------- Lượt tiếp theo / chơi lại / đổi chế độ ---------------- */

  /** Xoá sạch trạng thái của một lượt, dùng chung cho cả hai chế độ */
  const clearRound = useCallback(() => {
    setReward(null);
    setOutcome(null);
    setShot(null);
    setKeeperPose('idle');
    setBall({ x: 0, progress: 0, lift: 0 });
    setPlayerDive(null);
    playerDiveRef.current = null;
    setNetShake(0);
    setHint(null);
  }, []);

  /** Phase mở đầu một lượt: bé sút thì chờ vuốt, bé bắt thì máy chạy đà */
  const openingPhase = useCallback(
    (forMode: GameMode): Phase => (forMode === 'striker' ? 'aiming' : 'runup'),
    [],
  );

  const nextShot = useCallback(() => {
    if (shotNumber >= TOTAL_SHOTS) {
      setBest((prev) => Math.max(prev, goals));
      setBestScore((prev) => Math.max(prev, score));
      setBestSaves((prev) => Math.max(prev, saves));
      setPhase('done');
      return;
    }
    setShotNumber((prev) => prev + 1);
    clearRound();
    setPhase(openingPhase(mode));
  }, [clearRound, goals, mode, openingPhase, saves, score, shotNumber]);

  const restart = useCallback(() => {
    setBest((prev) => Math.max(prev, goals));
    setBestScore((prev) => Math.max(prev, score));
    setBestSaves((prev) => Math.max(prev, saves));
    setShotNumber(1);
    setGoals(0);
    setSaves(0);
    setScore(0);
    setSparks([]);
    clearRound();
    setPhase(openingPhase(mode));
  }, [clearRound, goals, mode, openingPhase, saves, score]);

  /** Bắt đầu một chế độ từ màn hình chọn */
  const startMode = useCallback(
    (chosen: GameMode) => {
      setMode(chosen);
      modeRef.current = chosen;
      setShotNumber(1);
      setGoals(0);
      setSaves(0);
      setScore(0);
      setSparks([]);
      clearRound();
      setPhase(openingPhase(chosen));
    },
    [clearRound, openingPhase],
  );

  const backToMenu = useCallback(() => {
    setBest((prev) => Math.max(prev, goals));
    setBestScore((prev) => Math.max(prev, score));
    setBestSaves((prev) => Math.max(prev, saves));
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setSparks([]);
    clearRound();
    setPhase('menu');
  }, [clearRound, goals, saves, score]);

  /* ---------------- Vị trí bóng trên màn hình ---------------- */
  const ballScreen = useMemo(() => {
    // progress 0 là chỗ đặt bóng, 1 là vạch cầu môn
    const goalLineY = goal.top + goal.height;
    const y = spotY + (goalLineY - spotY) * ball.progress - ball.lift * goal.height;
    const x = goal.centerX + ball.x * (goal.width / 2) * ball.progress;
    // Bóng nhỏ dần khi bay xa cho cảm giác chiều sâu
    const size = BALL_SIZE * (1 - ball.progress * 0.3);
    return { x, y, size };
  }, [ball, goal, spotY]);

  /* ---------------- Quỹ đạo xem trước khi đang vuốt ---------------- */
  /**
   * Đường bóng DỰ KIẾN của cú vuốt đang thực hiện, vẽ thành một chuỗi điểm mờ.
   *
   * Tính bằng chính `shotFromSwipe` + `ballAt` mà cú sút thật sẽ dùng, nên cái bé
   * thấy đúng là cái sẽ xảy ra — nếu vẽ bằng một công thức xấp xỉ riêng thì
   * đường xem trước và đường bay thật sẽ lệch nhau, và bé học sai cách ngắm.
   *
   * Chỉ có ở chế độ sút phạt; ở chế độ làm thủ môn thì vẽ đường này là chỉ điểm
   * cho bé biết trước bóng đi đâu, mất hết cái hay.
   */
  const preview = useMemo(() => {
    if (mode !== 'striker' || phase !== 'aiming' || trail.length < 2) return null;

    const first = trail[0];
    const last = trail[trail.length - 1];
    const mid = trail[Math.floor(trail.length / 2)];
    const guess = shotFromSwipe({
      startX: first.x,
      startY: first.y,
      midX: mid.x,
      midY: mid.y,
      endX: last.x,
      endY: last.y,
      // Chưa nhấc ngón nên chưa biết tổng thời gian; lấy mốc đã trôi tới giờ
      durationMs: Math.max(40, Date.now() - swipeRef.current.startedAt),
      fieldWidth: area.width,
      fieldHeight: area.height,
    });
    if (!guess.valid) return null;

    const goalLineY = goal.top + goal.height;
    const points = Array.from({ length: 14 }, (_, i) => {
      const t = (i + 1) / 14;
      const at = ballAt(guess, t);
      return {
        x: goal.centerX + at.x * (goal.width / 2) * at.progress,
        y: spotY + (goalLineY - spotY) * at.progress - at.lift * goal.height,
      };
    });
    return { points, shot: guess };
  }, [area, goal, mode, phase, spotY, trail]);

  /* ---------------- Nhãn điểm theo chế độ ---------------- */
  const scoreLabel =
    mode === 'striker'
      ? `Lượt ${Math.min(shotNumber, TOTAL_SHOTS)}/${TOTAL_SHOTS}  ·  ⚽ ${goals} bàn  ·  ⭐ ${score} điểm`
      : `Lượt ${Math.min(shotNumber, TOTAL_SHOTS)}/${TOTAL_SHOTS}  ·  🧤 ${saves} lần cản  ·  ⭐ ${score} điểm`;

  /* ---------------- Màn hình chọn chế độ ---------------- */
  if (phase === 'menu') {
    return (
      <GameShell
        title="Đá Penalty"
        emoji="⚽"
        color={colors.success}
        scoreLabel="Chọn chế độ chơi"
        onExit={onExit}
      >
        <View style={styles.menuWrap}>
          <Text style={styles.menuTitle}>Con muốn chơi kiểu nào?</Text>

          <Pressable
            onPress={() => startMode('striker')}
            accessibilityRole="button"
            accessibilityLabel="Chơi chế độ sút phạt penalty"
            style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardOn]}
          >
            <Text style={styles.modeEmoji}>⚽</Text>
            <View style={styles.modeTextGroup}>
              <Text style={styles.modeName}>Sút phạt penalty</Text>
              <Text style={styles.modeDesc}>
                Vuốt từ quả bóng lên khung thành. Vuốt nhanh thì bóng căng, vuốt
                cong thì bóng xoáy. Nhắm vào góc để thủ môn không với tới.
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => startMode('keeper')}
            accessibilityRole="button"
            accessibilityLabel="Chơi chế độ bé làm thủ môn"
            style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardOn]}
          >
            <Text style={styles.modeEmoji}>🧤</Text>
            <View style={styles.modeTextGroup}>
              <Text style={styles.modeName}>Bé làm thủ môn</Text>
              <Text style={styles.modeDesc}>
                Máy chạy đà rồi sút vào các góc. Chạm nhanh về phía bóng đang bay
                để đổ người cản phá.
              </Text>
            </View>
          </Pressable>

          {(best > 0 || bestSaves > 0) && (
            <Text style={styles.menuBest}>
              Kỷ lục: ⚽ {best} bàn · 🧤 {bestSaves} lần cản · ⭐ {bestScore} điểm
            </Text>
          )}
        </View>
      </GameShell>
    );
  }

  return (
    <GameShell
      title="Đá Penalty"
      emoji="⚽"
      color={colors.success}
      scoreLabel={scoreLabel}
      onExit={onExit}
    >
      <View style={styles.container}>
        <View
          style={styles.field}
          onLayout={handleLayout}
          accessibilityLabel={
            mode === 'striker'
              ? 'Sân bóng: vuốt từ quả bóng lên khung thành để sút'
              : 'Sân bóng: chạm về phía bóng đang bay để đổ người cản phá'
          }
          {...responder.panHandlers}
        >
          {/* Cỏ và vạch vôi */}
          <View style={[styles.grassDark, { top: goal.top + goal.height }]} />
          <View style={[styles.penaltyArc, { top: goal.top + goal.height + 6 }]} />

          {/* Khung thành. Lưới rung thì chỉ dịch phần LƯỚI, không dịch cả cột. */}
          <View
            style={[
              styles.goal,
              { left: goal.left, top: goal.top, width: goal.width, height: goal.height },
            ]}
          >
            <View
              style={[
                styles.net,
                netShake > 0 && {
                  transform: [
                    // Dao động tắt dần: tần số cao, biên độ theo `netShake`
                    { translateX: Math.sin(netShake * 34) * netShake * 7 },
                    { translateY: Math.cos(netShake * 27) * netShake * 4 },
                  ],
                },
              ]}
            />
          </View>

          {/* Thủ môn đứng ở vạch vôi, giữa khung thành */}
          <View
            style={{
              position: 'absolute',
              left: goal.centerX,
              top: goal.top + goal.height,
            }}
          >
            <Keeper
              pose={keeperPose}
              height={goal.height * KEEPER_HEIGHT_RATIO}
              halfGoal={goal.width / 2}
              bounce={bounce}
            />
          </View>

          {/* Chấm phạt đền */}
          <View style={[styles.spot, { top: spotY + BALL_SIZE * 0.6 }]} />

          {/* Bóng */}
          <Text
            style={[
              styles.ball,
              {
                left: ballScreen.x - ballScreen.size / 2,
                top: ballScreen.y - ballScreen.size / 2,
                fontSize: ballScreen.size,
              },
            ]}
          >
            ⚽
          </Text>

          {/* Quỹ đạo dự kiến của cú vuốt đang thực hiện */}
          {preview?.points.map((point, index) => {
            const t = (index + 1) / preview.points.length;
            const size = 10 - t * 5;
            return (
              <View
                key={`aim-${index}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: point.x - size / 2,
                  top: point.y - size / 2,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: '#FFFFFF',
                  opacity: 0.28 + t * 0.5,
                }}
              />
            );
          })}

          {/* Mũi nhắm ở điểm bóng sẽ tới trên khung thành */}
          {preview && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left:
                  goal.centerX + preview.shot.aimX * (goal.width / 2) - AIM_MARK_SIZE / 2,
                top:
                  goal.top +
                  (1 - Math.min(1, preview.shot.aimY)) * goal.height -
                  AIM_MARK_SIZE / 2,
                width: AIM_MARK_SIZE,
                height: AIM_MARK_SIZE,
                borderRadius: AIM_MARK_SIZE / 2,
                borderWidth: 3,
                borderColor:
                  Math.abs(preview.shot.aimX) > 1 || preview.shot.aimY > 1
                    ? '#F87171'
                    : '#FDE047',
              }}
            />
          )}

          {/* Nơi bé vừa chạm để đổ người, chế độ làm thủ môn */}
          {mode === 'keeper' && playerDive && phase !== 'result' && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left:
                  goal.centerX + playerDive.x * (goal.width / 2) - AIM_MARK_SIZE / 2,
                top:
                  goal.top + (1 - Math.min(1, playerDive.y)) * goal.height - AIM_MARK_SIZE / 2,
                width: AIM_MARK_SIZE,
                height: AIM_MARK_SIZE,
                borderRadius: AIM_MARK_SIZE / 2,
                borderWidth: 3,
                borderColor: '#60A5FA',
              }}
            />
          )}

          {/* Vệt sáng theo ngón tay khi đang vuốt */}
          {trail.map((point, index) => (
            <View
              key={`${index}-${point.x}-${point.y}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: point.x - 4,
                top: point.y - 4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#FDE047',
                opacity: ((index + 1) / trail.length) * 0.9,
              }}
            />
          ))}

          {/* Pháo hoa khi ghi bàn */}
          {sparks.map((s) => (
            <View
              key={s.id}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: s.x - 3,
                top: s.y - 3,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: s.color,
                opacity: Math.min(1, s.life * 1.6),
              }}
            />
          ))}

          {/* Hướng dẫn khi đang chờ sút (chế độ sút phạt) */}
          {phase === 'aiming' && (
            <View style={styles.guide} pointerEvents="none">
              <Text style={styles.guideText}>
                👆 Vuốt từ quả bóng lên khung thành để sút
              </Text>
              <Text style={styles.guideHint}>
                Vuốt nhanh → bóng căng · Vuốt chậm → chíp bóng · Vuốt cong → bóng xoáy
              </Text>
            </View>
          )}

          {/* Máy đang chạy đà (chế độ bé làm thủ môn) */}
          {phase === 'runup' && (
            <View style={styles.guide} pointerEvents="none">
              <Text style={styles.guideText}>🏃 Cầu thủ đang chạy đà…</Text>
              <Text style={styles.guideHint}>
                Chạm nhanh về phía bóng bay để đổ người cản phá!
              </Text>
            </View>
          )}

          {/* Kết quả lượt sút */}
          {phase === 'result' && outcome && (
            <View style={styles.resultBox} pointerEvents="none">
              <Text
                style={[
                  styles.resultText,
                  // Ở chế độ làm thủ môn thì CẢN được mới là thắng, nên màu đảo lại
                  (mode === 'striker' ? outcome === 'goal' : outcome === 'saved')
                    ? styles.resultGoal
                    : styles.resultMiss,
                ]}
              >
                {mode === 'keeper' && outcome === 'saved'
                  ? '🧤 CẢN ĐƯỢC!'
                  : OUTCOME_LABEL[outcome]}
              </Text>
              {reward && (
                <Text style={styles.rewardText}>
                  🎉 {reward.praise} +{reward.points} điểm
                </Text>
              )}
              {mode === 'keeper'
                ? hint && <Text style={styles.resultDetail}>{hint}</Text>
                : shot && <Text style={styles.resultDetail}>{describeShot(shot)}</Text>}
            </View>
          )}

          {/* Hết 5 lượt */}
          {phase === 'done' && (
            <View style={styles.overlay}>
              {mode === 'striker' ? (
                <>
                  <Text style={styles.overlayEmoji}>
                    {goals >= 4 ? '🏆' : goals >= 2 ? '👏' : '💪'}
                  </Text>
                  <Text style={styles.overlayTitle}>
                    Ghi được {goals}/{TOTAL_SHOTS} bàn
                  </Text>
                  <Text style={styles.overlayText}>
                    {goals >= 4
                      ? 'Chân sút cừ khôi! Vuốt vào góc thật hiểm luôn.'
                      : goals >= 2
                        ? 'Khá lắm! Thử vuốt cong để bóng xoáy qua tay thủ môn nhé.'
                        : 'Vuốt nhanh hơn và nhắm vào hai góc xa nhé!'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.overlayEmoji}>
                    {saves >= 4 ? '🏆' : saves >= 2 ? '🧤' : '💪'}
                  </Text>
                  <Text style={styles.overlayTitle}>
                    Cản được {saves}/{TOTAL_SHOTS} quả
                  </Text>
                  <Text style={styles.overlayText}>
                    {saves >= 4
                      ? 'Thủ môn xuất sắc! Phản xạ nhanh như điện.'
                      : saves >= 2
                        ? 'Tốt lắm! Nhìn hướng chân sút để đoán sớm hơn nhé.'
                        : 'Chạm sớm hơn một nhịp và nhắm về phía bóng đang bay nhé!'}
                  </Text>
                </>
              )}
              <Text style={styles.overlayScore}>⭐ {score} điểm</Text>
              <Text style={styles.overlayBest}>
                Cao nhất: ⚽ {Math.max(best, goals)} bàn · 🧤{' '}
                {Math.max(bestSaves, saves)} lần cản · {Math.max(bestScore, score)} điểm
              </Text>
              <Pressable
                onPress={restart}
                accessibilityRole="button"
                accessibilityLabel={mode === 'striker' ? 'Đá lại' : 'Bắt lại'}
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              >
                <Text style={styles.buttonText}>
                  {mode === 'striker' ? '⚽ ĐÁ LẠI' : '🧤 BẮT LẠI'}
                </Text>
              </Pressable>
              <Pressable
                onPress={backToMenu}
                accessibilityRole="button"
                accessibilityLabel="Đổi chế độ chơi"
                style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
              >
                <Text style={styles.ghostButtonText}>↩ Đổi chế độ</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Thanh dưới: nhắc lỗi vuốt hoặc nút sang lượt sau */}
        <View style={styles.bottomBar}>
          {phase === 'result' ? (
            <Pressable
              onPress={nextShot}
              accessibilityRole="button"
              accessibilityLabel={
                shotNumber >= TOTAL_SHOTS ? 'Xem kết quả' : 'Lượt sút tiếp theo'
              }
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.buttonText}>
                {shotNumber >= TOTAL_SHOTS ? 'XEM KẾT QUẢ' : 'LƯỢT TIẾP THEO →'}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.bottomHint}>
              {hint ??
                (mode === 'striker'
                  ? `Lượt ${Math.min(shotNumber, TOTAL_SHOTS)}/${TOTAL_SHOTS} · ghi được ${goals} bàn · ${score} điểm`
                  : `Lượt ${Math.min(shotNumber, TOTAL_SHOTS)}/${TOTAL_SHOTS} · cản được ${saves} quả · ${score} điểm`)}
            </Text>
          )}
        </View>
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, gap: spacing.sm },

  // ---- Màn hình chọn chế độ ----
  menuWrap: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: 'center',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.success,
    padding: spacing.lg,
    minHeight: touch.primary,
    ...elevation(1),
  },
  modeCardOn: { opacity: 0.8 },
  modeEmoji: { fontSize: 40 },
  modeTextGroup: { flex: 1, gap: 4 },
  modeName: { fontSize: 17, fontWeight: '800', color: colors.text },
  modeDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  menuBest: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  ghostButton: {
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  ghostButtonText: { fontSize: 14, fontWeight: '800', color: '#E2E8F0' },

  field: {
    flex: 1,
    minHeight: 280,
    backgroundColor: '#4ADE80',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#16A34A',
  },
  /** Dải cỏ đậm hơn từ vạch vôi trở xuống, tạo cảm giác chiều sâu */
  grassDark: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#22C55E',
  },
  penaltyArc: {
    position: 'absolute',
    left: '14%',
    right: '14%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },

  goal: {
    position: 'absolute',
    borderWidth: 6,
    borderBottomWidth: 0,
    borderColor: '#F8FAFC',
    backgroundColor: 'rgba(15,23,42,0.22)',
  },
  net: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },

  spot: {
    position: 'absolute',
    alignSelf: 'center',
    width: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  ball: { position: 'absolute' },

  guide: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: '52%',
    alignItems: 'center',
    gap: 2,
  },
  guideText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    backgroundColor: 'rgba(255,255,255,0.86)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  guideHint: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
    textAlign: 'center',
  },

  resultBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '46%',
    alignItems: 'center',
    gap: 4,
  },
  resultText: {
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  resultGoal: { color: '#FFFFFF', backgroundColor: '#16A34A' },
  resultMiss: { color: '#FFFFFF', backgroundColor: '#B91C1C' },
  resultDetail: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },

  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15,23,42,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  rewardText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350F',
    backgroundColor: colors.reward,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },

  overlayEmoji: { fontSize: 44 },
  overlayScore: { fontSize: 18, fontWeight: '800', color: colors.reward },
  overlayTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  overlayText: {
    fontSize: 13,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 19,
  },
  overlayBest: { fontSize: 12, fontWeight: '800', color: colors.reward },

  bottomBar: { minHeight: touch.primary, justifyContent: 'center' },
  bottomHint: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: {
    minHeight: touch.primary,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    ...elevation(2),
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  pressed: { opacity: 0.7 },
});
