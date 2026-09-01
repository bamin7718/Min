/**
 * Luật chơi của game Đua Xe Tri Thức, tách riêng khỏi phần vẽ.
 *
 * Ý tưởng: xe KHÔNG có nút ga. Tốc độ xe hoàn toàn do việc trả lời câu hỏi —
 * đúng và nhanh thì bứt phá, đúng bình thường thì chạy nhanh ổn định, sai thì
 * khựng lại. Nhờ vậy phần "chơi" và phần "học" là một.
 *
 * File này không import React hay react-native nên chạy trực tiếp bằng Node để
 * kiểm thử: cân bằng tốc độ, xe không lùi, không xe nào chạy quá đích...
 */

export type CarId = 'p1' | 'p2' | 'ai';
export type CarEffect = 'none' | 'boost' | 'superboost' | 'stun';
export type RaceMode = 'pve' | 'pvp';

export interface Car {
  id: CarId;
  name: string;
  emoji: string;
  /** Quãng đường đã đi, tính bằng mét */
  distance: number;
  /** Tốc độ hiện tại, mét/giây */
  speed: number;
  effect: CarEffect;
  /** Giây còn lại của trạng thái hiện tại */
  effectTimer: number;
  correct: number;
  wrong: number;
  /** Số câu đúng liên tiếp — dùng để hiện chuỗi combo */
  streak: number;
}

export interface RaceState {
  mode: RaceMode;
  /** Chiều dài đường đua, tính bằng mét */
  trackLength: number;
  cars: Car[];
  status: 'racing' | 'finished';
  /** Xe về đích đầu tiên */
  winner: CarId | null;
  /** Tổng thời gian đã đua, tính bằng giây */
  elapsed: number;
  /** Bộ đếm để máy tự trả lời câu hỏi của nó */
  aiTimer: number;
  seed: number;
}

/* ------------------------------------------------------------------ */
/* Hằng số cân bằng                                                    */
/* ------------------------------------------------------------------ */

export const TRACK_LENGTH = 1000;

/*
 * Tốc độ được đặt sao cho một trận đua kéo dài đủ để trả lời 12-20 câu:
 *  - Người trả lời đúng và nhanh liên tục: về đích sau khoảng 45 giây.
 *  - Máy: khoảng 90 giây.
 * Nếu để tốc độ cao hơn (bản đầu dùng 95 m/s) thì người chơi giỏi về đích sau
 * 10 giây, mới kịp làm 3-4 câu — chơi thì vui nhưng học chẳng được bao nhiêu.
 */

/** Tốc độ xe khi không có hiệu ứng gì — xe vẫn trôi chậm về phía trước */
export const COAST_SPEED = 4;
/** Trả lời ĐÚNG bình thường */
export const BOOST_SPEED = 14;
export const BOOST_SECONDS = 3;
/** Trả lời ĐÚNG trong dưới FAST_ANSWER_MS thì được bứt phá */
export const SUPER_BOOST_SPEED = 22;
export const SUPER_BOOST_SECONDS = 3;
/** Trả lời SAI thì khựng lại */
export const STUN_SPEED = 1;
export const STUN_SECONDS = 2;

/** Ngưỡng "trả lời nhanh" để được bứt phá, tính bằng mili giây */
export const FAST_ANSWER_MS = 3000;

/** Máy trả lời một câu sau bao nhiêu giây */
export const AI_ANSWER_INTERVAL = 3.4;
/** Tỉ lệ máy trả lời đúng */
export const AI_ACCURACY = 0.68;
/** Tỉ lệ máy trả lời đúng và NHANH (được bứt phá) trong số câu nó làm đúng */
export const AI_FAST_RATE = 0.35;

/* ------------------------------------------------------------------ */
/* Hỗ trợ                                                             */
/* ------------------------------------------------------------------ */

/** Bộ sinh số ngẫu nhiên có hạt giống, để bài kiểm thử chạy lại được y hệt */
function rand(state: RaceState): number {
  state.seed = (state.seed * 1664525 + 1013904223) % 4294967296;
  return state.seed / 4294967296;
}

