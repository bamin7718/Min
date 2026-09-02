/**
 * Logic thuần của trò chơi Sắp Xếp Màu — không phụ thuộc React,
 * để có thể kiểm thử riêng (đặc biệt là tính giải được của đề).
 */

/** Mỗi ống chứa tối đa 4 khối */
export const CAPACITY = 4;
/** Số ống luôn bằng số màu + 1 ống rỗng để có chỗ xoay khối */
export const SPARE_TUBES = 1;

export interface BlockColor {
  key: string;
  color: string;
  /** Ký hiệu đi kèm để bạn nào khó phân biệt màu vẫn chơi được */
  symbol: string;
  name: string;
}

/**
 * Kho màu. Mỗi màn lấy ra một cửa sổ liên tiếp từ đây nên các màn liền nhau
 * trông khác nhau, mà không cần khai từng bộ màu bằng tay.
 *
 * KHÔNG mang theo `symbol`: ký hiệu được gán theo VỊ TRÍ trong bộ màu của màn
 * (xem `paletteFor`). Nếu gắn ký hiệu cố định vào từng màu thì một màn 9 màu có
 * thể chứa hai màu cùng ký hiệu, và bạn nào khó phân biệt màu lại mất đúng cái
 * thứ đang giúp mình.
 */
const COLOR_POOL: Omit<BlockColor, 'symbol'>[] = [
  { key: 'red', color: '#EF4444', name: 'đỏ' },
  { key: 'blue', color: '#3B82F6', name: 'xanh dương' },
  { key: 'yellow', color: '#FBBF24', name: 'vàng' },
  { key: 'green', color: '#22C55E', name: 'xanh lá' },
  { key: 'purple', color: '#8B5CF6', name: 'tím' },
  { key: 'orange', color: '#F97316', name: 'cam' },
  { key: 'sky', color: '#0EA5E9', name: 'xanh trời' },
  { key: 'pink', color: '#EC4899', name: 'hồng' },
  { key: 'teal', color: '#14B8A6', name: 'xanh ngọc' },
  { key: 'indigo', color: '#6366F1', name: 'xanh tím' },
  { key: 'lime', color: '#84CC16', name: 'xanh chanh' },
  { key: 'brown', color: '#A16207', name: 'nâu' },
];

/**
 * Chín ký hiệu phân biệt, đủ cho màn nhiều màu nhất (9 màu).
 *
 * Chỉ dùng các ký tự có trong hầu hết bộ font hệ thống — ký hiệu lạ hơn thì trên
 * một số máy Android hiện thành ô vuông trống, tệ hơn cả không có ký hiệu.
 */
const SYMBOLS = ['●', '▲', '★', '■', '◆', '✚', '♥', '▼', '◇'] as const;

/** Số màu nhiều nhất một màn có thể có, bị chặn bởi số ký hiệu phân biệt */
export const MAX_COLORS = SYMBOLS.length;

/**
 * Bộ màu của một màn: `count` màu liên tiếp trong kho, bắt đầu lệch dần theo
 * màn, kèm ký hiệu gán theo vị trí.
 */
export function paletteFor(level: number, count: number): BlockColor[] {
  const size = Math.min(count, MAX_COLORS);
  const offset = ((level - 1) * 2) % COLOR_POOL.length;
  return Array.from({ length: size }, (_, i) => {
    const entry = COLOR_POOL[(offset + i) % COLOR_POOL.length];
    return { ...entry, symbol: SYMBOLS[i] };
  });
}

/** Các key màu, phần tử đầu mảng nằm ở đáy ống */
export type Tube = string[];
export type Board = Tube[];

export function cloneBoard(board: Board): Board {
  return board.map((tube) => [...tube]);
}

export function topOf(tube: Tube): string | null {
  return tube.length ? tube[tube.length - 1] : null;
}

/** Nước đi hợp lệ: ống đích còn chỗ và đang rỗng hoặc trùng màu ở đỉnh */
export function canMove(board: Board, from: number, to: number): boolean {
  if (from === to) return false;
  const source = board[from];
  const target = board[to];
  if (!source.length) return false;
  if (target.length >= CAPACITY) return false;
  const targetTop = topOf(target);
  return targetTop === null || targetTop === topOf(source);
}

