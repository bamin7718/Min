import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';
import { usePlaytime } from '../../context/PlaytimeContext';
import GameShell from './GameShell';

/* ------------------------------------------------------------------ */
/* Hằng số vật lý (đơn vị: pixel, giây)                                */
/* ------------------------------------------------------------------ */

const MARIO_W = 26;
const MARIO_H = 32;
const GROUND_H = 26;

const GRAVITY = 1500;
const JUMP_VELOCITY = -580;
const SIDE_SPEED = 200;

const START_SPEED = 180;
const MAX_SPEED = 330;
const SPEED_GAIN = 5; // px/s tăng thêm mỗi giây

const MUSHROOM_W = 26;
const MUSHROOM_H = 24;
const COIN_SIZE = 20;

const START_LIVES = 3;
const INVULNERABLE_TIME = 1.1; // giây bất tử sau khi trúng chướng ngại vật

/* ------------------------------------------------------------------ */
/* Mô hình thế giới                                                    */
/* ------------------------------------------------------------------ */

type ObstacleType = 'mushroom' | 'pit';

interface Obstacle {
  id: number;
  x: number;
  width: number;
  type: ObstacleType;
}

interface Coin {
  id: number;
  x: number;
  y: number;
  taken: boolean;
}

interface World {
  areaWidth: number;
  areaHeight: number;
  time: number;
  speed: number;
  distance: number;
  marioX: number;
  marioY: number;
  velocityY: number;
  onGround: boolean;
  obstacles: Obstacle[];
  coins: Coin[];
  coinsCollected: number;
  lives: number;
  invulnerableUntil: number;
  spawnCursor: number;
  nextId: number;
}

/** Dữ liệu tối giản để vẽ một khung hình */
interface Frame {
  marioX: number;
  marioY: number;
  onGround: boolean;
  blinking: boolean;
  obstacles: Obstacle[];
  coins: Coin[];
  coinsCollected: number;
  lives: number;
  distance: number;
}

interface Input {
  direction: number; // -1 trái, 0 đứng, 1 phải
  jumpRequested: boolean;
}

function groundTopFor(world: World): number {
  return world.areaHeight - GROUND_H - MARIO_H;
}

function createWorld(areaWidth: number, areaHeight: number): World {
  const world: World = {
    areaWidth,
    areaHeight,
    time: 0,
    speed: START_SPEED,
    distance: 0,
    marioX: 40,
    marioY: 0,
    velocityY: 0,
    onGround: true,
    obstacles: [],
    coins: [],
    coinsCollected: 0,
    lives: START_LIVES,
    invulnerableUntil: 0,
    // Chừa một đoạn trống lúc đầu để học sinh kịp làm quen
    spawnCursor: areaWidth + 120,
    nextId: 1,
  };
  world.marioY = groundTopFor(world);
  return world;
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Sinh thêm một đoạn địa hình phía trước */
function spawnChunk(world: World): void {
  const gap = 150 + Math.random() * 130;
  const x = world.spawnCursor + gap;
  const groundTop = groundTopFor(world);

  if (Math.random() < 0.38) {
    // Hố: phải nhảy qua
    const width = 52 + Math.random() * 26;
    world.obstacles.push({ id: world.nextId++, x, width, type: 'pit' });
    world.coins.push({
      id: world.nextId++,
      x: x + width / 2 - COIN_SIZE / 2,
      y: groundTop - 44,
      taken: false,
    });
    world.spawnCursor = x + width;
  } else {
    // Nấm: né hoặc nhảy qua
    world.obstacles.push({
      id: world.nextId++,
      x,
      width: MUSHROOM_W,
      type: 'mushroom',
    });
    const coinCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < coinCount; i += 1) {
      world.coins.push({
        id: world.nextId++,
        x: x + MUSHROOM_W + 32 + i * 30,
        y: groundTop - 28 - Math.random() * 26,
        taken: false,
      });
    }
    world.spawnCursor = x + MUSHROOM_W;
  }
}

function takeDamage(world: World): void {
  world.lives -= 1;
  world.invulnerableUntil = world.time + INVULNERABLE_TIME;
}