function makeCar(id: CarId, name: string, emoji: string): Car {
  return {
    id,
    name,
    emoji,
    distance: 0,
    speed: COAST_SPEED,
    effect: 'none',
    effectTimer: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Tạo trận đua                                                        */
/* ------------------------------------------------------------------ */

export function createRace(
  mode: RaceMode,
  options: { trackLength?: number; seed?: number; p1Name?: string; p2Name?: string } = {},
): RaceState {
  const cars: Car[] =
    mode === 'pve'
      ? [
          makeCar('p1', options.p1Name ?? 'Em', '🏎️'),
          makeCar('ai', 'Máy', '🚙'),
        ]
      : [
          makeCar('p1', options.p1Name ?? 'Người 1', '🏎️'),
          makeCar('p2', options.p2Name ?? 'Người 2', '🚗'),
        ];

  return {
    mode,
    trackLength: options.trackLength ?? TRACK_LENGTH,
    cars,
    status: 'racing',
    winner: null,
    elapsed: 0,
    aiTimer: AI_ANSWER_INTERVAL,
    seed: options.seed ?? 20260901,
  };
}

export function carOf(state: RaceState, id: CarId): Car | undefined {
  return state.cars.find((car) => car.id === id);
}

/* ------------------------------------------------------------------ */
/* Trả lời câu hỏi → tốc độ xe                                         */
/* ------------------------------------------------------------------ */

export interface AnswerOutcome {
  effect: CarEffect;
  /** Tốc độ mới của xe */
  speed: number;
}

/**
 * Áp kết quả một câu trả lời lên xe.
 *
 * @param elapsedMs Thời gian học sinh đã nghĩ, tính bằng mili giây
 */
export function applyAnswer(
  state: RaceState,
  id: CarId,
  isCorrect: boolean,
  elapsedMs: number,
): AnswerOutcome | null {
  if (state.status !== 'racing') return null;
  const car = carOf(state, id);
  if (!car) return null;

  if (!isCorrect) {
    car.wrong += 1;
    car.streak = 0;
    car.effect = 'stun';
    car.effectTimer = STUN_SECONDS;
    car.speed = STUN_SPEED;
    return { effect: 'stun', speed: car.speed };
  }

  car.correct += 1;
  car.streak += 1;

  // Đúng VÀ nhanh thì được bứt phá; đúng mà nghĩ lâu thì chỉ chạy nhanh ổn định
  const fast = elapsedMs < FAST_ANSWER_MS;
  car.effect = fast ? 'superboost' : 'boost';
  car.effectTimer = fast ? SUPER_BOOST_SECONDS : BOOST_SECONDS;
  car.speed = fast ? SUPER_BOOST_SPEED : BOOST_SPEED;
  return { effect: car.effect, speed: car.speed };
}

/* ------------------------------------------------------------------ */
/* Vòng cập nhật                                                       */
/* ------------------------------------------------------------------ */

/** Máy tự trả lời câu hỏi của nó theo nhịp cố định */
function aiTick(state: RaceState, dt: number): void {
  if (state.mode !== 'pve') return;
  const ai = carOf(state, 'ai');
  if (!ai) return;

  state.aiTimer -= dt;
  if (state.aiTimer > 0) return;
  state.aiTimer = AI_ANSWER_INTERVAL;

  const correct = rand(state) < AI_ACCURACY;
  // Máy "nghĩ nhanh" một phần số câu để đôi khi cũng bứt phá
  const elapsed = correct && rand(state) < AI_FAST_RATE ? 1500 : 4500;
  applyAnswer(state, 'ai', correct, elapsed);
}

export function advanceRace(state: RaceState, dt: number): void {
  if (state.status !== 'racing') return;

  state.elapsed += dt;
  aiTick(state, dt);

  for (const car of state.cars) {
    if (car.effectTimer > 0) {
      car.effectTimer = Math.max(0, car.effectTimer - dt);
      if (car.effectTimer === 0) {
        // Hết hiệu ứng thì xe trở về trôi chậm, KHÔNG dừng hẳn
        car.effect = 'none';
        car.speed = COAST_SPEED;
      }
    }

    // Xe không bao giờ lùi và không bao giờ vượt quá vạch đích
    car.distance = Math.min(state.trackLength, car.distance + Math.max(0, car.speed) * dt);
  }

  // Xe nào tới vạch đích trước thì thắng. Nếu cùng khung hình thì xe đi xa hơn
  // thắng; bằng nhau nữa thì xe đứng trước trong danh sách thắng.
  const finished = state.cars.filter((car) => car.distance >= state.trackLength);
  if (finished.length > 0) {
    finished.sort((a, b) => b.distance - a.distance);
    state.status = 'finished';
    state.winner = finished[0].id;
  }
}

/* ------------------------------------------------------------------ */
/* Số liệu cho phần vẽ                                                 */
/* ------------------------------------------------------------------ */

export interface CarView extends Car {
  /** Tỉ lệ hoàn thành đường đua, 0..1 */
  progress: number;
  /** Số mét còn lại tới đích */
  remaining: number;
}

export interface RaceFrame {
  mode: RaceMode;
  trackLength: number;
  cars: CarView[];
  status: RaceState['status'];
  winner: CarId | null;
  elapsed: number;
}

export function raceSnapshot(state: RaceState): RaceFrame {
  return {
    mode: state.mode,
    trackLength: state.trackLength,
    cars: state.cars.map((car) => ({
      ...car,
      progress: Math.min(1, car.distance / state.trackLength),
      remaining: Math.max(0, Math.round(state.trackLength - car.distance)),
    })),
    status: state.status,
    winner: state.winner,
    elapsed: state.elapsed,
  };
}

/** Nhãn ngắn cho từng trạng thái xe, dùng ngay trên đường đua */
export const EFFECT_LABEL: Record<CarEffect, string> = {
  none: '',
  boost: '💨 Tăng tốc!',
  superboost: '🔥 BỨT PHÁ!',
  stun: '🌀 Khựng lại...',
};
