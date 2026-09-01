import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors, elevation, radius, spacing, touch } from '../../constants/theme';
import { usePlaytime } from '../../context/PlaytimeContext';
import { playGameSound, setGameSoundEnabled } from '../../lib/gameSound';
import GameShell from './GameShell';
import {
  advance,
  buyUpgrade,
  buyWeapon,
  createWorld,
  cycleWeapon,
  drainEvents,
  priceAt,
  selectWeapon,
  snapshot,
  UPGRADE_ORDER,
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
const JOYSTICK_SIZE = 128;
const JOYSTICK_KNOB = 52;

type Phase = 'start' | 'playing' | 'shop' | 'gameOver';

/* ------------------------------------------------------------------ */
/* Các phần vẽ nhỏ, bọc React.memo để không vẽ lại khi không cần        */
/* ------------------------------------------------------------------ */

const ZOMBIE_LOOK: Record<
  string,
  { emoji: string; color: string; label: string }
> = {
  normal: { emoji: '🧟', color: '#65A30D', label: 'Zombie thường' },
  fast: { emoji: '🧟‍♂️', color: '#0EA5E9', label: 'Zombie nhanh' },
  tank: { emoji: '🧟‍♀️', color: '#7C3AED', label: 'Zombie Tank' },
  boomer: { emoji: '💀', color: '#F97316', label: 'Zombie Nổ' },
  boss: { emoji: '👹', color: '#DC2626', label: 'BOSS' },
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
  const hurt = hp < maxHp;
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
      {hurt && (
        <View style={styles.zombieHpTrack}>
          <View
            style={[
              styles.zombieHpFill,
              { width: `${Math.max(0, (hp / maxHp) * 100)}%` },
            ]}
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

/* ------------------------------------------------------------------ */
/* Cần điều khiển ảo                                                   */
/* ------------------------------------------------------------------ */

function Joystick({
  onMove,
}: {
  /** Trả về vector trong khoảng [-1, 1]; (0, 0) nghĩa là nhả tay */
  onMove: (x: number, y: number) => void;
}) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const maxTravel = (JOYSTICK_SIZE - JOYSTICK_KNOB) / 2;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
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
      accessibilityHint="Kéo để chạy theo hướng mình muốn"
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
    width: Math.max(260, windowSize.width - spacing.md * 2),
    height: Math.max(220, Math.min(420, windowSize.height * 0.46)),
  }));

  const [phase, setPhase] = useState<Phase>('start');
  const [frame, setFrame] = useState<Frame | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [shopNote, setShopNote] = useState<string | null>(null);

  const worldRef = useRef<World | null>(null);
  /**
   * `firing` là "đang giữ nút", `fireOnce` là "vừa bấm một nhịp".
   * Cần cả hai: trẻ con hay bấm liên tục thay vì giữ, nếu chỉ có `firing` thì
   * mỗi cú bấm nhanh chỉ trúng đúng một khung hình và thường không kịp bắn.
   */
  const inputRef = useRef({ moveX: 0, moveY: 0, firing: false, fireOnce: false });
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

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
    inputRef.current = { moveX: 0, moveY: 0, firing: false, fireOnce: false };
    setFrame(snapshot(worldRef.current));
    setShopNote(null);
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

  // Vòng lặp game — chỉ chạy khi đồng hồ giờ chơi đang đếm và không mở shop
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
      });
      input.fireOnce = false;

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

  const handleCycleWeapon = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    cycleWeapon(world);
    setFrame(snapshot(world));
  }, []);

  const openShop = useCallback(() => {
    // Nhả nút bắn để khi đóng shop không bắn liên tục ngoài ý muốn
    inputRef.current.firing = false;
    inputRef.current.moveX = 0;
    inputRef.current.moveY = 0;
    setShopNote(null);
    setPhase('shop');
  }, []);

  const closeShop = useCallback(() => setPhase('playing'), []);

  const handleBuyUpgrade = useCallback((id: UpgradeId) => {
    const world = worldRef.current;
    if (!world) return;
    const result = buyUpgrade(world, id);
    setFrame(snapshot(world));
    setShopNote(
      result.ok
        ? `Đã nâng cấp ${UPGRADES[id].name}!`
        : result.reason === 'maxLevel'
          ? `${UPGRADES[id].name} đã đạt bậc tối đa.`
          : 'Chưa đủ vàng, hạ thêm zombie nhé!',
    );
  }, []);

  const handleBuyWeapon = useCallback((id: WeaponId) => {
    const world = worldRef.current;
    if (!world) return;
    const result = buyWeapon(world, id);
    setFrame(snapshot(world));
    setShopNote(
      result.ok
        ? `Đã mua ${WEAPONS[id].name}!`
        : result.reason === 'alreadyOwned'
          ? `Em đã có ${WEAPONS[id].name}.`
          : 'Chưa đủ vàng, hạ thêm zombie nhé!',
    );
  }, []);

  const handlePickWeapon = useCallback((id: WeaponId) => {
    const world = worldRef.current;
    if (!world) return;
    if (selectWeapon(world, id)) setFrame(snapshot(world));
  }, []);

  const hpRatio = frame ? Math.max(0, frame.hp / frame.maxHp) : 1;

  return (
    <GameShell
      title="Bắn Zombie"
      emoji="🧟"
      color="#166534"
      scoreLabel={
        frame && phase !== 'start'
          ? `Wave ${frame.wave}  ·  🪙 ${frame.gold}  ·  ⭐ ${frame.score}`
          : undefined
      }
      onExit={onExit}
    >
      <View style={styles.container}>
        {/*
          Bảng chỉ số nằm THÀNH HÀNG RIÊNG phía trên sân chơi, còn cần điều
          khiển ở hàng riêng phía dưới. Nhờ tách hàng như vậy, nút bấm và cần
          điều khiển không bao giờ đè lên máu / vàng / tên súng.
        */}
        <View style={styles.hud}>
          <View style={styles.hpBlock}>
            <Text style={styles.hudLabel}>❤️ Máu</Text>
            <View style={styles.hpTrack}>
              <View
                style={[
                  styles.hpFill,
                  {
                    width: `${hpRatio * 100}%`,
                    backgroundColor:
                      hpRatio > 0.5
                        ? colors.success
                        : hpRatio > 0.25
                          ? colors.warning
                          : colors.danger,
                  },
                ]}
              />
            </View>
            <Text style={styles.hpText}>
              {frame ? `${Math.ceil(frame.hp)}/${frame.maxHp}` : '--'}
            </Text>
          </View>

          <View style={styles.hudChip}>
            <Text style={styles.hudChipLabel}>🪙 Vàng</Text>
            <Text style={styles.hudChipValue}>{frame ? frame.gold : 0}</Text>
          </View>
          <View style={styles.hudChip}>
            <Text style={styles.hudChipLabel}>
              {WEAPONS[frame?.weapon ?? 'pistol'].emoji} Súng
            </Text>
            <Text style={styles.hudChipValue} numberOfLines={1}>
              {WEAPONS[frame?.weapon ?? 'pistol'].name}
            </Text>
          </View>
        </View>

        {/* ---------------- Sân chơi ---------------- */}
        <View style={styles.playArea} onLayout={handleLayout}>
          {frame && phase !== 'start' && (
            <>
              {frame.golds.map((g) => (
                <DotView key={g.id} x={g.x} y={g.y} size={11} color="#FBBF24" />
              ))}
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
              {frame.bullets.map((b) => (
                <DotView key={b.id} x={b.x} y={b.y} size={b.radius * 2} color="#FDE047" />
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
                  },
                ]}
              >
                <Text style={styles.playerEmoji}>🧑‍🚀</Text>
              </View>

              <Text style={styles.waveTag}>
                Wave {frame.wave} · còn {frame.zombiesLeft} zombie · đã hạ{' '}
                {frame.kills}
                {frame.bossAlive ? ' · 👹 BOSS!' : ''}
              </Text>
            </>
          )}

          {/* ---- Màn hình bắt đầu ---- */}
          {phase === 'start' && (
            <View style={styles.overlay}>
              <Text style={styles.overlayEmoji}>🧟‍♂️🔫</Text>
              <Text style={styles.overlayTitle}>Bắn Zombie & Nâng Cấp</Text>
              <Text style={styles.overlayText}>
                Dùng cần điều khiển bên trái để chạy, bấm hoặc giữ nút BẮN bên phải để
                tự nhắm zombie gần nhất. Hạ zombie để lấy vàng, mở SHOP mua súng mới và
                nâng cấp. Cứ {5} wave lại gặp một con BOSS!
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

          {/* ---- Kết thúc trận ---- */}
          {phase === 'gameOver' && frame && (
            <View style={styles.overlay}>
              <Text style={styles.overlayEmoji}>💀</Text>
              <Text style={styles.overlayTitle}>Em đã bị zombie hạ!</Text>
              <Text style={styles.overlayText}>
                Trụ được đến Wave {frame.wave} · hạ {frame.kills} zombie · thu được 🪙{' '}
                {frame.goldEarned} vàng.
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
                      {value === frame.score && index === scores.indexOf(frame.score) ? (
                        <Text style={styles.boardYou}>trận này</Text>
                      ) : null}
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

        {/* ---------------- Hàng điều khiển ---------------- */}
        <View style={styles.controls}>
          <Joystick onMove={handleJoystick} />

          <View style={styles.rightControls}>
            <View style={styles.smallButtonRow}>
              <Pressable
                onPress={handleCycleWeapon}
                accessibilityRole="button"
                accessibilityLabel="Đổi vũ khí"
                style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
              >
                <Text style={styles.smallButtonText}>🔄 Đổi súng</Text>
              </Pressable>
              <Pressable
                onPress={phase === 'shop' ? closeShop : openShop}
                accessibilityRole="button"
                accessibilityLabel={phase === 'shop' ? 'Đóng shop' : 'Mở shop nâng cấp'}
                style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
              >
                <Text style={styles.smallButtonText}>🛒 Shop</Text>
              </Pressable>
              <Pressable
                onPress={() => setSoundOn((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'}
                style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
              >
                <Text style={styles.smallButtonText}>{soundOn ? '🔊' : '🔇'}</Text>
              </Pressable>
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
              <Text style={styles.fireButtonHint}>bấm hoặc giữ để bắn</Text>
            </Pressable>
          </View>
        </View>

        {/* ---- Shop ---- */}
        {phase === 'shop' && frame && (
          <View style={styles.shopOverlay}>
            <View style={styles.shopHeader}>
              <Text style={styles.shopTitle}>🛒 Shop nâng cấp</Text>
              <Text style={styles.shopGold}>🪙 {frame.gold}</Text>
            </View>

            {shopNote ? <Text style={styles.shopNote}>{shopNote}</Text> : null}

            <ScrollView style={styles.shopScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.shopSection}>Kho vũ khí</Text>
              {WEAPON_ORDER.map((id) => {
                const spec = WEAPONS[id];
                const owned = frame.ownedWeapons.includes(id);
                const active = frame.weapon === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => (owned ? handlePickWeapon(id) : handleBuyWeapon(id))}
                    accessibilityRole="button"
                    accessibilityLabel={
                      owned ? `Chọn ${spec.name}` : `Mua ${spec.name} giá ${spec.price} vàng`
                    }
                    style={({ pressed }) => [
                      styles.shopRow,
                      active && styles.shopRowActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.shopRowEmoji}>{spec.emoji}</Text>
                    <View style={styles.shopRowText}>
                      <Text style={styles.shopRowName}>{spec.name}</Text>
                      <Text style={styles.shopRowHint}>{spec.hint}</Text>
                    </View>
                    <Text style={styles.shopRowPrice}>
                      {active ? 'ĐANG DÙNG' : owned ? 'CHỌN' : `🪙 ${spec.price}`}
                    </Text>
                  </Pressable>
                );
              })}

              <Text style={styles.shopSection}>Nâng cấp</Text>
              {UPGRADE_ORDER.map((id) => {
                const spec = UPGRADES[id];
                const level = frame.upgrades[id];
                const price = priceAt(id, level);
                return (
                  <Pressable
                    key={id}
                    onPress={() => handleBuyUpgrade(id)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      price === null
                        ? `${spec.name} đã tối đa`
                        : `Nâng cấp ${spec.name} giá ${price} vàng`
                    }
                    style={({ pressed }) => [styles.shopRow, pressed && styles.pressed]}
                  >
                    <Text style={styles.shopRowEmoji}>{spec.emoji}</Text>
                    <View style={styles.shopRowText}>
                      <Text style={styles.shopRowName}>
                        {spec.name} · bậc {level}/{spec.maxLevel}
                      </Text>
                      <Text style={styles.shopRowHint}>
                        {level > 0 ? spec.describe(level) : 'Chưa nâng cấp'}
                      </Text>
                    </View>
                    <Text style={styles.shopRowPrice}>
                      {price === null ? 'TỐI ĐA' : `🪙 ${price}`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={closeShop}
              accessibilityRole="button"
              accessibilityLabel="Đóng shop, chơi tiếp"
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>CHƠI TIẾP</Text>
            </Pressable>
          </View>
        )}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, gap: spacing.sm },

  // ---- Bảng chỉ số ----
  hud: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hpBlock: { flex: 1, gap: 2 },
  hudLabel: { fontSize: 10, fontWeight: '800', color: colors.textMuted },
  hpTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  hpFill: { height: '100%', borderRadius: radius.pill },
  hpText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  hudChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minWidth: 78,
    ...elevation(1),
  },
  hudChipLabel: { fontSize: 9, fontWeight: '800', color: colors.textMuted },
  hudChipValue: { fontSize: 13, fontWeight: '800', color: colors.text },

  // ---- Sân chơi ----
  playArea: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  entity: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  player: { backgroundColor: colors.primary, borderWidth: 2, borderColor: '#BFDBFE' },
  playerEmoji: { fontSize: 16 },
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
  waveTag: {
    position: 'absolute',
    top: 6,
    left: 8,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.75)',
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
  overlayEmoji: { fontSize: 40 },
  overlayTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textOnPrimary,
    textAlign: 'center',
  },
  overlayText: {
    fontSize: 13,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 19,
  },

  board: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  boardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.reward,
    marginBottom: 2,
  },
  boardEmpty: { fontSize: 12, color: '#94A3B8' },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  boardRank: { fontSize: 13, width: 24 },
  boardScore: { fontSize: 13, fontWeight: '700', color: colors.textOnPrimary, flex: 1 },
  boardYou: { fontSize: 10, fontWeight: '800', color: colors.reward },

  primaryButton: {
    minHeight: touch.primary,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.reward,
    ...elevation(2),
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  pressed: { opacity: 0.7 },

  // ---- Shop ----
  /**
   * Shop phủ TOÀN BỘ thân game, không chỉ phủ sân chơi: sân chơi chiếm khoảng
   * 46% chiều cao màn hình, nhét 4 khẩu súng + 7 nâng cấp vào đó thì trên điện
   * thoại nhỏ phải cuộn rất nhiều.
   */
  shopOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15,23,42,0.97)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  shopHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shopTitle: { fontSize: 17, fontWeight: '800', color: colors.textOnPrimary },
  shopGold: { fontSize: 15, fontWeight: '800', color: colors.reward },
  shopNote: { fontSize: 12, fontWeight: '700', color: '#FDE047' },
  shopScroll: { flex: 1 },
  shopSection: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touch.min,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: 6,
  },
  shopRowActive: { backgroundColor: 'rgba(245,158,11,0.22)' },
  shopRowEmoji: { fontSize: 20 },
  shopRowText: { flex: 1 },
  shopRowName: { fontSize: 13, fontWeight: '800', color: colors.textOnPrimary },
  shopRowHint: { fontSize: 11, color: '#94A3B8' },
  shopRowPrice: { fontSize: 12, fontWeight: '800', color: colors.reward },

  // ---- Điều khiển ----
  controls: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  joystickBase: {
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE,
    borderRadius: JOYSTICK_SIZE / 2,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joystickHint: {
    position: 'absolute',
    bottom: 8,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
  },
  joystickKnob: {
    width: JOYSTICK_KNOB,
    height: JOYSTICK_KNOB,
    borderRadius: JOYSTICK_KNOB / 2,
    backgroundColor: colors.primary,
    ...elevation(2),
  },

  rightControls: { flex: 1, gap: spacing.sm },
  smallButtonRow: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'flex-end' },
  smallButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallButtonText: { fontSize: 11, fontWeight: '800', color: colors.text },

  fireButton: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.danger,
    ...elevation(2),
  },
  fireButtonOn: { backgroundColor: '#B91C1C' },
  fireButtonText: { color: colors.textOnPrimary, fontWeight: '800', fontSize: 22 },
  fireButtonHint: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700' },
});