/** Cập nhật thế giới một bước thời gian */
function advance(world: World, dt: number, input: Input): void {
  world.time += dt;
  world.speed = Math.min(MAX_SPEED, world.speed + SPEED_GAIN * dt);
  world.distance += world.speed * dt;

  const groundTop = groundTopFor(world);

  // Di chuyển ngang trong nửa trái màn hình
  world.marioX = clamp(
    world.marioX + input.direction * SIDE_SPEED * dt,
    8,
    Math.max(8, world.areaWidth * 0.6),
  );

  // Nhảy
  if (input.jumpRequested && world.onGround) {
    world.velocityY = JUMP_VELOCITY;
    world.onGround = false;
  }

  // Trọng lực
  world.velocityY += GRAVITY * dt;
  world.marioY += world.velocityY * dt;

  // Cuộn thế giới về bên trái
  const shift = world.speed * dt;
  for (const obstacle of world.obstacles) obstacle.x -= shift;
  for (const coin of world.coins) coin.x -= shift;
  world.spawnCursor -= shift;

  // Đang ở trên miệng hố hay trên mặt đất?
  const overPit = world.obstacles.some(
    (obstacle) =>
      obstacle.type === 'pit' &&
      world.marioX + MARIO_W > obstacle.x + 4 &&
      world.marioX < obstacle.x + obstacle.width - 4,
  );

  if (!overPit && world.marioY >= groundTop) {
    world.marioY = groundTop;
    world.velocityY = 0;
    world.onGround = true;
  } else if (world.marioY >= groundTop) {
    // Rơi vào hố
    world.onGround = false;
  }

  // Rơi khỏi màn hình → mất một mạng và được đặt lại lên mặt đất
  if (world.marioY > world.areaHeight) {
    takeDamage(world);
    world.marioY = groundTop;
    world.velocityY = 0;
    world.onGround = true;
    world.marioX = 40;
    // Dọn hố ngay dưới chân để không rơi lại liên tục
    world.obstacles = world.obstacles.filter(
      (obstacle) => obstacle.type !== 'pit' || obstacle.x > world.marioX + MARIO_W + 20,
    );
  }

  // Va chạm với nấm
  if (world.time > world.invulnerableUntil) {
    const mushroomTop = world.areaHeight - GROUND_H - MUSHROOM_H;
    for (const obstacle of world.obstacles) {
      if (obstacle.type !== 'mushroom') continue;
      if (
        rectsOverlap(
          world.marioX,
          world.marioY,
          MARIO_W,
          MARIO_H,
          obstacle.x,
          mushroomTop,
          obstacle.width,
          MUSHROOM_H,
        )
      ) {
        takeDamage(world);
        break;
      }
    }
  }

  // Ăn tiền vàng
  for (const coin of world.coins) {
    if (coin.taken) continue;
    if (
      rectsOverlap(
        world.marioX,
        world.marioY,
        MARIO_W,
        MARIO_H,
        coin.x,
        coin.y,
        COIN_SIZE,
        COIN_SIZE,
      )
    ) {
      coin.taken = true;
      world.coinsCollected += 1;
    }
  }

  // Dọn phần đã ra khỏi màn hình rồi sinh thêm phía trước
  world.obstacles = world.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -40);
  world.coins = world.coins.filter((coin) => !coin.taken && coin.x + COIN_SIZE > -40);

  let guard = 0;
  while (world.spawnCursor < world.areaWidth + 40 && guard < 20) {
    spawnChunk(world);
    guard += 1;
  }
}

