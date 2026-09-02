import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors, elevation, radius, spacing } from '../../constants/theme';
import { usePlaytime } from '../../context/PlaytimeContext';
import { playGameSound, setGameSoundEnabled } from '../../lib/gameSound';
import GameShell from './GameShell';
import {
  advance,
  buyHeal,
  buyUpgrade,
  buyWeapon,
  createWorld,
  cycleWeapon,
  DAMAGE_STEP,
  drainEvents,
  FIRE_RATE_STEP_MS,
  HEAL_AMOUNT,
  HEAL_PRICE,
  MIN_FIRE_INTERVAL,
  POWERUPS,
  priceAt,
  selectWeapon,
  snapshot,
  UPGRADES,
  WEAPON_ORDER,
  WEAPONS,
  type Frame,
  type UpgradeId,
  type WeaponId,
  type World,
} from './zombieLogic';

/** Số điểm cao giữ lại trong bảng xếp hạng của phiên chơi */
const TOP_SCORES = 5;
const JOYSTICK_SIZE = 116;
const JOYSTICK_KNOB = 48;

type Phase = 'start' | 'playing' | 'paused' | 'gameOver';

/**
 * Một ô trong lưới nâng cấp. `heal` không phải bậc nâng cấp mà là hành động mua
 * lặp lại được, nên để riêng thay vì nhét vào UpgradeId.
 */
type GridSlot = UpgradeId | 'heal';

/** 8 ô, xếp 2 cột × 4 hàng đúng thứ tự trong mẫu thiết kế */
const GRID_SLOTS: GridSlot[] = [
  'damage',
  'fireRate',
  'moveSpeed',
  'heal',
  'maxHp',
  'multishot',
  'pierce',
  'goldBonus',
];

/* ------------------------------------------------------------------ */
/* Các phần vẽ nhỏ, bọc React.memo để không vẽ lại khi không cần        */
/* ------------------------------------------------------------------ */

const ZOMBIE_LOOK: Record<string, { emoji: string; color: string }> = {
  normal: { emoji: '🧟', color: '#65A30D' },
  fast: { emoji: '🧟‍♂️', color: '#0EA5E9' },
  tank: { emoji: '🧟‍♀️', color: '#7C3AED' },
  boomer: { emoji: '💀', color: '#F97316' },
  boss: { emoji: '👹', color: '#DC2626' },
};

const ZombieView = React.memo(function ZombieView({
  x,
  y,
  radius: r,
  kind,
  hp,
  maxHp,
  hitFlash,
}: {
  x: number;
  y: number;
  radius: number;
  kind: string;
  hp: number;
  maxHp: number;
  hitFlash: number;
}) {
  const look = ZOMBIE_LOOK[kind] ?? ZOMBIE_LOOK.normal;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.entity,
        {
          left: x - r,
          top: y - r,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          backgroundColor: hitFlash > 0 ? '#FFFFFF' : look.color,
        },
      ]}
    >
      <Text style={{ fontSize: r * 1.3 }}>{look.emoji}</Text>
      {hp < maxHp && (
        <View style={styles.zombieHpTrack}>
          <View
            style={[styles.zombieHpFill, { width: `${Math.max(0, (hp / maxHp) * 100)}%` }]}
          />
        </View>
      )}
    </View>
  );
});

const DotView = React.memo(function DotView({
  x,
  y,
  size,
  color,
  opacity = 1,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
      }}
    />
  );
});

/**
 * Tia ngắm kẻ từ nhân vật tới zombie đang bị khoá mục tiêu.
 *
 * Vẽ bằng MỘT View bị xoay: dài đúng bằng khoảng cách, gốc xoay đặt ở đầu bên
 * trái để tia luôn bắt đầu từ nhân vật.
 */
const AimLine = React.memo(function AimLine({
  fromX,
  fromY,
  toX,
  toY,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy);
  if (length < 1) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: fromX,
        top: fromY - 1,
        width: length,
        height: 2,
        backgroundColor: '#F87171',
        opacity: 0.45,
        transform: [{ translateX: 0 }, { rotate: `${Math.atan2(dy, dx)}rad` }],
        transformOrigin: 'left center',
      }}
    />
  );
});

/** Tia lửa nòng súng, nhấp một nhịp rất ngắn mỗi lần bắn */
const MuzzleFlash = React.memo(function MuzzleFlash({
  x,
  y,
  aimX,
  aimY,
  radius,
}: {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  radius: number;
}) {
  const distance = radius + 8;
  const size = 18;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x + aimX * distance - size / 2,
        top: y + aimY * distance - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FDE047',
        opacity: 0.9,
      }}
    />
  );
});

