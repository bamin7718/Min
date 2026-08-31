import { colors } from '../../constants/theme';
import type { GameInfo } from '../../types';

/** Danh sách trò chơi hiển thị trên lưới Góc Game */
export const GAMES: GameInfo[] = [
  {
    id: 'mario-mini',
    name: 'Mario Mini',
    emoji: '🍄',
    description: 'Chạy, nhảy, né nấm và hố — ăn thật nhiều tiền vàng!',
    color: colors.danger,
    softColor: colors.dangerSoft,
  },
  {
    id: 'color-sort',
    name: 'Sắp Xếp Màu',
    emoji: '🧪',
    description: 'Xếp các khối cùng màu về chung một ống nghiệm.',
    color: colors.purple,
    softColor: colors.purpleSoft,
  },
];
