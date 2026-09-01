/**
 * Luật sút penalty: đổi thao tác VUỐT của ngón tay thành một quả sút, rồi cho
 * thủ môn phán đoán và bay người cản phá.
 *
 * File này không import React hay react-native nên chạy được bằng Node để kiểm
 * thử: vuốt nhanh có ra bóng căng không, vuốt cong có xoáy không, tỉ lệ ghi bàn
 * có hợp lý không.
 */

export type ShotOutcome = 'goal' | 'saved' | 'over' | 'wide';
export type KeeperPose =
  | 'idle'
  | 'diveLeft'
  | 'diveRight'
  | 'jumpHigh'
  | 'catchCenter'
  | 'beaten';

/* ------------------------------------------------------------------ */
/* Vuốt → quả sút                                                      */
/* ------------------------------------------------------------------ */

export interface SwipeInput {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Một điểm ở giữa đường vuốt, dùng để đo độ cong */
  midX: number;
  midY: number;
  durationMs: number;
  /** Kích thước khung chơi, để mọi con số tính theo tỉ lệ chứ không theo pixel */
  fieldWidth: number;
  fieldHeight: number;
}

export interface Shot {
  /** Vị trí ngang ở vạch cầu môn: -1 là cột trái, +1 là cột phải, quá 1 là ra ngoài */
  aimX: number;
  /** Độ cao ở vạch cầu môn: 0 là sát đất, 1 là sát xà ngang, quá 1 là trên xà */
  aimY: number;
  /** Lực sút 0..1, tính từ TỐC ĐỘ vuốt */
  power: number;
  /** Độ xoáy -1..1: âm là xoáy sang trái, dương là xoáy sang phải */
  curve: number;
  valid: boolean;
  /** Vì sao đường vuốt không thành quả sút */
  reason?: 'tooShort' | 'wrongDirection';
}

/** Đường vuốt phải dài ít nhất bằng tỉ lệ này của chiều cao sân */
export const MIN_SWIPE_RATIO = 0.1;
/** Góc lệch tối đa còn nằm trong khung thành, tính bằng radian (~31°) */
export const MAX_AIM_ANGLE = 0.55;
/** Tốc độ vuốt (theo chiều cao sân mỗi giây) để đạt lực tối đa */
export const MAX_SWIPE_SPEED_RATIO = 3.2;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Đổi một đường vuốt thành quả sút.
 *
 * Ba đại lượng lấy từ ba đặc điểm khác nhau của đường vuốt, nhờ vậy học sinh
 * điều khiển được cả ba một cách độc lập:
 *  - GÓC nghiêng của đường vuốt  → hướng sút
 *  - TỐC ĐỘ vuốt                → lực sút
 *  - ĐỘ CONG của đường vuốt      → độ xoáy
 */
export function shotFromSwipe(input: SwipeInput): Shot {
  const dx = input.endX - input.startX;
  const dy = input.endY - input.startY;
  const length = Math.hypot(dx, dy);

  const invalid = (reason: Shot['reason']): Shot => ({
    aimX: 0,
    aimY: 0,
    power: 0,
    curve: 0,
    valid: false,
    reason,
  });

  if (length < input.fieldHeight * MIN_SWIPE_RATIO) return invalid('tooShort');
  // Phải vuốt LÊN phía khung thành; vuốt ngang hay vuốt xuống không tính
  if (dy > -length * 0.35) return invalid('wrongDirection');

  // ---- Hướng sút ----
  const angle = Math.atan2(dx, -dy);
  // Không kẹp lại ở 1: vuốt lệch quá thì bóng ra ngoài cột, đó là một phần của trò
  const aimX = clamp(angle / MAX_AIM_ANGLE, -1.6, 1.6);

  // ---- Lực sút ----
  const seconds = Math.max(0.04, input.durationMs / 1000);
  const speedRatio = length / input.fieldHeight / seconds;
  const power = clamp(speedRatio / MAX_SWIPE_SPEED_RATIO, 0.12, 1);

  // ---- Độ cao ----
  //
  // Vuốt nhanh thì bóng đi CĂNG và thấp; vuốt chậm thì bóng bổng lên như quả
  // chíp. Vuốt quá dài (vung tay vượt hẳn khung thành) thì bóng bay trên xà —
  // đó là cái giá của việc vung tay quá mạnh.
  const overshoot = Math.max(0, length / input.fieldHeight - 0.7);
  const aimY = clamp(0.86 - power * 0.62 + overshoot * 2.2, 0.03, 1.5);

  // ---- Độ xoáy ----
  //
  // Đo bằng tích có hướng giữa nửa đầu và nửa sau của đường vuốt: đường vuốt
  // thẳng thì bằng 0, càng cong thì trị tuyệt đối càng lớn.
  const ax = input.midX - input.startX;
  const ay = input.midY - input.startY;
  const bx = input.endX - input.midX;
  const by = input.endY - input.midY;
  // Đảo dấu để khớp trực giác: đường vuốt bẻ sang TRÁI thì bóng xoáy sang trái
  // (curve âm), và trong ballAt() độ xoáy âm kéo bóng lệch sang trái.
  const cross = -(ax * by - ay * bx);
  const scale = Math.max(1, (length / 2) * (length / 2));
  const curve = clamp(cross / scale, -1, 1);

  return { aimX, aimY, power, curve, valid: true };
}

