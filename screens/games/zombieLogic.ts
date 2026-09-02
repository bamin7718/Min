/**
 * Toàn bộ luật chơi của game Bắn Zombie, tách riêng khỏi phần vẽ.
 *
 * Vì file này không import React hay react-native, có thể chạy trực tiếp bằng
 * Node để kiểm thử: cân bằng độ khó, kiểm tra zombie không đi xuyên tường, tiền
 * vàng không âm, nâng cấp không vượt trần...
 *
 * Hệ toạ độ: gốc ở góc trên bên trái khung chơi, đơn vị là điểm (dp), y tăng
 * xuống dưới — giống hệ toạ độ của View trong React Native để phần vẽ không
 * phải quy đổi.
 */

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu                                                        */
/* ------------------------------------------------------------------ */

export type ZombieKind = 'normal' | 'fast' | 'tank' | 'boomer' | 'boss';
export type WeaponId = 'pistol' | 'shotgun' | 'smg' | 'sniper' | 'minigun';
export type UpgradeId =
  | 'damage'
  | 'fireRate'
  | 'moveSpeed'
  | 'maxHp'
  | 'goldBonus'
  | 'multishot'
  | 'pierce';

/**
 * Vật phẩm hỗ trợ tạm thời, rơi ra khi hạ zombie.
 *  - shield: bất tử trong SHIELD_SECONDS giây
 *  - nuke:   nổ tiêu diệt toàn bộ zombie THƯỜNG đang có trên sân
 *  - frenzy: nhân đôi tốc độ bắn trong FRENZY_SECONDS giây
 *  - goldbag: thưởng ngay một túi vàng
 *
 * Trước đây có vật phẩm 🧲 hút vàng trên sân. Vàng giờ tự cộng ngay khi zombie
 * chết nên không còn gì để hút, chỗ đó đổi thành túi vàng thưởng ngay.
 */
export type PowerUpKind = 'shield' | 'nuke' | 'frenzy' | 'goldbag';

/** Tín hiệu để phần vẽ phát âm thanh — logic không tự phát tiếng */
export type SoundEvent =
  | 'shoot'
  | 'hit'
  | 'explosion'
  | 'gold'
  | 'hurt'
  | 'wave'
  | 'boss'
  | 'powerup'
  | 'minigun'
  | 'gameOver';

export interface Player {
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  /** Thời gian còn miễn sát thương sau khi bị đánh (giây) */
  invuln: number;
  /** Hướng nhìn, dùng khi bắn mà không có zombie nào để nhắm */
  aimX: number;
  aimY: number;
  /** Giây còn lại của giáp bất tử (vật phẩm 🛡️) */
  shield: number;
  /** Giây còn lại của siêu tốc đạn (vật phẩm ⚡) */
  frenzy: number;
  /** Giây còn lại của tia lửa nòng súng — phần vẽ dùng để nhấp sáng đầu nòng */
  muzzleFlash: number;
  /** id zombie đang bị khoá mục tiêu, để vẽ tia ngắm */
  lockedTargetId: number | null;
  /**
   * Số bom huỷ diệt đang giữ trong tay (tuyệt chiêu).
   *
   * Trước đây nhặt 💣 là nổ ngay. Giữ lại để bấm nút mới dùng thì học sinh có
   * quyền chọn thời điểm — dành bom cho wave boss thay vì tiêu mất nó lúc sân
   * chỉ có vài con zombie thường.
   */
  bombs: number;
}

export interface Zombie {
  id: number;
  kind: ZombieKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  /** Sát thương mỗi lần chạm vào người chơi */
  damage: number;
  gold: number;
  /** Đếm ngược tới lần gây sát thương tiếp theo, tránh trừ máu mỗi khung hình */
  attackCd: number;
  /** > 0 nghĩa là vừa trúng đạn, phần vẽ nhấp màu trắng */
  hitFlash: number;
  /** Chỉ boss dùng: đếm ngược tới lượt bắn và lượt triệu hồi */
  shootCd?: number;
  summonCd?: number;
}

export type BulletLook = 'normal' | 'tracer' | 'crit';

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  /** Cách vẽ viên đạn: điểm thường, vệt sáng, hay đạn chí mạng */
  look: BulletLook;
  /** Số zombie còn có thể xuyên qua */
  pierce: number;
  radius: number;
  /** Danh sách zombie đã trúng, để một viên không trừ máu cùng con hai lần */
  hitIds: number[];
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

/**
 * Số vàng nảy lên khi hạ zombie ("+$5").
 *
 * Không còn cục vàng nằm trên đất phải chạy tới nhặt: vàng cộng thẳng vào ví
 * ngay lúc zombie chết, thứ này chỉ để người chơi THẤY mình vừa được bao nhiêu.
 */
export interface GoldPop {
  id: number;
  x: number;
  y: number;
  amount: number;
  /** Giây còn lại trước khi con số mờ đi và mất */
  ttl: number;
}

export interface PowerUpDrop {
  id: number;
  x: number;
  y: number;
  kind: PowerUpKind;
  /** Giây còn lại trước khi vật phẩm biến mất */
  ttl: number;
}

export interface Input {
  /** Vector di chuyển đã chuẩn hoá trong khoảng [-1, 1] */
  moveX: number;
  moveY: number;
  /** Đang giữ nút BẮN */
  firing: boolean;
  /**
   * Vừa bấm nút TUYỆT CHIÊU trong khung hình này.
   *
   * Là cờ một nhịp, không phải trạng thái giữ nút: nơi gọi đặt `true` khi bé bấm
   * rồi tự đặt lại `false` ngay sau `advance()`. Nếu để nó là trạng thái giữ thì
   * một lần bấm sẽ tiêu hết cả kho bom trong vài khung hình.
   */
  useBomb: boolean;
}

/** Số bom tối đa giữ được cùng lúc */
export const MAX_BOMBS = 3;

