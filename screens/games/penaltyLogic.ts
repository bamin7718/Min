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

/**
 * Tầm với của thủ môn MÁY theo phương ngang, tính theo đơn vị aimX.
 *
 * Hạ từ 0.58 xuống 0.45 (và dọc từ 0.52 xuống 0.40) cùng lúc với việc thu nhỏ
 * hình thủ môn từ 78% xuống 60% chiều cao khung thành. Hai con số này PHẢI đi
 * cùng nhau: thu nhỏ hình mà giữ nguyên tầm với thì đồ hoạ nói dối — bé nhìn
 * thấy góc trống, sút vào đó, vẫn bị một thủ môn "tay dài vô hình" cản.
 *
 * Hệ quả về độ khó: các góc cao và góc xa giờ thực sự là góc chết, nên sút chuẩn
 * vào góc gần như luôn thành bàn. Đó là chủ ý — trò này để bé thấy mình giỏi lên
 * khi ngắm chính xác, không phải để cân bằng như game đối kháng.
 *
 * Tỉ lệ GHI BÀN đo thật (6000 lượt mỗi điểm, `keeperDecide` với skill 0.45):
 *
 *     góc trên trái  (-0.90, 0.85)   98.5%      giữa cao   (0.00, 0.85)   86.4%
 *     góc trên phải  (+0.90, 0.85)   98.0%      giữa vừa   (0.00, 0.45)    9.1%
 *     góc dưới trái  (-0.90, 0.12)   88.2%      giữa thấp  (0.00, 0.15)    6.3%
 *     góc dưới phải  (+0.90, 0.12)   87.4%
 *     nửa cao trái   (-0.55, 0.70)   75.8%      góc + xoáy mạnh          100.0%
 *
 * Đổi bất kỳ con số nào ở đây hay trong `keeperDecide` thì đo lại bảng này —
 * chính bảng này đã phát hiện ra lỗi kẹp phán đoán mô tả bên dưới.
 */
export const KEEPER_REACH_X = 0.45;
/** Tầm với theo phương dọc, tính theo đơn vị aimY */
export const KEEPER_REACH_Y = 0.4;

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
  const s = clamp(skill, 0, 1);

  /*
   * Phán đoán = TRỘN giữa hai thứ: chỗ thủ môn có thói quen đổ tới (gần giữa,
   * thấp) và chỗ quả sút thật sự đi. `skill` là tỉ lệ đọc được quả sút thật.
   *
   * Bản trước cộng nhiễu quanh chính quả sút rồi KẸP ở ±0.92, và cách đó tạo ra
   * đúng cái lỗi mà comment cũ tưởng đã sửa: khi quả sút ở sát cột, mọi phán
   * đoán lệch ra ngoài đều bị kẹp trở lại 0.92 — ngay cạnh bóng. Đo thật thì sút
   * sát góc trên chỉ vào 54% còn sút vào giữa vào 70%, tức là NGƯỢC với ý định.
   *
   * Trộn với một thói quen nghiêng về giữa thì góc mới thật sự là góc chết: thủ
   * môn chỉ đọc được 45% hướng sút nên với quả sút ở 0.9 anh ta thường chỉ đổ
   * tới quanh 0.4.
   */
  const habitX = (random() * 2 - 1) * 0.4;
  // Thủ môn có thói quen đổ THẤP: bóng sát đất là loại phải cản nhiều nhất
  const habitY = 0.12 + random() * 0.26;

  const readX = shot.aimX * s + habitX * (1 - s);
  const readY = shot.aimY * s + habitY * (1 - s);

  // Nhiễu phản ứng, cũng nhỏ đi khi thủ môn giỏi hơn
  const jitter = (1 - s) * 0.32;
  /*
   * KHÔNG kẹp x, y vào trong khung thành. Thủ môn đổ người ra ngoài cột là
   * chuyện có thật, và kẹp lại chính là nguồn gốc của lỗi nói trên. Hai giá trị
   * này chỉ dùng để tính có cản được hay không — phần vẽ dùng `pose`, không dùng
   * toạ độ, nên để tự do cũng không làm hình bị lệch ra khỏi sân.
   */
  const x = readX + (random() * 2 - 1) * jitter;
  const y = readY + (random() * 2 - 1) * jitter * 0.6;

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
/* Chế độ BÉ LÀM THỦ MÔN                                               */
/* ------------------------------------------------------------------ */

/**
 * Máy sút một quả penalty.
 *
 * Cố ý KHÔNG rải đều khắp khung thành: máy nhắm vào một trong các vùng góc, vì
 * quả sút vào giữa thì bé chỉ cần đứng im là bắt được, chơi vài lượt là nhàm.
 * `difficulty` 0..1 quyết định quả sút bám sát góc và căng đến đâu.
 *
 * Trả về `Shot` để dùng lại nguyên `ballAt()` và `flightMs()` của chế độ sút —
 * bóng bay theo cùng một công thức nên bé học được cách đọc quỹ đạo ở cả hai chế độ.
 */
