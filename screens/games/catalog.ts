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
  {
    id: 'penalty',
    name: 'Đá Penalty',
    emoji: '⚽',
    description: 'Vuốt để sút xoáy, hạ thủ môn bay người cản phá!',
    color: colors.success,
    softColor: colors.successSoft,
  },
  {
    id: 'zombie',
    name: 'Bắn Zombie',
    emoji: '🧟',
    description: 'Bắn zombie lấy vàng, mua súng mới và nâng cấp sức mạnh.',
    color: '#166534',
    softColor: '#DCFCE7',
  },
  {
    id: 'racing',
    name: 'Đua Xe Tri Thức',
    emoji: '🏁',
    description: 'Trả lời đúng và nhanh để xe bứt phá về đích trước đối thủ.',
    color: '#B45309',
    softColor: '#FEF3C7',
  },
];