export interface World {
  areaW: number;
  areaH: number;
  player: Player;
  zombies: Zombie[];
  bullets: Bullet[];
  enemyBullets: Bullet[];
  particles: Particle[];
  goldPops: GoldPop[];
  powerUps: PowerUpDrop[];

  wave: number;
  /** Số zombie còn phải sinh ra trong wave hiện tại */
  spawnQueue: number;
  /** Đếm ngược tới lần sinh zombie tiếp theo */
  spawnCd: number;
  /** Nghỉ giữa hai wave */
  restCd: number;
  bossAlive: boolean;

  gold: number;
  /** Tổng vàng đã thu cả trận, dùng cho màn kết thúc */
  goldEarned: number;
  score: number;
  kills: number;

  weapon: WeaponId;
  ownedWeapons: WeaponId[];
  fireCd: number;
  upgrades: Record<UpgradeId, number>;

  status: 'playing' | 'gameOver';
  /** Phần vẽ đọc rồi xoá, để phát âm thanh */
  events: SoundEvent[];

  nextId: number;
  /** Bộ sinh số ngẫu nhiên có thể đặt hạt giống, giúp kiểm thử lặp lại được */
  seed: number;
}

/* ------------------------------------------------------------------ */
/* Hằng số cân bằng                                                    */
/* ------------------------------------------------------------------ */

export const MAX_ZOMBIES_ALIVE = 18;
export const MAX_BULLETS = 48;
export const MAX_PARTICLES = 26;
export const MAX_GOLD_POPS = 10;
export const MAX_POWERUPS = 4;
/** Cứ 5 wave lại có một con boss */
export const BOSS_EVERY = 5;

/* ---- Vật phẩm buff ---- */
export const SHIELD_SECONDS = 5;
/** Số vàng của vật phẩm 💰 Túi vàng */
export const GOLDBAG_AMOUNT = 40;
export const FRENZY_SECONDS = 6;
/** Vật phẩm nằm chờ trên sân bao lâu thì biến mất */
export const POWERUP_TTL = 12;

export interface PowerUpSpec {
  kind: PowerUpKind;
  emoji: string;
  name: string;
  hint: string;
  color: string;
}

export const POWERUPS: Record<PowerUpKind, PowerUpSpec> = {
  shield: {
    kind: 'shield',
    emoji: '🛡️',
    name: 'Giáp bất tử',
    hint: `Không mất máu trong ${SHIELD_SECONDS} giây`,
    color: '#38BDF8',
  },
  nuke: {
    kind: 'nuke',
    emoji: '💣',
    name: 'Bom huỷ diệt',
    // Nhặt là CẤT vào kho, bấm nút tuyệt chiêu mới nổ — xem `detonateBomb`
    hint: 'Cất vào kho, bấm 💣 để nổ hạ sạch zombie thường',
    color: '#F97316',
  },
  frenzy: {
    kind: 'frenzy',
    emoji: '⚡',
    name: 'Siêu tốc đạn',
    hint: `Bắn nhanh gấp đôi trong ${FRENZY_SECONDS} giây`,
    color: '#FACC15',
  },
  goldbag: {
    kind: 'goldbag',
    emoji: '💰',
    name: 'Túi vàng',
    hint: `Thưởng ngay ${GOLDBAG_AMOUNT} vàng`,
    color: '#A78BFA',
  },
};

export const POWERUP_ORDER: PowerUpKind[] = ['shield', 'nuke', 'frenzy', 'goldbag'];

/**
 * Tỉ lệ rơi vật phẩm theo loại zombie. Zombie khoẻ thì rơi nhiều hơn để việc
 * hạ chúng đáng công sức; boss thì chắc chắn rơi.
 */
const DROP_CHANCE: Record<ZombieKind, number> = {
  normal: 0.05,
  fast: 0.05,
  boomer: 0.08,
  tank: 0.18,
  boss: 1,
};

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  emoji: string;
  /** Sát thương mỗi viên */
  damage: number;
  /** Giây giữa hai lần bắn */
  interval: number;
  bulletSpeed: number;
  /** Số viên mỗi lần bắn (shotgun bắn chùm) */
  pellets: number;
  /** Độ toả của chùm đạn, tính bằng radian */
  spread: number;
  /** Số zombie viên đạn xuyên qua được */
  pierce: number;
  bulletRadius: number;
  /** Giá mua trong shop, 0 nghĩa là có sẵn từ đầu */
  price: number;
  hint: string;
  /**
   * Độ chệch NGẪU NHIÊN của từng viên, tính bằng radian.
   * Khác `spread`: spread là góc toả cố định của chùm đạn (súng hoa cải), còn
   * jitter làm mỗi viên lệch một chút khác nhau — cảm giác xả đạn thật hơn.
   */
  jitter?: number;
  /** Tỉ lệ gây sát thương chí mạng, 0..1 */
  critChance?: number;
  /** Sát thương chí mạng nhân mấy lần */
  critMultiplier?: number;
  /** Đạn vẽ thành vệt sáng dài thay vì điểm tròn */
  tracer?: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  pistol: {
    id: 'pistol',
    name: 'Súng lục',
    emoji: '🔫',
    damage: 13,
    interval: 0.34,
    bulletSpeed: 430,
    pellets: 1,
    spread: 0,
    pierce: 0,
    bulletRadius: 4,
    price: 0,
    hint: 'Cân bằng, có sẵn từ đầu',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Súng hoa cải',
    emoji: '💥',
    damage: 9,
    interval: 0.8,
    bulletSpeed: 380,
    pellets: 5,
    spread: 0.44,
    pierce: 0,
    bulletRadius: 4,
    price: 120,
    hint: 'Bắn chùm 5 viên toả rộng',
  },
  smg: {
    id: 'smg',
    name: 'Súng máy',
    emoji: '🌀',
    damage: 6,
    interval: 0.1,
    bulletSpeed: 500,
    pellets: 1,
    spread: 0.13,
    pierce: 0,
    bulletRadius: 3,
    price: 190,
    hint: 'Bắn rất nhanh, mỗi viên nhẹ',
  },
  sniper: {
    id: 'sniper',
    name: 'Súng bắn tỉa',
    emoji: '🎯',
    damage: 58,
    interval: 1.05,
    bulletSpeed: 900,
    pellets: 1,
    spread: 0,
    pierce: 3,
    bulletRadius: 5,
    price: 300,
    hint: 'Sát thương rất lớn, xuyên 3 zombie',
  },
  minigun: {
    id: 'minigun',
    name: 'Súng liên thanh',
    emoji: '💥',
    damage: 20,
    // 50ms/viên — nhanh gấp gần 7 lần súng lục (340ms)
    interval: 0.05,
    bulletSpeed: 620,
    pellets: 1,
    spread: 0,
    pierce: 0,
    bulletRadius: 4,
    price: 100,
    hint: 'Xả mưa đạn, có cơ hội gây sát thương chí mạng',
    // ±5° cho mỗi viên
    jitter: (5 * Math.PI) / 180,
    critChance: 0.22,
    critMultiplier: 2.2,
    tracer: true,
  },
};