/** Liệt kê mọi nước đi hợp lệ của một trạng thái */
export function legalMoves(board: Board): [number, number][] {
  const moves: [number, number][] = [];
  for (let from = 0; from < board.length; from += 1) {
    for (let to = 0; to < board.length; to += 1) {
      if (canMove(board, from, to)) moves.push([from, to]);
    }
  }
  return moves;
}

/** Thắng khi mỗi màu nằm gọn trong một ống riêng */
export function isSolved(board: Board): boolean {
  const seenColors = new Set<string>();
  for (const tube of board) {
    if (!tube.length) continue;
    const first = tube[0];
    if (!tube.every((block) => block === first)) return false;
    if (seenColors.has(first)) return false;
    seenColors.add(first);
  }
  return true;
}

/**
 * Sinh đề bằng cách đi NGƯỢC từ trạng thái đã giải.
 *
 * Một bước ngược là: lấy khối trên cùng của ống A rồi đặt sang ống B, với điều
 * kiện sau khi lấy ra thì A rỗng hoặc đỉnh mới của A cùng màu với khối vừa lấy.
 * Điều kiện đó đúng bằng điều kiện để nước đi thuận B → A là hợp lệ, nên đề sinh
 * ra LUÔN có lời giải (chỉ cần đi ngược lại). Đây là lý do không dùng cách xáo
 * trộn ngẫu nhiên — xáo ngẫu nhiên có thể tạo ra đề không giải được.
 */
export function generateBoard(
  palette: BlockColor[],
  tubeCount: number,
  scrambleSteps: number,
): Board {
  const board: Board = palette.map((entry) => Array<string>(CAPACITY).fill(entry.key));
  while (board.length < tubeCount) board.push([]);

  for (let step = 0; step < scrambleSteps; step += 1) {
    const candidates: [number, number][] = [];

    for (let from = 0; from < board.length; from += 1) {
      const tube = board[from];
      if (!tube.length) continue;

      const block = tube[tube.length - 1];
      const belowBlock = tube.length >= 2 ? tube[tube.length - 2] : null;
      // Sau khi lấy khối ra, ống phải rỗng hoặc đỉnh mới cùng màu
      if (belowBlock !== null && belowBlock !== block) continue;

      for (let to = 0; to < board.length; to += 1) {
        if (to === from) continue;
        if (board[to].length >= CAPACITY) continue;
        candidates.push([from, to]);
      }
    }

    if (!candidates.length) break;
    const [from, to] = candidates[Math.floor(Math.random() * candidates.length)];
    board[to].push(board[from].pop() as string);
  }

  // Nếu xáo xong vẫn ra trạng thái đã giải thì xáo thêm
  if (isSolved(board)) return generateBoard(palette, tubeCount, scrambleSteps + 4);
  return board;
}

/* ------------------------------------------------------------------ */
/* Đo độ dài lời giải                                                  */
/* ------------------------------------------------------------------ */

/** Chuỗi đại diện một trạng thái, để nhận ra trạng thái đã xét */
function boardKey(board: Board): string {
  // Sắp xếp các ống: hai bàn chỉ khác thứ tự ống là CÙNG một trạng thái, không
  // gộp lại thì BFS xét lặp rất nhiều nhánh tương đương và phình bộ nhớ.
  return board
    .map((tube) => tube.join(','))
    .sort()
    .join('|');
}

/**
 * Số nước đi ít nhất để giải, tìm bằng BFS. `null` nghĩa là không giải được
 * trong `maxDepth` nước (hoặc đã vượt trần số trạng thái được xét).
 *
 * Chỉ dùng cho các màn ĐẦU, nơi không gian trạng thái nhỏ. Với 9 màu thì BFS
 * không khả thi — các màn cao dùng số bước xáo trộn làm thước đo thay thế.
 */