/* ------------------------------------------------------------------ */
/* Thủ môn                                                             */
/* ------------------------------------------------------------------ */

export interface KeeperDive {
  /** Vị trí ngang thủ môn chọn: -1 trái, 0 giữa, +1 phải */
  x: number;
  /** Độ cao thủ môn chọn: 0 thấp, 1 cao */
  y: number;
  pose: KeeperPose;
}

/** Tầm với của thủ môn theo phương ngang, tính theo đơn vị aimX */
export const KEEPER_REACH_X = 0.58;
/** Tầm với theo phương dọc, tính theo đơn vị aimY */
export const KEEPER_REACH_Y = 0.52;

/**
 * Thủ môn phán đoán hướng sút.
 *
 * `skill` từ 0 đến 1: càng cao thì đoán càng gần hướng sút thật. Cố ý cho thủ
 * môn đoán DỰA TRÊN quả sút thật cộng sai số, thay vì đoán ngẫu nhiên hoàn toàn:
 * đoán ngẫu nhiên thì học sinh sút vào đâu cũng như nhau, chẳng có gì để giỏi lên.
 */
export function keeperDecide(
  shot: Shot,
  skill: number,
  random: () => number,
): KeeperDive {
  const error = (1 - clamp(skill, 0, 1)) * 1.6;
  const guessX = shot.aimX + (random() * 2 - 1) * error;
  const guessY = shot.aimY + (random() * 2 - 1) * error * 0.55;

  /*
   * Thủ môn bay tới ĐÚNG chỗ mình đoán, không phải chọn một trong ba vị trí cố
   * định. Bản đầu dùng ba vị trí (-0.75, 0, +0.75) và hoá ra sút vào GÓC lại dễ
   * bị cản hơn sút gần giữa — vì góc trùng đúng chỗ thủ môn hay bay tới. Cho bay
   * liên tục thì sút chuẩn vào góc mới thực sự được thưởng.
   */
  const x = clamp(guessX, -0.92, 0.92);
  const y = clamp(guessY, 0.05, 0.95);

  let pose: KeeperPose;
  if (Math.abs(x) < 0.3) pose = y > 0.55 ? 'jumpHigh' : 'catchCenter';
  else pose = x < 0 ? 'diveLeft' : 'diveRight';

  return { x, y, pose };
}

/* ------------------------------------------------------------------ */
/* Kết quả quả sút                                                     */
/* ------------------------------------------------------------------ */

export interface ShotResolution {
  outcome: ShotOutcome;
  /** Thủ môn có chạm được bóng không */
  saved: boolean;
  /** Dáng thủ môn sau khi bóng đi qua */
  keeperPose: KeeperPose;
}

export function resolveShot(shot: Shot, dive: KeeperDive): ShotResolution {
  if (!shot.valid) {
    return { outcome: 'wide', saved: false, keeperPose: 'idle' };
  }
  // Ra ngoài thì thủ môn không phải làm gì
  if (shot.aimY > 1) return { outcome: 'over', saved: false, keeperPose: 'idle' };
  if (Math.abs(shot.aimX) > 1) return { outcome: 'wide', saved: false, keeperPose: 'idle' };

  /*
   * Bóng xoáy thì quỹ đạo vòng ra ngoài tầm với — cùng một điểm ngắm, quả xoáy
   * khó cản hơn quả sút thẳng. Bóng căng cũng khó cản vì thủ môn ít thời gian.
   */
  const curveBonus = Math.abs(shot.curve) * 0.3;
  const powerBonus = shot.power * 0.22;
  const reachX = Math.max(0.12, KEEPER_REACH_X - curveBonus - powerBonus);
  const reachY = Math.max(0.12, KEEPER_REACH_Y - powerBonus);

  const closeX = Math.abs(dive.x - shot.aimX) <= reachX;
  const closeY = Math.abs(dive.y - shot.aimY) <= reachY;

  if (closeX && closeY) {
    return { outcome: 'saved', saved: true, keeperPose: dive.pose };
  }
  return { outcome: 'goal', saved: false, keeperPose: 'beaten' };
}