export const WEAPON_ORDER: WeaponId[] = [
  'pistol',
  'shotgun',
  'smg',
  'sniper',
  'minigun',
];

export interface UpgradeSpec {
  id: UpgradeId;
  name: string;
  emoji: string;
  maxLevel: number;
  /** Giá bậc đầu; mỗi bậc sau đắt hơn theo `priceAt()` */
  basePrice: number;
  /** Nhãn ngắn hiện trên ô nâng cấp, vd "+15 dmg" */
  step: string;
  describe: (level: number) => string;
}

/* ---- Mỗi bậc nâng cấp cộng một lượng CỐ ĐỊNH ---- */
export const DAMAGE_STEP = 15;
export const FIRE_RATE_STEP_MS = 50;
/**
 * Khoảng nghỉ giữa hai phát không được xuống dưới mức này.
 * 0.04 chứ không phải 0.06: súng liên thanh vốn đã là 0.05, sàn 0.06 sẽ kẹp nó
 * chậm lại và nâng cấp tốc độ bắn thành vô nghĩa với khẩu đó.
 */
export const MIN_FIRE_INTERVAL = 0.04;
export const MOVE_SPEED_STEP = 0.5;
/** 1 điểm "tốc độ" của mẫu tương ứng bao nhiêu dp/giây */
export const MOVE_SPEED_UNIT = 22;
export const MAX_HP_STEP = 25;

export const UPGRADES: Record<UpgradeId, UpgradeSpec> = {
  damage: {
    id: 'damage',
    name: 'Sát thương',
    emoji: '⚔️',
    maxLevel: 10,
    basePrice: 20,
    step: '+15 dmg',
    describe: (l) => `+${l * DAMAGE_STEP} sát thương`,
  },
  fireRate: {
    id: 'fireRate',
    name: 'Tốc độ bắn',
    emoji: '⚡',
    maxLevel: 5,
    basePrice: 30,
    step: '-50ms',
    describe: (l) => `Bắn nhanh hơn ${l * FIRE_RATE_STEP_MS}ms`,
  },
  moveSpeed: {
    id: 'moveSpeed',
    name: 'Tốc độ chạy',
    emoji: '🏃',
    maxLevel: 8,
    basePrice: 25,
    step: '+0.5',
    describe: (l) => `+${(l * 0.5).toFixed(1)} tốc độ chạy`,
  },
  maxHp: {
    id: 'maxHp',
    name: 'Máu tối đa',
    emoji: '🛡️',
    maxLevel: 10,
    basePrice: 35,
    step: '+25 max',
    describe: (l) => `+${l * MAX_HP_STEP} máu tối đa`,
  },
  multishot: {
    id: 'multishot',
    name: 'Đa đạn',
    emoji: '🔱',
    maxLevel: 3,
    basePrice: 60,
    step: '+1 viên',
    describe: (l) => `Mỗi lượt bắn thêm ${l} viên`,
  },
  pierce: {
    id: 'pierce',
    name: 'Xuyên giáp',
    emoji: '🎯',
    maxLevel: 3,
    basePrice: 50,
    step: '+1 xuyên',
    describe: (l) => `Đạn xuyên thêm ${l} zombie`,
  },
  goldBonus: {
    id: 'goldBonus',
    name: 'Thưởng vàng',
    emoji: '🧲',
    maxLevel: 6,
    basePrice: 20,
    step: '+25% vàng',
    describe: (l) => `Hạ zombie được thêm ${l * 25}% vàng`,
  },
};

/** Thứ tự 8 ô trong lưới nâng cấp 2 cột × 4 hàng (ô "Hồi máu" chèn ở vị trí 4) */
export const UPGRADE_ORDER: UpgradeId[] = [
  'damage',
  'fireRate',
  'moveSpeed',
  'maxHp',
  'multishot',
  'pierce',
  'goldBonus',
];

/** Giá của bậc nâng cấp tiếp theo. Trả về `null` khi đã đạt bậc tối đa. */
export function priceAt(id: UpgradeId, currentLevel: number): number | null {
  const spec = UPGRADES[id];
  if (currentLevel >= spec.maxLevel) return null;
  return Math.round(spec.basePrice * (1 + currentLevel * 0.75));
}

/* ------------------------------------------------------------------ */
/* Hỗ trợ                                                             */
/* ------------------------------------------------------------------ */

/**
 * Bộ sinh số ngẫu nhiên tuyến tính đơn giản, gắn vào `world` thay vì dùng
 * `Math.random()`. Nhờ vậy bài kiểm thử đặt được hạt giống và chạy lại y hệt.
 */
function rand(world: World): number {
  world.seed = (world.seed * 1664525 + 1013904223) % 4294967296;
  return world.seed / 4294967296;
}

