/**
 * Âm thanh cho các trò chơi, sinh hoàn toàn bằng code — không dùng file mp3 nào.
 *
 * Chỉ có một nền tảng phát được: Web Audio API (bản web / `npx expo start` mở
 * trên trình duyệt). React Native trên Android KHÔNG có Web Audio API, mà dự án
 * hiện chưa cài thư viện âm thanh nào (`expo-audio`), nên trên bản APK các hàm
 * dưới đây im lặng thay vì làm app sập.
 *
 * Muốn có tiếng trên Android thì cần thêm `expo-audio` + `expo-file-system`:
 * dựng mảng byte WAV từ mô tả sóng của `describe()`, ghi thành file trong thư
 * mục cache rồi phát bằng `createAudioPlayer('file://...')`. Phần mô tả sóng đã
 * tách riêng sẵn nên bước đó chỉ việc dùng lại, không phải định nghĩa lại.
 */

export type SoundName =
  | 'shoot'
  | 'hit'
  | 'explosion'
  | 'gold'
  | 'hurt'
  | 'wave'
  | 'boss'
  | 'powerup'
  | 'gameOver';

interface ToneSpec {
  /** Dạng sóng: 'square' đục như tiếng súng, 'sine' tròn như tiếng nhặt vàng */
  type: 'sine' | 'square' | 'sawtooth' | 'triangle';
  /** Tần số đầu → cuối, tính bằng Hz. Trượt xuống nghe như tiếng nổ. */
  fromHz: number;
  toHz: number;
  /** Độ dài, tính bằng giây */
  duration: number;
  /** Âm lượng đỉnh trong khoảng 0..1 */
  gain: number;
  /** Có trộn thêm tiếng ồn trắng không (tiếng nổ, tiếng đạn) */
  noise?: boolean;
}

/** Mô tả sóng của từng tiếng — dùng chung cho mọi nền tảng */
export function describe(name: SoundName): ToneSpec {
  switch (name) {
    case 'shoot':
      return { type: 'square', fromHz: 620, toHz: 180, duration: 0.07, gain: 0.16 };
    case 'hit':
      return { type: 'square', fromHz: 300, toHz: 140, duration: 0.05, gain: 0.1 };
    case 'explosion':
      return {
        type: 'sawtooth',
        fromHz: 220,
        toHz: 40,
        duration: 0.34,
        gain: 0.26,
        noise: true,
      };
    case 'gold':
      return { type: 'sine', fromHz: 880, toHz: 1320, duration: 0.09, gain: 0.14 };
    case 'hurt':
      return { type: 'triangle', fromHz: 380, toHz: 90, duration: 0.18, gain: 0.22 };
    case 'wave':
      return { type: 'sine', fromHz: 420, toHz: 720, duration: 0.22, gain: 0.18 };
    case 'boss':
      return {
        type: 'sawtooth',
        fromHz: 140,
        toHz: 70,
        duration: 0.6,
        gain: 0.28,
        noise: true,
      };
    case 'powerup':
      // Quãng đi lên nghe như "được thưởng"
      return { type: 'sine', fromHz: 660, toHz: 1760, duration: 0.26, gain: 0.2 };
    case 'gameOver':
      return { type: 'triangle', fromHz: 520, toHz: 80, duration: 0.7, gain: 0.24 };
  }
}

/* ------------------------------------------------------------------ */
/* Nền tảng Web Audio                                                  */
/* ------------------------------------------------------------------ */

type AudioCtor = new () => AudioContext;

function audioCtor(): AudioCtor | null {
  const g = globalThis as unknown as {
    AudioContext?: AudioCtor;
    webkitAudioContext?: AudioCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

let ctx: AudioContext | null = null;
let enabled = true;
/**
 * Chống ù tai: mỗi tiếng có khoảng nghỉ tối thiểu. Súng máy bắn 10 phát/giây,
 * nếu phát đủ 10 tiếng thì chỉ thành một mớ tiếng rè.
 */
const lastPlayedAt = new Map<SoundName, number>();
const MIN_GAP_MS: Record<SoundName, number> = {
  shoot: 55,
  hit: 45,
  explosion: 90,
  gold: 40,
  hurt: 160,
  wave: 400,
  boss: 800,
  powerup: 200,
  gameOver: 800,
};

/** Bật/tắt toàn bộ âm thanh trong game */
export function setGameSoundEnabled(value: boolean): void {
  enabled = value;
}

export function isGameSoundEnabled(): boolean {
  return enabled;
}

/** Có phát được tiếng trên nền tảng hiện tại hay không */
export function isGameSoundSupported(): boolean {
  return audioCtor() !== null;
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = audioCtor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    // Trình duyệt chặn tạo AudioContext trước khi người dùng chạm vào trang
    ctx = null;
  }
  return ctx;
}

/**
 * Phát một tiếng. Không bao giờ ném lỗi: âm thanh chỉ là phần phụ, hỏng thì
 * game vẫn phải chạy.
 */
export function playGameSound(name: SoundName): void {
  if (!enabled) return;

  const now = Date.now();
  const last = lastPlayedAt.get(name) ?? 0;
  if (now - last < MIN_GAP_MS[name]) return;
  lastPlayedAt.set(name, now);

  try {
    const audio = ensureContext();
    if (!audio) return;
    // Trình duyệt tự treo context khi chưa có tương tác; đánh thức lại
    if (audio.state === 'suspended') void audio.resume();

    const spec = describe(name);
    const t0 = audio.currentTime;
    const t1 = t0 + spec.duration;

    const gain = audio.createGain();
    gain.gain.setValueAtTime(spec.gain, t0);
    // Tắt dần theo hàm mũ nghe tự nhiên hơn là cắt phựt
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    gain.connect(audio.destination);

    const osc = audio.createOscillator();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.fromHz, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.toHz), t1);
    osc.connect(gain);
    osc.start(t0);
    osc.stop(t1);

    if (spec.noise) {
      // Tiếng ồn trắng ngắn trộn thêm cho tiếng nổ nghe "bụi" hơn
      const frames = Math.floor(audio.sampleRate * Math.min(spec.duration, 0.25));
      const buffer = audio.createBuffer(1, Math.max(1, frames), audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const noiseGain = audio.createGain();
      noiseGain.gain.setValueAtTime(spec.gain * 0.6, t0);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t1);
      noiseGain.connect(audio.destination);

      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(noiseGain);
      source.start(t0);
    }
  } catch {
    // Im lặng: mất tiếng còn hơn làm sập game
  }
}