export function shortestSolution(
  board: Board,
  maxDepth = 10,
  maxStates = 40_000,
): number | null {
  if (isSolved(board)) return 0;

  const seen = new Set<string>([boardKey(board)]);
  let frontier: Board[] = [board];

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const next: Board[] = [];
    for (const current of frontier) {
      for (const [from, to] of legalMoves(current)) {
        const candidate = cloneBoard(current);
        candidate[to].push(candidate[from].pop() as string);
        if (isSolved(candidate)) return depth;

        const key = boardKey(candidate);
        if (seen.has(key)) continue;
        seen.add(key);
        if (seen.size > maxStates) return null;
        next.push(candidate);
      }
    }
    if (!next.length) return null;
    frontier = next;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Bế tắc                                                              */
/* ------------------------------------------------------------------ */

/**
 * Không còn nước đi nào có ích.
 *
 * Không chỉ đếm `legalMoves`: chuyển một khối sang ống rỗng rồi chuyển lại vẫn
 * là nước đi "hợp lệ" nên `legalMoves` gần như không bao giờ rỗng. Bế tắc thật
 * là khi mọi nước đi đều chỉ đảo qua đảo lại — nhận ra bằng cách kiểm tra không
 * có ống rỗng nào VÀ không có cặp ống nào chồng được lên nhau.
 */
export function isStuck(board: Board): boolean {
  if (isSolved(board)) return false;
  if (board.some((tube) => tube.length === 0)) return false;

  for (let from = 0; from < board.length; from += 1) {
    for (let to = 0; to < board.length; to += 1) {
      if (from === to) continue;
      if (board[to].length >= CAPACITY) continue;
      if (topOf(board[to]) === topOf(board[from])) return false;
    }
  }
  return true;
}

/** Thêm một ống rỗng — trợ giúp khi bé bị bế tắc */
export function addSpareTube(board: Board): Board {
  return [...cloneBoard(board), []];
}

/* ------------------------------------------------------------------ */
/* Cấu hình từng màn                                                   */
/* ------------------------------------------------------------------ */

/** Số nước hoàn tác giữ lại — đủ để sửa một chuỗi sai ngắn, không phải để dò đề */
export const MAX_UNDO = 5;

/** Số lần được thêm ống hỗ trợ trong một màn */
export const SPARE_TUBE_HELPS = 1;

export interface LevelConfig {
  palette: BlockColor[];
  tubeCount: number;
  /** Số ống rỗng lúc bắt đầu */
  emptyTubes: number;
  scrambleSteps: number;
  /** Tên dải độ khó, hiện cho bé biết mình đang ở đâu */
  band: 'Tập chơi' | 'Dễ' | 'Trung bình' | 'Thách thức';
  /**
   * Khoảng số nước đi mong muốn của lời giải, chỉ đặt ở dải Tập chơi.
   * `null` ở các dải trên vì BFS không đo được trong thời gian chấp nhận được.
   */
  targetMoves: [number, number] | null;
  /** Trần số nước đi; `null` là không giới hạn */
  moveLimit: number | null;
  /** Giới hạn thời gian, tính bằng giây; `null` là không giới hạn */
  timeLimitSec: number | null;
}

/**
 * Độ khó tăng dần theo bốn dải.
 *
 * Vì sao phải chia dải chứ không dùng một công thức trơn: chỉ tăng số bước xáo
 * trộn thì độ khó KHÔNG tăng — với 3 màu / 4 ống, không gian trạng thái quá nhỏ
 * nên xáo 13 hay 40 bước đều ra đề giải trong khoảng 6 nước. Thứ thật sự làm đề
 * khó lên là SỐ MÀU và SỐ ỐNG RỖNG (ít ống rỗng thì mỗi nước đi phải tính trước).
 *
 *   Màn 1-3    2 màu,  1-2 ống rỗng   → 3-5 nước, dạy luật chơi
 *   Màn 4-10   3-4 màu, 2 ống rỗng
 *   Màn 11-25  5-6 màu, 2 ống rỗng
 *   Màn 26+    7-9 màu, 1-2 ống rỗng, thêm trần nước đi rồi tới giới hạn thời gian
 */
export function levelConfig(level: number): LevelConfig {
  const n = Math.max(1, Math.floor(level));

  let colorCount: number;
  let emptyTubes: number;
  let band: LevelConfig['band'];
  let targetMoves: [number, number] | null = null;
  let moveLimit: number | null = null;
  let timeLimitSec: number | null = null;

  if (n <= 3) {
    band = 'Tập chơi';
    colorCount = 2;
    // Màn 1 cho 2 ống rỗng để gần như không thể sai; từ màn 2 rút còn 1
    emptyTubes = n === 1 ? 2 : 1;
    targetMoves = [3, 5];
  } else if (n <= 10) {
    band = 'Dễ';
    // 3 màu ở màn 4-6, 4 màu từ màn 7
    colorCount = n <= 6 ? 3 : 4;
    emptyTubes = 2;
  } else if (n <= 25) {
    band = 'Trung bình';
    colorCount = n <= 17 ? 5 : 6;
    emptyTubes = 2;
  } else {
    band = 'Thách thức';
    // 7 màu ở màn 26-32, 8 màu tới màn 39, 9 màu từ màn 40
    colorCount = Math.min(MAX_COLORS, 7 + Math.floor((n - 26) / 7));
    /*
     * Cứ màn thứ ba lại rút xuống 1 ống rỗng — cần điều chỉnh độ khó mạnh nhất,
     * vì với 1 ống rỗng thì đặt sai một khối là hết đường lùi.
     *
     * Nhưng CHỈ rút khi đã đủ 8 màu. Lý do: dải này phải giữ tổng số ống trong
     * khoảng 9-11, mà 7 màu + 1 ống rỗng mới có 8 ống. Rút sớm hơn thì bàn vừa
     * ít ống vừa ngặt, khó lên theo kiểu bực mình chứ không phải theo kiểu hay.
     */
    emptyTubes = colorCount >= 8 && n % 3 === 0 ? 1 : 2;

    /*
     * Trần nước đi trước, giới hạn thời gian sau. Cố ý không áp cả hai cùng lúc:
     * vừa bị đếm ngược vừa bị đếm nước đi thì bé chỉ còn bấm loạn, mà trò này
     * đáng lẽ để tập tính trước.
     */
    if (n >= 35) {
      timeLimitSec = Math.max(90, 210 - (n - 35) * 5);
    } else {
      moveLimit = Math.max(28, 60 - (n - 26) * 2);
    }
  }

  const scramble =
    band === 'Tập chơi'
      ? 4 + n * 2
      : Math.min(18 + n * 3 + colorCount * 4, 140);

  return {
    palette: paletteFor(n, colorCount),
    tubeCount: colorCount + emptyTubes,
    emptyTubes,
    scrambleSteps: scramble,
    band,
    targetMoves,
    moveLimit,
    timeLimitSec,
  };
}

/**
 * Sinh đề cho một màn, tôn trọng `targetMoves` nếu dải đó có đặt.
 *
 * Ở dải Tập chơi, đề phải giải được trong 3-5 nước: xáo quá sâu thì bé mới học
 * luật đã gặp đề rối, còn xáo quá nhẹ thì đề ra sẵn đã giải. Thử tối đa
 * `attempts` lần rồi lấy đề gần khoảng nhất — luôn trả về một đề GIẢI ĐƯỢC vì
 * `generateBoard` đi ngược từ trạng thái đã giải.
 */
export function generateLevel(level: number, attempts = 24): Board {
  const config = levelConfig(level);
  const make = (steps: number) =>
    generateBoard(config.palette, config.tubeCount, steps);

  if (!config.targetMoves) return make(config.scrambleSteps);

  const [low, high] = config.targetMoves;
  let best: { board: Board; distance: number } | null = null;

  for (let i = 0; i < attempts; i += 1) {
    // Dao động quanh số bước cấu hình để lấy được nhiều độ sâu khác nhau
    const steps = Math.max(2, config.scrambleSteps + (i % 7) - 3);
    const board = make(steps);
    const length = shortestSolution(board, high + 3);

    if (length !== null && length >= low && length <= high) return board;

    const distance =
      length === null ? Number.POSITIVE_INFINITY : Math.abs(length - (low + high) / 2);
    if (!best || distance < best.distance) best = { board, distance };
  }

  return best?.board ?? make(config.scrambleSteps);
}