function randRange(world: World, min: number, max: number): number {
  return min + rand(world) * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function pushEvent(world: World, event: SoundEvent): void {
  // Giữ hàng đợi ngắn: nếu phần vẽ chậm đọc thì cũng không phình bộ nhớ
  if (world.events.length < 12) world.events.push(event);
}

/* ------------------------------------------------------------------ */
/* Chỉ số dẫn xuất từ nâng cấp                                         */
/* ------------------------------------------------------------------ */

export function playerSpeed(world: World): number {
  // 6 điểm tốc độ cơ bản, mỗi bậc nâng cấp thêm 0.5 điểm
  const points = 6 + world.upgrades.moveSpeed * MOVE_SPEED_STEP;
  return points * MOVE_SPEED_UNIT;
}

export function bulletDamage(world: World): number {
  return WEAPONS[world.weapon].damage + world.upgrades.damage * DAMAGE_STEP;
}

export function fireInterval(world: World): number {
  // Mỗi bậc bớt 50ms, nhưng có sàn: nếu không chặn thì súng máy (100ms) chỉ cần
  // 2 bậc là về 0 và bắn vô hạn phát mỗi khung hình.
  const base = Math.max(
    MIN_FIRE_INTERVAL,
    WEAPONS[world.weapon].interval - (world.upgrades.fireRate * FIRE_RATE_STEP_MS) / 1000,
  );
  // Vật phẩm ⚡ nhân đôi tốc độ bắn, tức chia đôi khoảng nghỉ giữa hai phát
  return world.player.frenzy > 0 ? Math.max(MIN_FIRE_INTERVAL / 2, base / 2) : base;
}

/** Hệ số thưởng vàng theo bậc nâng cấp "Thưởng vàng" */
export function goldMultiplier(world: World): number {
  return 1 + world.upgrades.goldBonus * 0.25;
}

export function maxHpOf(world: World): number {
  return 100 + world.upgrades.maxHp * MAX_HP_STEP;
}

/* ------------------------------------------------------------------ */
/* Tạo thế giới                                                        */
/* ------------------------------------------------------------------ */

export function createWorld(areaW: number, areaH: number, seed = 20260901): World {
  const world: World = {
    areaW,
    areaH,
    player: {
      x: areaW / 2,
      y: areaH / 2,
      // 18 chứ không phải 14: trên điện thoại, nhân vật 14dp nhỏ hơn cả zombie
      // Tank nên rất khó nhìn thấy mình đang ở đâu giữa đám đông.
      radius: 18,
      hp: 100,
      maxHp: 100,
      invuln: 0,
      aimX: 0,
      aimY: -1,
      shield: 0,
      frenzy: 0,
      muzzleFlash: 0,
      lockedTargetId: null,
      bombs: 0,
    },
    zombies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    goldPops: [],
    powerUps: [],

    wave: 0,
    spawnQueue: 0,
    spawnCd: 0,
    restCd: 1.2,
    bossAlive: false,

    gold: 0,
    goldEarned: 0,
    score: 0,
    kills: 0,

    weapon: 'pistol',
    ownedWeapons: ['pistol'],
    fireCd: 0,
    upgrades: {
      damage: 0,
      fireRate: 0,
      moveSpeed: 0,
      maxHp: 0,
      goldBonus: 0,
      multishot: 0,
      pierce: 0,
    },

    status: 'playing',
    events: [],
    nextId: 1,
    seed,
  };
  return world;
}

/* ------------------------------------------------------------------ */
/* Sinh zombie                                                         */
/* ------------------------------------------------------------------ */

/** Số zombie của một wave */
export function waveSize(wave: number): number {
  return 5 + wave * 2;
}

/** Chọn loại zombie theo wave: càng về sau càng nhiều loại khó */
function pickKind(world: World): ZombieKind {
  const w = world.wave;
  const roll = rand(world);
  if (w <= 1) return roll < 0.85 ? 'normal' : 'fast';
  if (w <= 3) {
    if (roll < 0.6) return 'normal';
    if (roll < 0.9) return 'fast';
    return 'boomer';
  }
  if (roll < 0.42) return 'normal';
  if (roll < 0.68) return 'fast';
  if (roll < 0.86) return 'boomer';
  return 'tank';
}

function makeZombie(world: World, kind: ZombieKind): Zombie {
  const w = world.wave;
  const base = {
    normal: { hp: 30 + w * 6, speed: 44, radius: 13, damage: 8, gold: 4 },
    fast: { hp: 16 + w * 3, speed: 92, radius: 10, damage: 6, gold: 5 },
    tank: { hp: 90 + w * 22, speed: 26, radius: 19, damage: 16, gold: 12 },
    boomer: { hp: 26 + w * 5, speed: 52, radius: 14, damage: 0, gold: 8 },
    boss: { hp: 400 + w * 90, speed: 32, radius: 30, damage: 20, gold: 80 },
  }[kind];

  // Sinh ở ngoài rìa khung chơi rồi đi vào, để không bật ra ngay trước mặt
  const side = Math.floor(rand(world) * 4);
  const margin = base.radius + 6;
  let x: number;
  let y: number;
  if (side === 0) {
    x = randRange(world, margin, world.areaW - margin);
    y = margin;
  } else if (side === 1) {
    x = world.areaW - margin;
    y = randRange(world, margin, world.areaH - margin);
  } else if (side === 2) {
    x = randRange(world, margin, world.areaW - margin);
    y = world.areaH - margin;
  } else {
    x = margin;
    y = randRange(world, margin, world.areaH - margin);
  }

  return {
    id: world.nextId++,
    kind,
    x,
    y,
    hp: base.hp,
    maxHp: base.hp,
    speed: base.speed,
    radius: base.radius,
    damage: base.damage,
    gold: base.gold,
    attackCd: 0,
    hitFlash: 0,
    ...(kind === 'boss' ? { shootCd: 2, summonCd: 5 } : {}),
  };
}

function startWave(world: World): void {
  world.wave += 1;
  world.spawnQueue = waveSize(world.wave);
  world.spawnCd = 0;

  if (world.wave % BOSS_EVERY === 0) {
    const boss = makeZombie(world, 'boss');
    world.zombies.push(boss);
    world.bossAlive = true;
    pushEvent(world, 'boss');
  } else {
    pushEvent(world, 'wave');
  }
}

/* ------------------------------------------------------------------ */
/* Bắn                                                                 */
/* ------------------------------------------------------------------ */

/** Zombie gần người chơi nhất, `null` khi trên sân không còn con nào */
export function nearestZombie(world: World): Zombie | null {
  let best: Zombie | null = null;
  let bestD = Infinity;
  for (const z of world.zombies) {
    const d = dist(z.x, z.y, world.player.x, world.player.y);
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return best;
}

function spawnParticles(
  world: World,
  x: number,
  y: number,
  count: number,
  color: string,
  speed: number,
): void {
  for (let i = 0; i < count; i++) {
    if (world.particles.length >= MAX_PARTICLES) return;
    const angle = rand(world) * Math.PI * 2;
    const v = randRange(world, speed * 0.4, speed);
    world.particles.push({
      id: world.nextId++,
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: randRange(world, 0.18, 0.42),
      maxLife: 0.42,
      size: randRange(world, 3, 6),
      color,
    });
  }
}

function fire(world: World): void {
  const spec = WEAPONS[world.weapon];
  const target = nearestZombie(world);

  // Tự nhắm zombie gần nhất; không có ai thì bắn theo hướng đang nhìn
  let dirX = world.player.aimX;
  let dirY = world.player.aimY;
  if (target) {
    const d = dist(target.x, target.y, world.player.x, world.player.y) || 1;
    dirX = (target.x - world.player.x) / d;
    dirY = (target.y - world.player.y) / d;
    world.player.aimX = dirX;
    world.player.aimY = dirY;
  }

  // Hướng nhắm bị nhiễu khi zombie đứng chồng lên người chơi (khoảng cách ~0):
  // lúc đó giữ lại hướng cũ thay vì lấy một hướng ngẫu nhiên.
  if (!Number.isFinite(dirX) || !Number.isFinite(dirY) || Math.hypot(dirX, dirY) < 0.01) {
    dirX = 0;
    dirY = -1;
  }

  const baseAngle = Math.atan2(dirY, dirX);
  const shots = spec.pellets + world.upgrades.multishot;
  const baseDamage = bulletDamage(world);
  const pierce = spec.pierce + world.upgrades.pierce;

  // Khoá mục tiêu để phần vẽ kẻ tia ngắm về phía con đang nhắm
  world.player.lockedTargetId = target ? target.id : null;
  // Tia lửa nòng súng nhấp một nhịp rất ngắn
  world.player.muzzleFlash = 0.06;

  for (let i = 0; i < shots; i++) {
    if (world.bullets.length >= MAX_BULLETS) break;

    // Toả đều quanh hướng nhắm; một viên thì bắn thẳng
    const offset =
      shots === 1
        ? 0
        : (i / (shots - 1) - 0.5) * (spec.spread > 0 ? spec.spread * 2 : 0.3);
    // Cộng thêm độ chệch ngẫu nhiên của khẩu súng
    const jitter = spec.jitter ? (rand(world) * 2 - 1) * spec.jitter : 0;
    const angle = baseAngle + offset + jitter;

    // Chí mạng quyết định NGAY LÚC BẮN để phần vẽ đổi màu viên đạn cho khớp
    const crit = spec.critChance ? rand(world) < spec.critChance : false;
    const damage = crit ? baseDamage * (spec.critMultiplier ?? 2) : baseDamage;

    world.bullets.push({
      id: world.nextId++,
      // Sinh đạn ở ĐÚNG tâm người chơi, không đẩy ra trước nòng: nếu đẩy ra một
      // đoạn thì lúc zombie áp sát, viên đạn sẽ xuất hiện ở phía SAU chúng rồi
      // bay ra ngoài — bắn sát mặt lại không trúng gì.
      x: world.player.x,
      y: world.player.y,
      vx: Math.cos(angle) * spec.bulletSpeed,
      vy: Math.sin(angle) * spec.bulletSpeed,
      damage,
      look: crit ? 'crit' : spec.tracer ? 'tracer' : 'normal',
      pierce,
      radius: spec.bulletRadius,
      hitIds: [],
    });
  }

  world.fireCd = fireInterval(world);
  // Súng liên thanh có tiếng riêng: tiếng 'shoot' dài 70ms mà nhịp bắn 50ms thì
  // các phát dính vào nhau thành một tiếng rè.
  pushEvent(world, world.weapon === 'minigun' ? 'minigun' : 'shoot');
}

/* ------------------------------------------------------------------ */
/* Sát thương và cái chết                                              */
/* ------------------------------------------------------------------ */

/**
 * Cộng vàng NGAY khi zombie chết, không rơi ra đất.
 *
 * Bỏ cơ chế nhặt vàng vì nó buộc học sinh phải chạy vào giữa đám zombie để lấy
 * phần thưởng của mình — vừa khó vừa dễ chết oan.
 */
function giveGold(world: World, amount: number, x: number, y: number): void {
  const total = Math.max(1, Math.round(amount * goldMultiplier(world)));
  world.gold += total;
  world.goldEarned += total;
  world.score += total;

  if (world.goldPops.length < MAX_GOLD_POPS) {
    world.goldPops.push({ id: world.nextId++, x, y, amount: total, ttl: 0.9 });
  }
}

function hurtPlayer(world: World, amount: number): void {
  // Giáp 🛡️ chặn sạch sát thương, kể cả sát thương diện rộng của zombie nổ
  if (world.player.shield > 0) return;
  if (world.player.invuln > 0) return;
  world.player.hp = Math.max(0, world.player.hp - amount);
  world.player.invuln = 0.6;
  pushEvent(world, 'hurt');
  if (world.player.hp <= 0) {
    world.status = 'gameOver';
    pushEvent(world, 'gameOver');
  }
}

/** Nổ diện rộng: dùng cho zombie nổ khi chết */
function explode(world: World, x: number, y: number, radius: number, damage: number): void {
  spawnParticles(world, x, y, 10, '#F97316', 240);
  pushEvent(world, 'explosion');

  for (const z of world.zombies) {
    if (dist(z.x, z.y, x, y) <= radius + z.radius) {
      z.hp -= damage;
      z.hitFlash = 0.12;
    }
  }
  if (dist(world.player.x, world.player.y, x, y) <= radius + world.player.radius) {
    hurtPlayer(world, damage);
  }
}

/** Rơi vật phẩm buff theo tỉ lệ của loại zombie. Boss rơi hai cái. */
function dropPowerUp(world: World, z: Zombie): void {
  const times = z.kind === 'boss' ? 2 : 1;
  for (let i = 0; i < times; i++) {
    if (world.powerUps.length >= MAX_POWERUPS) return;
    if (rand(world) >= DROP_CHANCE[z.kind]) continue;

    const kind = POWERUP_ORDER[Math.floor(rand(world) * POWERUP_ORDER.length)];
    world.powerUps.push({
      id: world.nextId++,
      x: clamp(z.x + randRange(world, -14, 14), 12, world.areaW - 12),
      y: clamp(z.y + randRange(world, -14, 14), 12, world.areaH - 12),
      kind,
      ttl: POWERUP_TTL,
    });
  }
}

/** Áp dụng hiệu ứng của vật phẩm vừa nhặt */
function applyPowerUp(world: World, kind: PowerUpKind): void {
  const p = world.player;
  pushEvent(world, 'powerup');

  switch (kind) {
    case 'shield':
      p.shield = SHIELD_SECONDS;
      break;
    case 'frenzy':
      p.frenzy = FRENZY_SECONDS;
      break;
    case 'goldbag':
      giveGold(world, GOLDBAG_AMOUNT, p.x, p.y);
      break;
    case 'nuke':
      // KHÔNG nổ ngay: cất vào kho để bé bấm nút tuyệt chiêu khi cần
      p.bombs = Math.min(MAX_BOMBS, p.bombs + 1);
      break;
  }
}

/**
 * Kích hoạt một quả bom huỷ diệt — tuyệt chiêu của người chơi.
 *
 * Chỉ hạ zombie THƯỜNG. Boss, tank và zombie nhanh vẫn còn, để tuyệt chiêu mạnh
 * nhưng không xoá sạch cả một wave boss chỉ bằng một cú bấm.
 *
 * Trả về `false` khi trong tay không còn bom, để nơi gọi biết mà không phát tiếng
 * nổ vô nghĩa.
 */
export function detonateBomb(world: World): boolean {
  const p = world.player;
  if (p.bombs <= 0 || world.status !== 'playing') return false;

  p.bombs -= 1;

  const doomed = world.zombies.filter((z) => z.kind === 'normal');
  for (const z of doomed) {
    spawnParticles(world, z.x, z.y, 3, '#F97316', 200);
    killZombie(world, z);
  }
  world.zombies = world.zombies.filter((z) => z.kind !== 'normal');

  // Vòng sáng ở chỗ người chơi cho thấy vụ nổ toả ra từ đâu
  spawnParticles(world, p.x, p.y, 14, '#FDBA74', 320);
  pushEvent(world, 'explosion');
  return true;
}

function killZombie(world: World, z: Zombie): void {
  world.kills += 1;
  world.score += z.kind === 'boss' ? 500 : z.kind === 'tank' ? 60 : 20;
  giveGold(world, z.gold, z.x, z.y);
  dropPowerUp(world, z);

  if (z.kind === 'boomer') {
    explode(world, z.x, z.y, 70, 18);
  } else {
    spawnParticles(world, z.x, z.y, z.kind === 'boss' ? 14 : 5, '#84CC16', 180);
  }
  if (z.kind === 'boss') world.bossAlive = false;
}

/* ------------------------------------------------------------------ */
/* Vòng cập nhật                                                       */
/* ------------------------------------------------------------------ */

export function advance(world: World, dt: number, input: Input): void {
  if (world.status !== 'playing') return;

  const p = world.player;

  /* ---- Người chơi ---- */
  const moveLen = Math.hypot(input.moveX, input.moveY);
  if (moveLen > 0.02) {
    const nx = input.moveX / moveLen;
    const ny = input.moveY / moveLen;
    // Cần điều khiển đẩy nhẹ thì đi chậm, đẩy hết thì đi nhanh
    const throttle = Math.min(1, moveLen);
    const speed = playerSpeed(world) * throttle;
    p.x = clamp(p.x + nx * speed * dt, p.radius, world.areaW - p.radius);
    p.y = clamp(p.y + ny * speed * dt, p.radius, world.areaH - p.radius);
    p.aimX = nx;
    p.aimY = ny;
  }
  p.invuln = Math.max(0, p.invuln - dt);
  p.shield = Math.max(0, p.shield - dt);
  p.frenzy = Math.max(0, p.frenzy - dt);
  p.muzzleFlash = Math.max(0, p.muzzleFlash - dt);
  p.maxHp = maxHpOf(world);

  /* ---- Bắn ---- */
  world.fireCd = Math.max(0, world.fireCd - dt);
  // Tuyệt chiêu: đặt TRƯỚC phần bắn để bom dọn sân ngay trong khung hình này
  if (input.useBomb) detonateBomb(world);

  if (input.firing && world.fireCd <= 0) fire(world);

  /* ---- Đạn của người chơi ---- */
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x < -20 || b.x > world.areaW + 20 || b.y < -20 || b.y > world.areaH + 20) {
      world.bullets.splice(i, 1);
      continue;
    }

    let consumed = false;
    for (const z of world.zombies) {
      if (b.hitIds.includes(z.id)) continue;
      if (dist(b.x, b.y, z.x, z.y) > z.radius + b.radius) continue;

      z.hp -= b.damage;
      z.hitFlash = 0.1;
      b.hitIds.push(z.id);
      // Chí mạng thì nhiều hạt hơn và màu vàng cho dễ thấy
      const crit = b.look === 'crit';
      spawnParticles(world, b.x, b.y, crit ? 5 : 2, crit ? '#FDE047' : '#FCA5A5',
        crit ? 200 : 120);
      pushEvent(world, 'hit');

      if (b.pierce > 0) {
        b.pierce -= 1;
      } else {
        consumed = true;
        break;
      }
    }
    if (consumed) world.bullets.splice(i, 1);
  }

  /* ---- Zombie ---- */
  for (let i = world.zombies.length - 1; i >= 0; i--) {
    const z = world.zombies[i];
    z.hitFlash = Math.max(0, z.hitFlash - dt);
    z.attackCd = Math.max(0, z.attackCd - dt);

    if (z.hp <= 0) {
      killZombie(world, z);
      world.zombies.splice(i, 1);
      continue;
    }

    // Đi về phía người chơi, nhưng DỪNG ở khoảng chạm. Nếu cho đi tới tận tâm
    // thì cả đàn chồng lên nhau thành một cục ở giữa người chơi, trông rất tệ
    // và làm phần bắn khó tính đúng.
    const d = dist(z.x, z.y, p.x, p.y) || 0.001;
    const contact = z.radius + p.radius;
    if (d > contact) {
      const advanceBy = Math.min(z.speed * dt, d - contact);
      z.x = clamp(z.x + ((p.x - z.x) / d) * advanceBy, z.radius, world.areaW - z.radius);
      z.y = clamp(z.y + ((p.y - z.y) / d) * advanceBy, z.radius, world.areaH - z.radius);
    }

    // Tách nhẹ khỏi con khác để đàn zombie dàn thành vòng quanh người chơi
    for (const other of world.zombies) {
      if (other === z) continue;
      const od = dist(z.x, z.y, other.x, other.y);
      const minGap = z.radius + other.radius;
      if (od > 0.001 && od < minGap) {
        const push = ((minGap - od) / od) * 0.5;
        z.x = clamp(z.x + (z.x - other.x) * push, z.radius, world.areaW - z.radius);
        z.y = clamp(z.y + (z.y - other.y) * push, z.radius, world.areaH - z.radius);
      }
    }

    // Chạm người chơi — đo lại sau khi đã di chuyển
    if (dist(z.x, z.y, p.x, p.y) <= z.radius + p.radius + 1) {
      if (z.kind === 'boomer') {
        // Zombie nổ tự huỷ khi tới sát người chơi
        explode(world, z.x, z.y, 70, 18);
        giveGold(world, z.gold, z.x, z.y);
        world.kills += 1;
        world.score += 20;
        world.zombies.splice(i, 1);
        continue;
      }
      if (z.attackCd <= 0) {
        hurtPlayer(world, z.damage);
        z.attackCd = 0.8;
      }
    }

    /* ---- Kỹ năng của boss ---- */
    if (z.kind === 'boss') {
      z.shootCd = Math.max(0, (z.shootCd ?? 0) - dt);
      z.summonCd = Math.max(0, (z.summonCd ?? 0) - dt);

      if (z.shootCd <= 0) {
        // Bắn nan quạt 3 viên về phía người chơi
        const base = Math.atan2(p.y - z.y, p.x - z.x);
        for (let k = -1; k <= 1; k++) {
          world.enemyBullets.push({
            id: world.nextId++,
            x: z.x,
            y: z.y,
            vx: Math.cos(base + k * 0.26) * 200,
            vy: Math.sin(base + k * 0.26) * 200,
            damage: 12,
            look: 'normal',
            pierce: 0,
            radius: 7,
            hitIds: [],
          });
        }
        z.shootCd = 2.2;
      }

      if (z.summonCd <= 0) {
        // Triệu hồi zombie đệ tử, nhưng tôn trọng trần số zombie trên sân
        for (let k = 0; k < 3 && world.zombies.length < MAX_ZOMBIES_ALIVE; k++) {
          world.zombies.push(makeZombie(world, 'normal'));
        }
        z.summonCd = 6.5;
      }
    }
  }

  /* ---- Đạn của boss ---- */
  for (let i = world.enemyBullets.length - 1; i >= 0; i--) {
    const b = world.enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -20 || b.x > world.areaW + 20 || b.y < -20 || b.y > world.areaH + 20) {
      world.enemyBullets.splice(i, 1);
      continue;
    }
    if (dist(b.x, b.y, p.x, p.y) <= p.radius + b.radius) {
      hurtPlayer(world, b.damage);
      world.enemyBullets.splice(i, 1);
    }
  }

  /* ---- Số vàng nảy lên ---- */
  for (let i = world.goldPops.length - 1; i >= 0; i--) {
    const pop = world.goldPops[i];
    pop.ttl -= dt;
    if (pop.ttl <= 0) {
      world.goldPops.splice(i, 1);
      continue;
    }
    // Bay lên chậm dần để con số dễ đọc
    pop.y -= 34 * dt;
  }

  /* ---- Vật phẩm buff ---- */
  for (let i = world.powerUps.length - 1; i >= 0; i--) {
    const item = world.powerUps[i];
    item.ttl -= dt;
    if (item.ttl <= 0) {
      world.powerUps.splice(i, 1);
      continue;
    }
    // Vùng nhặt rộng hơn vàng một chút: vật phẩm quý, đừng để trượt
    if (dist(item.x, item.y, p.x, p.y) <= p.radius + 16) {
      const kind = item.kind;
      world.powerUps.splice(i, 1);
      applyPowerUp(world, kind);
    }
  }

  /* ---- Hạt hiệu ứng ---- */
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const q = world.particles[i];
    q.life -= dt;
    if (q.life <= 0) {
      world.particles.splice(i, 1);
      continue;
    }
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vx *= 0.9;
    q.vy *= 0.9;
  }

  /* ---- Điều phối wave ---- */
  if (world.spawnQueue > 0) {
    world.spawnCd -= dt;
    if (world.spawnCd <= 0 && world.zombies.length < MAX_ZOMBIES_ALIVE) {
      world.zombies.push(makeZombie(world, pickKind(world)));
      world.spawnQueue -= 1;
      world.spawnCd = Math.max(0.28, 0.9 - world.wave * 0.05);
    }
  } else if (world.zombies.length === 0) {
    world.restCd -= dt;
    if (world.restCd <= 0) {
      startWave(world);
      world.restCd = 2.4;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Shop                                                               */
/* ------------------------------------------------------------------ */

export interface PurchaseResult {
  ok: boolean;
  /** Lý do không mua được, để hiện cho học sinh */
  reason?: 'notEnoughGold' | 'maxLevel' | 'alreadyOwned' | 'fullHp';
}

export function buyUpgrade(world: World, id: UpgradeId): PurchaseResult {
  const level = world.upgrades[id];
  const price = priceAt(id, level);
  if (price === null) return { ok: false, reason: 'maxLevel' };
  if (world.gold < price) return { ok: false, reason: 'notEnoughGold' };

  world.gold -= price;
  world.upgrades[id] = level + 1;

  // Nâng máu tối đa thì hồi luôn phần vừa thêm, nếu không nâng cấp sẽ vô nghĩa
  // với người đang gần chết.
  if (id === 'maxHp') {
    world.player.maxHp = maxHpOf(world);
    world.player.hp = Math.min(world.player.maxHp, world.player.hp + 20);
  }
  return { ok: true };
}

/* ---- Hồi máu ---- */

/** Số máu hồi mỗi lần mua */
export const HEAL_AMOUNT = 40;
/** Giá một lần hồi máu */
export const HEAL_PRICE = 15;

/**
 * Mua hồi máu. Khác nâng cấp: mua được nhiều lần, không có bậc, và bị chặn khi
 * máu đã đầy để không đốt vàng vô ích.
 */
export function buyHeal(world: World): PurchaseResult {
  if (world.player.hp >= maxHpOf(world)) return { ok: false, reason: 'fullHp' };
  if (world.gold < HEAL_PRICE) return { ok: false, reason: 'notEnoughGold' };

  world.gold -= HEAL_PRICE;
  world.player.maxHp = maxHpOf(world);
  world.player.hp = Math.min(world.player.maxHp, world.player.hp + HEAL_AMOUNT);
  return { ok: true };
}

export function buyWeapon(world: World, id: WeaponId): PurchaseResult {
  if (world.ownedWeapons.includes(id)) return { ok: false, reason: 'alreadyOwned' };
  const price = WEAPONS[id].price;
  if (world.gold < price) return { ok: false, reason: 'notEnoughGold' };

  world.gold -= price;
  world.ownedWeapons.push(id);
  world.weapon = id;
  return { ok: true };
}

/** Đổi sang khẩu tiếp theo trong số đã mua */
export function cycleWeapon(world: World): WeaponId {
  const owned = WEAPON_ORDER.filter((w) => world.ownedWeapons.includes(w));
  const at = owned.indexOf(world.weapon);
  world.weapon = owned[(at + 1) % owned.length];
  world.fireCd = Math.max(world.fireCd, 0.12);
  return world.weapon;
}

export function selectWeapon(world: World, id: WeaponId): boolean {
  if (!world.ownedWeapons.includes(id)) return false;
  world.weapon = id;
  return true;
}

/* ------------------------------------------------------------------ */
/* Ảnh chụp cho phần vẽ                                                */
/* ------------------------------------------------------------------ */

export interface Frame {
  player: Player;
  zombies: Zombie[];
  bullets: Bullet[];
  enemyBullets: Bullet[];
  particles: Particle[];
  goldPops: GoldPop[];
  powerUps: PowerUpDrop[];
  /** Hiệu ứng đang có hiệu lực, kèm số giây còn lại — để hiện lên HUD */
  effects: { kind: PowerUpKind; seconds: number }[];
  wave: number;
  gold: number;
  goldEarned: number;
  score: number;
  kills: number;
  hp: number;
  maxHp: number;
  weapon: WeaponId;
  ownedWeapons: WeaponId[];
  status: World['status'];
  zombiesLeft: number;
  bossAlive: boolean;
  upgrades: Record<UpgradeId, number>;
  /** Số bom tuyệt chiêu đang giữ */
  bombs: number;
  /** Vị trí zombie đang bị khoá mục tiêu, `null` khi sân trống */
  lockedTarget: { x: number; y: number; radius: number } | null;
}

export function snapshot(world: World): Frame {
  return {
    player: { ...world.player },
    zombies: world.zombies.map((z) => ({ ...z })),
    bullets: world.bullets.map((b) => ({ ...b })),
    enemyBullets: world.enemyBullets.map((b) => ({ ...b })),
    particles: world.particles.map((q) => ({ ...q })),
    goldPops: world.goldPops.map((g) => ({ ...g })),
    powerUps: world.powerUps.map((u) => ({ ...u })),
    effects: [
      ...(world.player.shield > 0
        ? [{ kind: 'shield' as PowerUpKind, seconds: world.player.shield }]
        : []),
      ...(world.player.frenzy > 0
        ? [{ kind: 'frenzy' as PowerUpKind, seconds: world.player.frenzy }]
        : []),
    ],
    wave: world.wave,
    gold: world.gold,
    goldEarned: world.goldEarned,
    score: world.score,
    kills: world.kills,
    hp: world.player.hp,
    maxHp: world.player.maxHp,
    bombs: world.player.bombs,
    weapon: world.weapon,
    ownedWeapons: [...world.ownedWeapons],
    status: world.status,
    zombiesLeft: world.spawnQueue + world.zombies.length,
    bossAlive: world.bossAlive,
    upgrades: { ...world.upgrades },
    lockedTarget: (() => {
      if (world.player.lockedTargetId === null) return null;
      const target = world.zombies.find((z) => z.id === world.player.lockedTargetId);
      return target ? { x: target.x, y: target.y, radius: target.radius } : null;
    })(),
  };
}

/** Lấy và xoá hàng đợi âm thanh */
export function drainEvents(world: World): SoundEvent[] {
  if (world.events.length === 0) return [];
  const out = world.events;
  world.events = [];
  return out;
}