export function aiShot(random: () => number, difficulty: number): Shot {
  const d = clamp(difficulty, 0, 1);

  /*
   * Sáu vùng nhắm: bốn góc, cộng hai vùng nửa cao hai bên. Không có vùng giữa
   * thấp — đó là chỗ thủ môn đứng sẵn, sút vào đấy thì lượt nào cũng bị bắt.
   */
  const zones: { x: number; y: number }[] = [
    { x: -0.82, y: 0.14 },
    { x: 0.82, y: 0.14 },
    { x: -0.82, y: 0.82 },
    { x: 0.82, y: 0.82 },
    { x: -0.5, y: 0.6 },
    { x: 0.5, y: 0.6 },
  ];
  const zone = zones[Math.floor(random() * zones.length) % zones.length];

  // Máy yếu thì lệch khỏi góc nhiều hơn, nên bóng dạt về giữa và dễ bắt hơn
  const spread = (1 - d) * 0.42;
  const aimX = clamp(zone.x + (random() * 2 - 1) * spread, -0.93, 0.93);
  const aimY = clamp(zone.y + (random() * 2 - 1) * spread * 0.6, 0.06, 0.94);

  const power = clamp(0.42 + d * 0.45 + random() * 0.13, 0.12, 1);
  const curve = clamp((random() * 2 - 1) * d * 0.8, -1, 1);

  return { aimX, aimY, power, curve, valid: true };
}

/** Tầm với của bé khi làm thủ môn — rộng hơn máy, để bắt được là có thật */
export const PLAYER_REACH_X = 0.62;
export const PLAYER_REACH_Y = 0.58;

/**
 * Đổi thao tác của bé thành một lần đổ người.
 *
 * Nhận cả CHẠM và VUỐT: chạm thì lấy đúng điểm chạm, vuốt thì lấy điểm cuối —
 * nên bé chạm nhanh một cái cũng chơi được, không bắt phải vuốt cho đủ dài như
 * bên sút. Với một cú sút chỉ bay 400-700ms thì đòi thao tác phức tạp là bé
 * không kịp.
 *
 * @param x,y Toạ độ trên khung chơi, tính bằng pixel
 * @param goal Hình chữ nhật khung thành trên khung chơi, cùng đơn vị pixel
 */
export function diveFromTouch(
  x: number,
  y: number,
  goal: { left: number; top: number; width: number; height: number },
): KeeperDive {
  // Đổi pixel sang cùng hệ toạ độ với `Shot`: aimX -1..1, aimY 0 (đất) .. 1 (xà)
  const relX = (x - (goal.left + goal.width / 2)) / (goal.width / 2);
  const relY = (goal.top + goal.height - y) / goal.height;

  const diveX = clamp(relX, -1.15, 1.15);
  const diveY = clamp(relY, 0, 1.15);

  let pose: KeeperPose;
  if (Math.abs(diveX) < 0.3) pose = diveY > 0.55 ? 'jumpHigh' : 'catchCenter';
  else pose = diveX < 0 ? 'diveLeft' : 'diveRight';

  return { x: diveX, y: diveY, pose };
}

/** Kết quả một lượt bé bắt bóng */
export interface SaveResolution {
  /** Bé có cản được không */
  saved: boolean;
  /** Khoảng cách từ tay bé tới bóng, 0 là đúng điểm — dùng để chấm "sát quá!" */
  missBy: number;
}

/**
 * Bé có bắt được quả sút này không.
 *
 * Dùng tầm với RỘNG HƠN của máy (`PLAYER_REACH_*` so với `KEEPER_REACH_*`) và
 * KHÔNG trừ bớt theo lực/xoáy. Lý do: bé chỉ có 400-700ms để phản ứng, còn máy
 * thì "biết" quả sút ngay lúc nó xảy ra. Cho hai bên cùng một tầm với thì bé
 * gần như không bao giờ bắt được, và một trò không thắng nổi thì bé bỏ.
 */
export function resolveSave(shot: Shot, dive: KeeperDive): SaveResolution {
  // Bóng ra ngoài thì không tính là bắt được — nhưng cũng không phải bàn thắng
  if (!shot.valid || shot.aimY > 1 || Math.abs(shot.aimX) > 1) {
    return { saved: false, missBy: 0 };
  }

  const dx = Math.abs(dive.x - shot.aimX);
  const dy = Math.abs(dive.y - shot.aimY);
  const saved = dx <= PLAYER_REACH_X && dy <= PLAYER_REACH_Y;

  // Chuẩn hoá về cùng thang để so được hai chiều với nhau
  const missBy = Math.hypot(dx / PLAYER_REACH_X, dy / PLAYER_REACH_Y);
  return { saved, missBy };
}

/** Lời khen / an ủi sau một lượt bắt bóng */
export function saveFeedback(result: SaveResolution): string {
  if (result.saved) return result.missBy < 0.45 ? '🧤 Bắt gọn trong tay!' : '✋ Cản được rồi!';
  return result.missBy < 1.25 ? '😮 Sát quá, chỉ thiếu một chút!' : '😵 Bóng vào lưới rồi!';
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