/** Viên đạn: điểm tròn, hoặc vệt sáng dài cho súng liên thanh */
const BulletView = React.memo(function BulletView({
  x,
  y,
  vx,
  vy,
  radius: r,
  look,
}: {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  look: 'normal' | 'tracer' | 'crit';
}) {
  if (look === 'normal') {
    return <DotView x={x} y={y} size={r * 2} color="#FDE047" />;
  }

  // Vệt sáng: dài theo hướng bay, đạn chí mạng thì to và trắng hơn
  const crit = look === 'crit';
  const length = crit ? 22 : 16;
  const thickness = crit ? r * 2.2 : r * 1.6;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x,
        top: y - thickness / 2,
        width: length,
        height: thickness,
        borderRadius: thickness / 2,
        backgroundColor: crit ? '#FFFFFF' : '#FDE047',
        transform: [{ rotate: `${Math.atan2(vy, vx) + Math.PI}rad` }],
        transformOrigin: 'left center',
      }}
    />
  );
});

/** Số vàng nảy lên khi hạ zombie: "+$5" */
const GoldPopView = React.memo(function GoldPopView({
  x,
  y,
  amount,
  ttl,
}: {
  x: number;
  y: number;
  amount: number;
  ttl: number;
}) {
  return (
    <Text
      style={[
        styles.goldPop,
        { left: x - 20, top: y - 10, opacity: Math.min(1, ttl * 1.6) },
      ]}
    >
      +${amount}
    </Text>
  );
});

/** Vật phẩm buff nằm chờ trên sân, nhấp nháy khi gần hết hạn */
const PowerUpView = React.memo(function PowerUpView({
  x,
  y,
  kind,
  ttl,
}: {
  x: number;
  y: number;
  kind: keyof typeof POWERUPS;
  ttl: number;
}) {
  const spec = POWERUPS[kind];
  const blink = ttl < 3 && Math.floor(ttl * 6) % 2 === 0;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.powerUp,
        { left: x - 15, top: y - 15, borderColor: spec.color, opacity: blink ? 0.35 : 1 },
      ]}
    >
      <Text style={styles.powerUpEmoji}>{spec.emoji}</Text>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Cần điều khiển ảo                                                   */
/* ------------------------------------------------------------------ */

function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const maxTravel = (JOYSTICK_SIZE - JOYSTICK_KNOB) / 2;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        /*
         * Ba dòng dưới là phần quyết định để VỪA CHẠY VỪA BẮN được bằng hai ngón.
         * Mặc định, khi ngón thứ hai chạm vào nút BẮN, hệ responder của React
         * Native có thể tước quyền của cần điều khiển — nhân vật đứng khựng lại
         * giữa lúc đang chạy. Từ chối nhường quyền và không chặn responder gốc
         * thì hai ngón hoạt động độc lập.
         */
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => false,
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderMove: (_event, gesture) => {
          const len = Math.hypot(gesture.dx, gesture.dy);
          // Kéo quá vành thì kẹp lại đúng vành, không cho núm chạy ra ngoài
          const scale = len > maxTravel ? maxTravel / len : 1;
          const kx = gesture.dx * scale;
          const ky = gesture.dy * scale;
          setKnob({ x: kx, y: ky });
          onMove(kx / maxTravel, ky / maxTravel);
        },
        onPanResponderRelease: () => {
          setKnob({ x: 0, y: 0 });
          onMove(0, 0);
        },
        onPanResponderTerminate: () => {
          setKnob({ x: 0, y: 0 });
          onMove(0, 0);
        },
      }),
    [maxTravel, onMove],
  );

  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Cần điều khiển di chuyển"
      accessibilityHint="Kéo để chạy, vừa chạy vẫn bắn được"
      style={styles.joystickBase}
    >
      <Text style={styles.joystickHint}>DI CHUYỂN</Text>
      <View
        style={[
          styles.joystickKnob,
          { transform: [{ translateX: knob.x }, { translateY: knob.y }] },
        ]}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Một ô nâng cấp trong lưới                                           */
/* ------------------------------------------------------------------ */

const UpgradeTile = React.memo(function UpgradeTile({
  slot,
  level,
  price,
  affordable,
  detail,
  onPress,
}: {
  slot: GridSlot;
  /** `null` với ô Hồi máu (không có bậc) */
  level: number | null;
  /** `null` nghĩa là đã đạt bậc tối đa */
  price: number | null;
  affordable: boolean;
  detail: string;
  onPress: (slot: GridSlot) => void;
}) {
  const spec =
    slot === 'heal'
      ? { emoji: '💚', name: 'Hồi máu', step: `+${HEAL_AMOUNT} HP` }
      : UPGRADES[slot];

  const maxed = price === null;
  // Không đủ vàng hoặc đã tối đa thì làm mờ đúng như mẫu (opacity 0.4)
  const dimmed = maxed || !affordable;

  return (
    <Pressable
      onPress={() => onPress(slot)}
      disabled={maxed}
      accessibilityRole="button"
      accessibilityState={{ disabled: dimmed }}
      accessibilityLabel={
        maxed
          ? `${spec.name} đã tối đa`
          : `${spec.name} ${spec.step}, giá ${price} vàng${affordable ? '' : ', chưa đủ vàng'}`
      }
      style={({ pressed }) => [
        styles.tile,
        !dimmed && styles.tileReady,
        dimmed && styles.tileDimmed,
        pressed && !maxed && styles.tilePressed,
      ]}
    >
      <View style={styles.tileHead}>
        <Text style={styles.tileEmoji}>{spec.emoji}</Text>
        <Text style={styles.tileName} numberOfLines={1}>
          {spec.name}
        </Text>
        {level !== null && <Text style={styles.tileLevel}>Lv{level}</Text>}
      </View>
      <View style={styles.tileFoot}>
        <Text style={styles.tileStep} numberOfLines={1}>
          {spec.step}
        </Text>
        <Text style={[styles.tilePrice, !dimmed && styles.tilePriceReady]}>
          {maxed ? 'TỐI ĐA' : `$${price}`}
        </Text>
      </View>
      <Text style={styles.tileDetail} numberOfLines={1}>
        {detail}
      </Text>
    </Pressable>
  );
});

