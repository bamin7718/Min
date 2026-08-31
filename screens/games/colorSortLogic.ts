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

/** Bộ màu đổi theo màn để đỡ nhàm */
export const PALETTES: BlockColor[][] = [
  [
    { key: 'red', color: '#EF4444', symbol: '●', name: 'đỏ' },
    { key: 'blue', color: '#3B82F6', symbol: '▲', name: 'xanh dương' },
    { key: 'yellow', color: '#FBBF24', symbol: '★', name: 'vàng' },
    { key: 'green', color: '#22C55E', symbol: '■', name: 'xanh lá' },
  ],
  [
    { key: 'green', color: '#22C55E', symbol: '■', name: 'xanh lá' },
    { key: 'purple', color: '#8B5CF6', symbol: '◆', name: 'tím' },
    { key: 'orange', color: '#F97316', symbol: '✚', name: 'cam' },
    { key: 'sky', color: '#0EA5E9', symbol: '●', name: 'xanh trời' },
  ],
  [
    { key: 'pink', color: '#EC4899', symbol: '♥', name: 'hồng' },
    { key: 'teal', color: '#14B8A6', symbol: '▼', name: 'xanh ngọc' },
    { key: 'indigo', color: '#6366F1', symbol: '◇', name: 'xanh tím' },
    { key: 'lime', color: '#84CC16', symbol: '▲', name: 'xanh chanh' },
  ],
];

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

export interface LevelConfig {
  palette: BlockColor[];
  tubeCount: number;
  scrambleSteps: number;
}

/**
 * Cấu hình từng màn.
 *
 * Chỉ tăng số bước xáo trộn thì độ khó KHÔNG tăng: với 3 màu / 4 ống, không gian
 * trạng thái quá nhỏ nên xáo 13 hay 40 bước đều ra đề giải trong khoảng 6 nước.
 * Vì vậy từ màn 3 trở đi thêm một màu (và một ống) để đề dài ra thật sự.
 */
export function levelConfig(level: number): LevelConfig {
  const colorCount = level <= 2 ? 3 : 4;
  const basePalette = PALETTES[(level - 1) % PALETTES.length];

  return {
    palette: basePalette.slice(0, colorCount),
    tubeCount: colorCount + SPARE_TUBES,
    scrambleSteps: Math.min(12 + level * 4, 60),
  };
}