function snapshot(world: World): Frame {
  return {
    marioX: world.marioX,
    marioY: world.marioY,
    onGround: world.onGround,
    blinking:
      world.time < world.invulnerableUntil && Math.floor(world.time * 10) % 2 === 0,
    obstacles: world.obstacles.map((obstacle) => ({ ...obstacle })),
    coins: world.coins.map((coin) => ({ ...coin })),
    coinsCollected: world.coinsCollected,
    lives: world.lives,
    distance: world.distance,
  };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function MarioMiniGame({ onExit }: { onExit: () => void }) {
  const { isPlaying } = usePlaytime();
  const windowSize = useWindowDimensions();

  /**
   * Kích thước khung chơi. Khởi tạo bằng con số ước lượng từ kích thước cửa sổ
   * rồi mới chỉnh lại theo `onLayout` — nếu chờ `onLayout` mới tạo thế giới thì
   * màn hình sẽ trắng trong trường hợp sự kiện đó bị chậm hoặc không kích hoạt.
   */
  const [area, setArea] = useState(() => ({
    width: Math.max(240, windowSize.width - spacing.md * 2),
    height: Math.max(200, Math.min(300, windowSize.height * 0.42)),
  }));
  const [phase, setPhase] = useState<'playing' | 'gameOver'>('playing');
  const [frame, setFrame] = useState<Frame | null>(null);
  const [best, setBest] = useState(0);

  const worldRef = useRef<World | null>(null);
  const inputRef = useRef<Input>({ direction: 0, jumpRequested: false });
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    // Bỏ qua số đo 0 (một số môi trường báo về 0 ở lần layout đầu)
    if (width <= 0 || height <= 0) return;
    setArea((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height },
    );
  }, []);

  const startNewRun = useCallback(() => {
    if (area.width <= 0 || area.height <= 0) return;
    worldRef.current = createWorld(area.width, area.height);
    inputRef.current = { direction: 0, jumpRequested: false };
    setFrame(snapshot(worldRef.current));
    setPhase('playing');
  }, [area.height, area.width]);

  // Tạo thế giới khi đã biết kích thước khung chơi
  useEffect(() => {
    if (area.width <= 0 || area.height <= 0) return;

    if (!worldRef.current) {
      startNewRun();
      return;
    }
    // Xoay ngang/dọc: cập nhật kích thước, không xoá tiến trình đang chơi
    worldRef.current.areaWidth = area.width;
    worldRef.current.areaHeight = area.height;
  }, [area.height, area.width, startNewRun]);

  // Vòng lặp game — chỉ chạy khi đồng hồ thời gian chơi đang đếm
  useEffect(() => {
    if (!isPlaying || phase !== 'playing' || !worldRef.current) return;

    lastTimeRef.current = Date.now();

    const step = () => {
      const world = worldRef.current;
      if (!world) return;

      const now = Date.now();
      // Chặn dt quá lớn để không "nhảy" xuyên qua chướng ngại vật
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      advance(world, dt, inputRef.current);
      inputRef.current.jumpRequested = false;

      setFrame(snapshot(world));

      if (world.lives <= 0) {
        setBest((prev) => Math.max(prev, world.coinsCollected));
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

  const press = useCallback((direction: number) => {
    inputRef.current.direction = direction;
  }, []);

  const jump = useCallback(() => {
    inputRef.current.jumpRequested = true;
  }, []);

  const groundTop = area.height - GROUND_H;

  return (
    <GameShell
      title="Mario Mini"
      emoji="🍄"
      color={colors.danger}
      scoreLabel={
        frame
          ? `🪙 ${frame.coinsCollected}  ·  ${'❤️'.repeat(Math.max(0, frame.lives))}  ·  ${Math.round(frame.distance / 10)} m`
          : undefined
      }
      onExit={onExit}
    >
      <View style={styles.container}>
        <View style={styles.playArea} onLayout={handleLayout}>
          {/* Mây trang trí */}
          <Text style={[styles.cloud, { left: '18%', top: 12 }]}>☁️</Text>
          <Text style={[styles.cloud, { left: '62%', top: 26 }]}>☁️</Text>

          {area.height > 0 && (
            <>
              {/* Mặt đất */}
              <View style={[styles.ground, { top: groundTop, height: GROUND_H }]}>
                <View style={styles.grass} />
              </View>

              {frame?.obstacles.map((obstacle) =>
                obstacle.type === 'pit' ? (
                  // Hố: khoét một khoảng trời trên mặt đất
                  <View
                    key={obstacle.id}
                    style={[
                      styles.pit,
                      { left: obstacle.x, width: obstacle.width, top: groundTop, height: GROUND_H },
                    ]}
                  />
                ) : (
                  <Text
                    key={obstacle.id}
                    style={[
                      styles.mushroom,
                      { left: obstacle.x, top: groundTop - MUSHROOM_H },
                    ]}
                  >
                    🍄
                  </Text>
                ),
              )}

              {frame?.coins.map((coin) => (
                <Text key={coin.id} style={[styles.coin, { left: coin.x, top: coin.y }]}>
                  🪙
                </Text>
              ))}

              {frame && !frame.blinking && (
                <Mario x={frame.marioX} y={frame.marioY} jumping={!frame.onGround} />
              )}

              {phase === 'gameOver' && (
                <View style={styles.gameOverOverlay}>
                  <Text style={styles.gameOverEmoji}>🎮</Text>
                  <Text style={styles.gameOverTitle}>Hết mạng rồi!</Text>
                  <Text style={styles.gameOverScore}>
                    Ăn được {frame?.coinsCollected ?? 0} tiền vàng
                    {best > 0 ? ` · Cao nhất: ${best}` : ''}
                  </Text>
                  <Pressable
                    onPress={startNewRun}
                    accessibilityRole="button"
                    accessibilityLabel="Chơi lại Mario Mini"
                    style={({ pressed }) => [styles.replayButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="refresh" size={20} color={colors.danger} />
                    <Text style={styles.replayText}>Chơi lại</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>

        {/* Bảng điều khiển */}
        <View style={styles.controls}>
          <View style={styles.dpad}>
            <ControlButton
              label="Đi sang trái"
              icon="chevron-back"
              onPressIn={() => press(-1)}
              onPressOut={() => press(0)}
            />
            <ControlButton
              label="Đi sang phải"
              icon="chevron-forward"
              onPressIn={() => press(1)}
              onPressOut={() => press(0)}
            />
          </View>

          <Pressable
            onPress={jump}
            accessibilityRole="button"
            accessibilityLabel="Nhảy"
            style={({ pressed }) => [styles.jumpButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-up" size={26} color={colors.textOnPrimary} />
            <Text style={styles.jumpText}>NHẢY</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Giữ nút ◀ ▶ để di chuyển, bấm NHẢY để vượt qua nấm và hố.
        </Text>
      </View>
    </GameShell>
  );
}

/** Nhân vật Mario, ghép từ các View nên hiển thị giống nhau trên mọi máy */
function Mario({ x, y, jumping }: { x: number; y: number; jumping: boolean }) {
  return (
    <View style={[styles.mario, { left: x, top: y }]}>
      <View style={styles.marioCap} />
      <View style={styles.marioFace}>
        <View style={styles.marioEye} />
        <View style={styles.marioEye} />
      </View>
      <View style={styles.marioBody} />
      <View style={[styles.marioLegs, jumping && styles.marioLegsJumping]} />
    </View>
  );
}

function ControlButton({
  label,
  icon,
  onPressIn,
  onPressOut,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPressIn: () => void;
  onPressOut: () => void;
}) {
  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.controlButton, pressed && styles.controlPressed]}
    >
      <Ionicons name={icon} size={28} color={colors.text} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, gap: spacing.md },

  playArea: {
    flex: 1,
    backgroundColor: '#BFE3FF',
    borderRadius: radius.lg,
    overflow: 'hidden',
    minHeight: 200,
  },
  cloud: { position: 'absolute', fontSize: 26, opacity: 0.9 },

  ground: { position: 'absolute', left: 0, right: 0, backgroundColor: '#8B5A2B' },
  grass: { height: 7, backgroundColor: '#4ADE80' },
  pit: { position: 'absolute', backgroundColor: '#BFE3FF' },

  mushroom: { position: 'absolute', fontSize: MUSHROOM_H },
  coin: { position: 'absolute', fontSize: COIN_SIZE },

  // Mario
  mario: { position: 'absolute', width: MARIO_W, height: MARIO_H, alignItems: 'center' },
  marioCap: {
    width: MARIO_W,
    height: 7,
    backgroundColor: '#DC2626',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  marioFace: {
    width: MARIO_W - 6,
    height: 10,
    backgroundColor: '#FCD9A8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  marioEye: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#1E293B' },
  marioBody: {
    width: MARIO_W,
    height: 10,
    backgroundColor: '#EF4444',
    borderRadius: 3,
  },
  marioLegs: { width: MARIO_W - 8, height: 5, backgroundColor: '#1D4ED8', borderRadius: 2 },
  marioLegsJumping: { width: MARIO_W - 14 },

  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15,23,42,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
  },
  gameOverEmoji: { fontSize: 44 },
  gameOverTitle: { color: colors.textOnPrimary, fontSize: 22, fontWeight: '800' },
  gameOverScore: {
    color: '#CBD5E1',
    fontSize: 14,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  replayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  replayText: { color: colors.danger, fontSize: 16, fontWeight: '800' },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dpad: { flexDirection: 'row', gap: spacing.md },
  controlButton: {
    width: 68,
    height: 62,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlPressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  jumpButton: {
    flex: 1,
    height: 62,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpText: { color: colors.textOnPrimary, fontSize: 13, fontWeight: '800' },

  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  pressed: { opacity: 0.8 },
});