/* ------------------------------------------------------------------ */
/* Màn hình chính                                                      */
/* ------------------------------------------------------------------ */

export default function ZombieGame({ onExit }: { onExit: () => void }) {
  const { isPlaying } = usePlaytime();
  const windowSize = useWindowDimensions();

  /**
   * Kích thước sân chơi. Đặt trước một con số ước lượng rồi mới chỉnh theo
   * `onLayout`: nếu chờ `onLayout` mới tạo thế giới thì màn hình sẽ trắng khi
   * sự kiện đó đến chậm hoặc không kích hoạt.
   */
  const [area, setArea] = useState(() => ({
    width: Math.max(260, windowSize.width - spacing.sm * 2),
    height: Math.max(200, Math.min(380, windowSize.height * 0.4)),
  }));

  const [phase, setPhase] = useState<Phase>('start');
  const [frame, setFrame] = useState<Frame | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  const worldRef = useRef<World | null>(null);
  const inputRef = useRef({ moveX: 0, moveY: 0, firing: false, fireOnce: false, useBomb: false });
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const highScore = scores.length > 0 ? scores[0] : 0;

  /** Hiện một dòng nhắc ngắn rồi tự tắt — KHÔNG chặn game */
  const flash = useCallback((message: string) => {
    setNote(message);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(() => setNote(null), 1600);
  }, []);

  useEffect(
    () => () => {
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    },
    [],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    // Bỏ qua số đo 0 (một số môi trường báo 0 ở lần layout đầu)
    if (width <= 0 || height <= 0) return;
    setArea((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height },
    );
  }, []);

  const startRun = useCallback(() => {
    worldRef.current = createWorld(area.width, area.height, Date.now() % 2147483647);
    inputRef.current = { moveX: 0, moveY: 0, firing: false, fireOnce: false, useBomb: false };
    setFrame(snapshot(worldRef.current));
    setNote(null);
    setPhase('playing');
  }, [area.height, area.width]);

  // Xoay ngang/dọc: cập nhật kích thước sân, không xoá trận đang chơi
  useEffect(() => {
    const world = worldRef.current;
    if (!world || area.width <= 0 || area.height <= 0) return;
    world.areaW = area.width;
    world.areaH = area.height;
  }, [area.height, area.width]);

  useEffect(() => {
    setGameSoundEnabled(soundOn);
  }, [soundOn]);

  // Vòng lặp game — chỉ chạy khi đồng hồ giờ chơi đang đếm
  useEffect(() => {
    if (!isPlaying || phase !== 'playing' || !worldRef.current) return;

    lastTimeRef.current = Date.now();

    const step = () => {
      const world = worldRef.current;
      if (!world) return;

      const now = Date.now();
      // Chặn dt lớn để zombie không "nhảy" xuyên qua người chơi sau khi app ngủ
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      const input = inputRef.current;
      advance(world, dt, {
        moveX: input.moveX,
        moveY: input.moveY,
        firing: input.firing || input.fireOnce,
        useBomb: input.useBomb,
      });
      // Hai cờ một nhịp: xoá NGAY sau advance để một lần bấm chỉ tính một lần
      input.fireOnce = false;
      input.useBomb = false;

      for (const event of drainEvents(world)) playGameSound(event);
      setFrame(snapshot(world));

      if (world.status === 'gameOver') {
        setScores((prev) =>
          [...prev, world.score].sort((a, b) => b - a).slice(0, TOP_SCORES),
        );
        setPhase('gameOver');
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying, phase]);

  const handleJoystick = useCallback((x: number, y: number) => {
    inputRef.current.moveX = x;
    inputRef.current.moveY = y;
  }, []);

  const handleFireIn = useCallback(() => {
    inputRef.current.firing = true;
  }, []);
  const handleFireOut = useCallback(() => {
    inputRef.current.firing = false;
  }, []);
  /** Bấm một nhịp thì bắn một phát, không cần giữ */
  const handleFireTap = useCallback(() => {
    inputRef.current.fireOnce = true;
  }, []);

  /**
   * Tuyệt chiêu: nổ một quả bom đang giữ.
   *
   * Chỉ dựng cờ, việc tiêu bom do `advance()` làm — nếu gọi `detonateBomb` thẳng
   * từ đây thì nó chạy ngoài vòng lặp, có thể xen vào giữa một khung hình đang
   * tính dở và làm số zombie đọc được ở hai nửa khung hình khác nhau.
   */
  const handleBombPress = useCallback(() => {
    inputRef.current.useBomb = true;
  }, []);

  const togglePause = useCallback(() => {
    // Nhả nút bắn để khi chơi tiếp không bắn liên tục ngoài ý muốn
    inputRef.current.firing = false;
    inputRef.current.moveX = 0;
    inputRef.current.moveY = 0;
    inputRef.current.useBomb = false;
    setPhase((prev) =>
      prev === 'paused' ? 'playing' : prev === 'playing' ? 'paused' : prev,
    );
  }, []);

  /**
   * Mua nâng cấp NGAY TRONG LÚC CHƠI: không đổi `phase`, không dừng vòng lặp.
   * Chỉ cập nhật world rồi gọi `setFrame` để số liệu trên lưới đổi tức thì.
   */
  const handleTilePress = useCallback(
    (slot: GridSlot) => {
      const world = worldRef.current;
      if (!world || world.status !== 'playing') return;

      if (slot === 'heal') {
        const result = buyHeal(world);
        flash(
          result.ok
            ? `Đã hồi ${HEAL_AMOUNT} máu!`
            : result.reason === 'fullHp'
              ? 'Máu đang đầy rồi.'
              : 'Chưa đủ vàng!',
        );
      } else {
        const result = buyUpgrade(world, slot);
        flash(
          result.ok
            ? `${UPGRADES[slot].name} lên bậc ${world.upgrades[slot]}!`
            : result.reason === 'maxLevel'
              ? `${UPGRADES[slot].name} đã tối đa.`
              : 'Chưa đủ vàng!',
        );
      }
      setFrame(snapshot(world));
    },
    [flash],
  );

  /** Đổi sang khẩu tiếp theo trong số đã mua */
  const handleCycleWeapon = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    const next = cycleWeapon(world);
    setFrame(snapshot(world));
    flash(`Đang dùng ${WEAPONS[next].name}`);
  }, [flash]);

  const handleWeaponPress = useCallback(
    (id: WeaponId) => {
      const world = worldRef.current;
      if (!world) return;

      if (world.ownedWeapons.includes(id)) {
        selectWeapon(world, id);
        flash(`Đang dùng ${WEAPONS[id].name}`);
      } else {
        const result = buyWeapon(world, id);
        flash(result.ok ? `Đã mua ${WEAPONS[id].name}!` : 'Chưa đủ vàng!');
      }
      setFrame(snapshot(world));
    },
    [flash],
  );

  const hpRatio = frame ? Math.max(0, frame.hp / frame.maxHp) : 1;
  const inRun = phase !== 'start';
  /** Số bom tuyệt chiêu đang giữ; chưa có frame nào thì coi như 0 */
  const bombs = frame?.bombs ?? 0;

  return (
    <GameShell
      title="Bắn Zombie"
      emoji="🧟"
      color="#166534"
      scoreLabel={inRun && frame ? `Wave ${frame.wave}  ·  🏆 ${frame.score}` : undefined}
      onExit={onExit}
    >
      <View style={styles.container}>
        {/* ---------------- Canvas ---------------- */}
        <View style={styles.playArea} onLayout={handleLayout}>
          {frame && inRun && (
            <>
              {frame.particles.map((q) => (
                <DotView
                  key={q.id}
                  x={q.x}
                  y={q.y}
                  size={q.size}
                  color={q.color}
                  opacity={Math.max(0.15, q.life / q.maxLife)}
                />
              ))}
              {frame.powerUps.map((u) => (
                <PowerUpView key={u.id} x={u.x} y={u.y} kind={u.kind} ttl={u.ttl} />
              ))}
              {frame.zombies.map((z) => (
                <ZombieView
                  key={z.id}
                  x={z.x}
                  y={z.y}
                  radius={z.radius}
                  kind={z.kind}
                  hp={z.hp}
                  maxHp={z.maxHp}
                  hitFlash={z.hitFlash}
                />
              ))}
              {/* Tia ngắm vẽ TRƯỚC đạn để nằm dưới, không che vệt đạn */}
              {frame.lockedTarget && (
                <AimLine
                  fromX={frame.player.x}
                  fromY={frame.player.y}
                  toX={frame.lockedTarget.x}
                  toY={frame.lockedTarget.y}
                />
              )}
              {frame.bullets.map((b) => (
                <BulletView
                  key={b.id}
                  x={b.x}
                  y={b.y}
                  vx={b.vx}
                  vy={b.vy}
                  radius={b.radius}
                  look={b.look}
                />
              ))}
              {frame.enemyBullets.map((b) => (
                <DotView key={b.id} x={b.x} y={b.y} size={b.radius * 2} color="#F472B6" />
              ))}

              {/* Người chơi */}
              <View
                pointerEvents="none"
                style={[
                  styles.entity,
                  styles.player,
                  {
                    left: frame.player.x - frame.player.radius,
                    top: frame.player.y - frame.player.radius,
                    width: frame.player.radius * 2,
                    height: frame.player.radius * 2,
                    borderRadius: frame.player.radius,
                    opacity: frame.player.invuln > 0 ? 0.5 : 1,
                    borderColor: frame.player.shield > 0 ? '#38BDF8' : '#BFDBFE',
                  },
                ]}
              >
                <Text style={{ fontSize: frame.player.radius * 1.35 }}>🧑‍🚀</Text>
              </View>

              {frame.player.muzzleFlash > 0 && (
                <MuzzleFlash
                  x={frame.player.x}
                  y={frame.player.y}
                  aimX={frame.player.aimX}
                  aimY={frame.player.aimY}
                  radius={frame.player.radius}
                />
              )}

              {/* Số vàng nảy lên, vẽ sau cùng để luôn nằm trên */}
              {frame.goldPops.map((g) => (
                <GoldPopView key={g.id} x={g.x} y={g.y} amount={g.amount} ttl={g.ttl} />
              ))}
            </>
          )}

          {/* ---- HUD góc trên bên TRÁI ---- */}
          <View style={styles.hudLeft} pointerEvents="none">
            <View style={styles.hpRow}>
              <View style={styles.hpTrack}>
                <View
                  style={[
                    styles.hpFill,
                    {
                      width: `${hpRatio * 100}%`,
                      backgroundColor:
                        hpRatio > 0.5 ? '#22C55E' : hpRatio > 0.25 ? '#F59E0B' : '#EF4444',
                    },
                  ]}
                />
              </View>
              <Text style={styles.hpText}>
                {frame ? `${Math.ceil(frame.hp)}/${frame.maxHp}` : '--/--'}
              </Text>
            </View>
            <View style={styles.hudStatRow}>
              <Text style={styles.hudGold}>💰 ${frame ? frame.gold : 0}</Text>
              <Text style={styles.hudStat}>🌊 Wave {frame ? frame.wave : 0}</Text>
            </View>
            <View style={styles.hudStatRow}>
              <Text style={styles.hudStat}>🏆 {frame ? frame.score : 0}</Text>
              <Text style={styles.hudStatDim}>Cao nhất {highScore}</Text>
            </View>
            {/* Súng đang dùng: thanh chọn súng bên phải chỉ có biểu tượng nên
                vẫn cần một dòng ghi rõ tên khẩu đang cầm */}
            <Text style={styles.hudStatDim}>
              {WEAPONS[frame?.weapon ?? 'pistol'].emoji}{' '}
              {WEAPONS[frame?.weapon ?? 'pistol'].name}
            </Text>

            {/* Hiệu ứng buff đang có hiệu lực */}
            {frame && frame.effects.length > 0 && (
              <View style={styles.effectRow}>
                {frame.effects.map((effect) => (
                  <Text key={effect.kind} style={styles.effectChip}>
                    {POWERUPS[effect.kind].emoji} {Math.ceil(effect.seconds)}s
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* ---- HUD góc trên bên PHẢI: âm thanh + tạm dừng ---- */}
          <View style={styles.hudRight}>
            <Pressable
              onPress={() => setSoundOn((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Text style={styles.iconButtonText}>{soundOn ? '🔊' : '🔇'}</Text>
            </Pressable>
            <Pressable
              onPress={togglePause}
              disabled={!inRun || phase === 'gameOver'}
              accessibilityRole="button"
              accessibilityLabel={phase === 'paused' ? 'Chơi tiếp' : 'Tạm dừng'}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Text style={styles.iconButtonText}>{phase === 'paused' ? '▶️' : '⏸️'}</Text>
            </Pressable>
          </View>

          {/* ---- Thanh chọn / mua súng ---- */}
          {frame && inRun && (
            <View style={styles.weaponBar}>
              {WEAPON_ORDER.map((id) => {
                const spec = WEAPONS[id];
                const owned = frame.ownedWeapons.includes(id);
                const active = frame.weapon === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => handleWeaponPress(id)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      owned
                        ? `Chọn ${spec.name}`
                        : `Mua ${spec.name} giá ${spec.price} vàng`
                    }
                    style={({ pressed }) => [
                      styles.weaponChip,
                      active && styles.weaponChipActive,
                      !owned && frame.gold < spec.price && styles.weaponChipLocked,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.weaponEmoji}>{spec.emoji}</Text>
                    <Text style={styles.weaponPrice}>{owned ? '✓' : `$${spec.price}`}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* ---- Cần điều khiển và nút BẮN, đặt TRONG canvas ---- */}
          {inRun && phase !== 'gameOver' && (
            <>
              <View style={styles.joystickWrap}>
                <Joystick onMove={handleJoystick} />
              </View>
              <Pressable
                onPress={handleFireTap}
                onPressIn={handleFireIn}
                onPressOut={handleFireOut}
                accessibilityRole="button"
                accessibilityLabel="Bắn"
                style={({ pressed }) => [styles.fireButton, pressed && styles.fireButtonOn]}
              >
                <Text style={styles.fireButtonText}>BẮN</Text>
              </Pressable>

              {/*
                Nút TUYỆT CHIÊU, ngay trên nút BẮN ở góc dưới phải.
                Hết bom thì mờ đi và `disabled` — vẫn hiện chứ không ẩn, để bé
                biết là có tuyệt chiêu và đi tìm 💣, thay vì tưởng game không có.
              */}
              <Pressable
                onPress={handleBombPress}
                disabled={bombs <= 0}
                accessibilityRole="button"
                accessibilityLabel={
                  bombs > 0
                    ? `Dùng bom huỷ diệt, còn ${bombs} quả`
                    : 'Chưa có bom huỷ diệt, hạ zombie để tìm'
                }
                style={({ pressed }) => [
                  styles.bombButton,
                  bombs <= 0 && styles.bombButtonOff,
                  pressed && bombs > 0 && styles.bombButtonOn,
                ]}
              >
                <Text style={styles.bombEmoji}>💣</Text>
                <Text style={styles.bombCount}>{bombs}</Text>
              </Pressable>
            </>
          )}

          {/* ---- Dòng nhắc ngắn khi mua/nâng cấp ---- */}
          {note && (
            <View style={styles.noteBar} pointerEvents="none">
              <Text style={styles.noteText}>{note}</Text>
            </View>
          )}

          {/* ---- Màn hình bắt đầu ---- */}
          {phase === 'start' && (
            <View style={styles.overlay}>
              <Text style={styles.overlayEmoji}>🧟‍♂️🔫</Text>
              <Text style={styles.overlayTitle}>Bắn Zombie & Nâng Cấp</Text>
              <Text style={styles.overlayText}>
                Cần điều khiển bên trái để chạy, giữ nút BẮN bên phải — vừa chạy vẫn
                bắn được, súng tự nhắm zombie gần nhất. Hạ zombie là vàng cộng ngay,
                bấm các ô nâng cấp bên dưới để mạnh lên mà không phải dừng trận.
              </Text>
              <Pressable
                onPress={startRun}
                accessibilityRole="button"
                accessibilityLabel="Bắt đầu bắn zombie"
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>BẮT ĐẦU</Text>
              </Pressable>
            </View>
          )}

          {/* ---- Tạm dừng ---- */}
          {phase === 'paused' && (
            <View style={styles.overlay}>
              <Text style={styles.overlayEmoji}>⏸️</Text>
              <Text style={styles.overlayTitle}>Đang tạm dừng</Text>
              <Text style={styles.overlayText}>
                Đồng hồ giờ chơi vẫn đang đếm, nên đừng nghỉ lâu quá nhé!
              </Text>
              <Pressable
                onPress={togglePause}
                accessibilityRole="button"
                accessibilityLabel="Chơi tiếp"
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>CHƠI TIẾP</Text>
              </Pressable>
            </View>
          )}

          {/* ---- Kết thúc trận ---- */}
          {phase === 'gameOver' && frame && (
            <View style={styles.overlay}>
              <Text style={styles.overlayEmoji}>💀</Text>
              <Text style={styles.overlayTitle}>Em đã bị zombie hạ!</Text>
              <Text style={styles.overlayText}>
                Trụ được đến Wave {frame.wave} · hạ {frame.kills} zombie · thu được 💰 $
                {frame.goldEarned}.
              </Text>

              <View style={styles.board}>
                <Text style={styles.boardTitle}>🏆 Top {TOP_SCORES} điểm cao</Text>
                {scores.length === 0 ? (
                  <Text style={styles.boardEmpty}>Chưa có điểm nào</Text>
                ) : (
                  scores.map((value, index) => (
                    <View key={`${index}-${value}`} style={styles.boardRow}>
                      <Text style={styles.boardRank}>
                        {['🥇', '🥈', '🥉', '4.', '5.'][index] ?? `${index + 1}.`}
                      </Text>
                      <Text style={styles.boardScore}>{value} điểm</Text>
                    </View>
                  ))
                )}
              </View>

              <Pressable
                onPress={startRun}
                accessibilityRole="button"
                accessibilityLabel="Chơi lại"
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>CHƠI LẠI</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ---------------- Lưới nâng cấp 2 cột × 4 hàng ---------------- */}
        <View style={styles.grid}>
          {GRID_SLOTS.map((slot) => {
            const level = slot === 'heal' ? null : (frame?.upgrades[slot] ?? 0);
            const price =
              slot === 'heal' ? HEAL_PRICE : priceAt(slot, frame?.upgrades[slot] ?? 0);
            const gold = frame?.gold ?? 0;
            const detail =
              slot === 'heal'
                ? frame && frame.hp >= frame.maxHp
                  ? 'Máu đang đầy'
                  : 'Mua nhiều lần được'
                : UPGRADES[slot].describe(level ?? 0);

            return (
              <UpgradeTile
                key={slot}
                slot={slot}
                level={level}
                price={price}
                affordable={price !== null && gold >= price}
                detail={detail}
                onPress={handleTilePress}
              />
            );
          })}

          {/*
            Ô súng chiếm CẢ HAI CỘT, đặt dưới 8 ô nâng cấp: khẩu đang dùng là
            thông tin cần thấy thường xuyên, mà thanh súng nhỏ trong canvas chỉ
            có biểu tượng nên không đọc được thông số.
          */}
          {frame && (
            <Pressable
              onPress={
                frame.ownedWeapons.includes('minigun') || frame.ownedWeapons.length > 1
                  ? handleCycleWeapon
                  : () => handleWeaponPress('minigun')
              }
              accessibilityRole="button"
              accessibilityLabel={
                frame.ownedWeapons.length > 1
                  ? `Đổi súng, đang dùng ${WEAPONS[frame.weapon].name}`
                  : `Mua ${WEAPONS.minigun.name} giá ${WEAPONS.minigun.price} vàng`
              }
              style={({ pressed }) => [
                styles.tile,
                styles.weaponTile,
                pressed && styles.tilePressed,
              ]}
            >
              <View style={styles.tileHead}>
                <Text style={styles.weaponTileEmoji}>{WEAPONS[frame.weapon].emoji}</Text>
                <Text style={styles.weaponTileName} numberOfLines={1}>
                  {WEAPONS[frame.weapon].name}
                </Text>
                <Text style={styles.weaponTileAction}>
                  {frame.ownedWeapons.length > 1
                    ? '🔄 ĐỔI SÚNG'
                    : `🛒 MUA 💥 $${WEAPONS.minigun.price}`}
                </Text>
              </View>
              <Text style={styles.tileDetail} numberOfLines={1}>
                {Math.round(WEAPONS[frame.weapon].damage + frame.upgrades.damage * DAMAGE_STEP)} sát
                thương · {Math.round(fireIntervalOf(frame) * 1000)}ms/viên ·{' '}
                {WEAPONS[frame.weapon].pellets + frame.upgrades.multishot} viên/lượt
                {WEAPONS[frame.weapon].critChance
                  ? ` · ${Math.round((WEAPONS[frame.weapon].critChance ?? 0) * 100)}% chí mạng`
                  : ''}
                {' · '}đã có {frame.ownedWeapons.length}/{WEAPON_ORDER.length} khẩu
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </GameShell>
  );
}

/**
 * Khoảng nghỉ giữa hai phát, tính từ ảnh chụp khung hình.
 * `fireInterval()` cần cả `world` nên không dùng trực tiếp ở phần vẽ được; ở đây
 * tính lại từ đúng những số liệu mà Frame mang sang.
 */
function fireIntervalOf(frame: Frame): number {
  const spec = WEAPONS[frame.weapon];
  const base = Math.max(
    MIN_FIRE_INTERVAL,
    spec.interval - (frame.upgrades.fireRate * FIRE_RATE_STEP_MS) / 1000,
  );
  const hasFrenzy = frame.effects.some((e) => e.kind === 'frenzy');
  return hasFrenzy ? Math.max(MIN_FIRE_INTERVAL / 2, base / 2) : base;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.sm, gap: spacing.sm },

  // ---- Canvas ----
  playArea: {
    flex: 1,
    minHeight: 200,
    backgroundColor: '#0F172A',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  entity: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  player: { backgroundColor: colors.primary, borderWidth: 3 },
  zombieHpTrack: {
    position: 'absolute',
    top: -6,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    overflow: 'hidden',
  },
  zombieHpFill: { height: '100%', backgroundColor: '#F87171' },
  goldPop: {
    position: 'absolute',
    width: 40,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: '#FDE047',
  },
  powerUp: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerUpEmoji: { fontSize: 17 },

  // ---- HUD trong canvas ----
  hudLeft: { position: 'absolute', top: 6, left: 8, gap: 3, maxWidth: '60%' },
  hpRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hpTrack: {
    width: 84,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  hpFill: { height: '100%', borderRadius: radius.pill },
  hpText: { fontSize: 10, fontWeight: '800', color: '#E2E8F0' },
  hudStatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hudGold: { fontSize: 12, fontWeight: '800', color: '#FDE047' },
  hudStat: { fontSize: 11, fontWeight: '800', color: '#E2E8F0' },
  hudStatDim: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  effectRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 2 },
  effectChip: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    backgroundColor: '#FDE047',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },

  hudRight: { position: 'absolute', top: 6, right: 8, flexDirection: 'row', gap: 6 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: { fontSize: 16 },

  /** Thanh súng: mờ nhẹ để không che zombie phía sau */
  weaponBar: {
    position: 'absolute',
    top: 46,
    right: 8,
    flexDirection: 'row',
    gap: 4,
    opacity: 0.85,
  },
  weaponChip: {
    minWidth: 34,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
  },
  weaponChipActive: { borderColor: '#FDE047', backgroundColor: 'rgba(245,158,11,0.32)' },
  weaponChipLocked: { opacity: 0.4 },
  weaponEmoji: { fontSize: 13 },
  weaponPrice: { fontSize: 9, fontWeight: '800', color: '#FDE047' },

  /**
   * Cần điều khiển và nút BẮN nằm TRONG canvas, để mờ 0.6 — nhờ vậy vẫn thấy
   * được zombie và vật phẩm đi phía dưới chúng.
   */
  joystickWrap: { position: 'absolute', left: 10, bottom: 10, opacity: 0.6 },
  joystickBase: {
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE,
    borderRadius: JOYSTICK_SIZE / 2,
    backgroundColor: 'rgba(148,163,184,0.35)',
    borderWidth: 2,
    borderColor: 'rgba(226,232,240,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joystickHint: {
    position: 'absolute',
    bottom: 8,
    fontSize: 9,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  joystickKnob: {
    width: JOYSTICK_KNOB,
    height: JOYSTICK_KNOB,
    borderRadius: JOYSTICK_KNOB / 2,
    backgroundColor: '#94A3B8',
    ...elevation(2),
  },

  fireButton: {
    position: 'absolute',
    right: 12,
    bottom: 16,
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,38,38,0.75)',
    borderWidth: 3,
    borderColor: 'rgba(254,202,202,0.8)',
    ...elevation(2),
  },
  fireButtonOn: { backgroundColor: 'rgba(153,27,27,0.9)' },

  /** Nút tuyệt chiêu, xếp ngay trên nút BẮN cùng lề phải */
  bombButton: {
    position: 'absolute',
    right: 22,
    bottom: 118,
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.82)',
    borderWidth: 3,
    borderColor: 'rgba(254,215,170,0.9)',
  },
  bombButtonOn: { backgroundColor: 'rgba(194,65,12,0.95)' },
  bombButtonOff: {
    backgroundColor: 'rgba(71,85,105,0.45)',
    borderColor: 'rgba(148,163,184,0.5)',
    opacity: 0.55,
  },
  bombEmoji: { fontSize: 26 },
  bombCount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF7ED',
    marginTop: -2,
  },
  fireButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 22 },

  noteBar: { position: 'absolute', left: 0, right: 0, bottom: 120, alignItems: 'center' },
  noteText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    backgroundColor: '#FDE047',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },

  // ---- Lớp phủ ----
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15,23,42,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  overlayEmoji: { fontSize: 36 },
  overlayTitle: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  overlayText: { fontSize: 12, color: '#CBD5E1', textAlign: 'center', lineHeight: 18 },

  board: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 3,
  },
  boardTitle: { fontSize: 12, fontWeight: '800', color: '#FBBF24', marginBottom: 2 },
  boardEmpty: { fontSize: 12, color: '#94A3B8' },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  boardRank: { fontSize: 13, width: 24 },
  boardScore: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', flex: 1 },

  primaryButton: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.reward,
    ...elevation(2),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  pressed: { opacity: 0.7 },

  /* ---- Lưới nâng cấp: 2 cột × 4 hàng, nền tối như mẫu ---- */
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: {
    // 2 cột: mỗi ô chiếm gần nửa chiều rộng, trừ đi khoảng cách giữa hai cột
    width: '48.5%',
    backgroundColor: '#2A2A2A',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#3F3F3F',
    gap: 1,
  },
  /** Đủ vàng thì ô sáng lên, viền vàng */
  tileReady: { borderColor: '#FDE047', backgroundColor: '#332F1A' },
  /** Thiếu vàng hoặc đã tối đa thì mờ đi đúng như mẫu */
  tileDimmed: { opacity: 0.4 },
  tilePressed: { opacity: 0.65 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileEmoji: { fontSize: 14 },
  tileName: { flex: 1, fontSize: 11, fontWeight: '800', color: '#F1F5F9' },
  tileLevel: { fontSize: 9, fontWeight: '800', color: '#94A3B8' },
  tileFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileStep: { fontSize: 10, fontWeight: '700', color: '#CBD5E1' },
  tilePrice: { fontSize: 12, fontWeight: '800', color: '#94A3B8' },
  tilePriceReady: { color: '#FDE047' },
  tileDetail: { fontSize: 9, color: '#94A3B8' },

  /** Ô súng: chiếm cả hai cột, viền tím để nổi khỏi nhóm ô nâng cấp */
  weaponTile: {
    width: '100%',
    borderColor: '#A78BFA',
    backgroundColor: '#2B2440',
    opacity: 1,
  },
  weaponTileEmoji: { fontSize: 16 },
  weaponTileName: { flex: 1, fontSize: 12, fontWeight: '800', color: '#F1F5F9' },
  weaponTileAction: { fontSize: 10, fontWeight: '800', color: '#C4B5FD' },
});