/* ------------------------------------------------------------------ */
/* Quỹ đạo bóng                                                        */
/* ------------------------------------------------------------------ */

export interface BallPoint {
  /** 0..1 theo chiều ngang khung chơi */
  x: number;
  /** 0..1: 0 là chỗ đặt bóng, 1 là vạch cầu môn */
  progress: number;
  /** Độ cao so với mặt sân, 0..1 */
  lift: number;
}

/**
 * Vị trí bóng ở thời điểm `t` (0..1) của đường bay.
 *
 * Độ xoáy làm bóng đi vòng: nửa đầu lệch sang một bên rồi nửa sau vòng lại về
 * điểm ngắm — đúng cảm giác quả sút xoáy.
 */
export function ballAt(shot: Shot, t: number, startX = 0): BallPoint {
  const clamped = clamp(t, 0, 1);
  const straight = startX + (shot.aimX - startX) * clamped;
  // sin(pi*t) bằng 0 ở hai đầu và lớn nhất ở giữa
  const bend = Math.sin(Math.PI * clamped) * shot.curve * 0.45;

  // Bóng bay lên rồi rơi xuống điểm ngắm: cao nhất ở giữa đường bay
  const arc = Math.sin(Math.PI * clamped) * (0.25 + shot.aimY * 0.35);

  return {
    x: straight + bend,
    progress: clamped,
    lift: shot.aimY * clamped + arc * (1 - clamped * 0.35),
  };
}

/** Bóng bay bao lâu, tính bằng mili giây — sút mạnh thì tới nhanh hơn */
export function flightMs(shot: Shot): number {
  return Math.round(760 - shot.power * 330);
}

/* ------------------------------------------------------------------ */
/* Điểm thưởng                                                         */
/* ------------------------------------------------------------------ */

/** Điểm cơ bản cho một bàn thắng */
export const GOAL_BASE_POINTS = 100;

/**
 * Điểm thưởng cho một bàn thắng: sút càng khó càng nhiều điểm.
 *
 * Đây là điểm TRONG TRẬN, không phải điểm ⭐ của phần học. Điểm ⭐ chỉ đổi được
 * từ việc trả lời câu hỏi; nếu chơi game cũng ra ⭐ thì học sinh chơi game để
 * kiếm thêm giờ chơi, vòng thưởng của cả ứng dụng mất tác dụng.
 */
export function goalBonus(shot: Shot): number {
  if (!shot.valid) return 0;
  // Sát cột (|aimX| gần 1) và sát xà là những quả khó nhất
  const cornerX = Math.max(0, Math.abs(shot.aimX) - 0.45) / 0.55;
  const highBall = Math.max(0, shot.aimY - 0.5) / 0.5;
  const bonus =
    GOAL_BASE_POINTS +
    Math.round(cornerX * 60) +
    Math.round(highBall * 30) +
    Math.round(shot.power * 40) +
    Math.round(Math.abs(shot.curve) * 50);
  return bonus;
}

/** Lời khen kèm theo bàn thắng, để học sinh biết mình vừa làm tốt điều gì */
export function goalPraise(shot: Shot): string {
  if (Math.abs(shot.curve) > 0.45) return 'Quả xoáy tuyệt đẹp!';
  if (Math.abs(shot.aimX) > 0.75) return 'Sát cột, thủ môn không với tới!';
  if (shot.power > 0.8) return 'Sút căng như búa!';
  if (shot.aimY > 0.75) return 'Bóng găm sát xà ngang!';
  return 'Vào lưới rồi!';
}

/* ------------------------------------------------------------------ */
/* Nhãn hiển thị                                                       */
/* ------------------------------------------------------------------ */

export const OUTCOME_LABEL: Record<ShotOutcome, string> = {
  goal: '⚽ VÀO RỒI!',
  saved: '✋ Thủ môn cản được!',
  over: '🎈 Bóng bay trên xà!',
  wide: '↔️ Bóng ra ngoài cột!',
};

/** Mô tả quả sút để học sinh hiểu vì sao bóng đi như vậy */
export function describeShot(shot: Shot): string {
  if (!shot.valid) {
    return shot.reason === 'tooShort'
      ? 'Vuốt dài hơn một chút nhé!'
      : 'Vuốt từ quả bóng LÊN phía khung thành nhé!';
  }
  const powerWord = shot.power > 0.72 ? 'căng' : shot.power > 0.4 ? 'vừa' : 'nhẹ (chíp)';
  const curveWord =
    Math.abs(shot.curve) < 0.15
      ? 'thẳng'
      : shot.curve < 0
        ? 'xoáy sang trái'
        : 'xoáy sang phải';
  return `Lực ${powerWord} · ${curveWord}`;
}
