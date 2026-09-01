import { Platform, type ViewStyle } from 'react-native';

/**
 * Hệ thiết kế của ứng dụng — phong cách EdTech gamified, tông pastel tươi nhưng
 * dịu mắt cho học sinh 8 tuổi.
 *
 * Mỗi môn có một màu riêng để học sinh nhận ra ngay mình đang ở đâu:
 *  - Toán       → xanh dương / cyan
 *  - Tiếng Việt → xanh ngọc / mint
 *  - Góc Game   → tím
 *  - Điểm thưởng→ vàng nắng / san hô
 */
export const colors = {
  // Nền
  background: '#F5F8FF',
  backgroundAlt: '#EEF3FF',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFF',

  // Màu thương hiệu (cũng là màu môn Toán)
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primarySoft: '#DBEAFE',

  // Màu theo môn học
  math: '#0EA5E9',
  mathSoft: '#E0F2FE',
  vietnamese: '#10B981',
  vietnameseSoft: '#D1FAE5',
  english: '#8B5CF6',
  englishSoft: '#EDE9FE',

  // Góc Game
  game: '#7C3AED',
  gameSoft: '#EDE9FE',

  // Điểm thưởng
  reward: '#F59E0B',
  rewardSoft: '#FEF3C7',
  coral: '#FB7185',
  coralSoft: '#FFE4E6',

  // Trạng thái
  success: '#10B981',
  successSoft: '#D1FAE5',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',

  // Giữ lại tên cũ để không phải sửa hàng loạt nơi đang dùng
  purple: '#7C3AED',
  purpleSoft: '#EDE9FE',
  coin: '#F59E0B',

  // Chữ
  text: '#0F172A',
  textMuted: '#64748B',
  textOnPrimary: '#FFFFFF',

  // Viền và lớp phủ
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  lockOverlay: 'rgba(15, 23, 42, 0.92)',
  /** Nền mờ của thanh điều hướng dưới cùng */
  glass: 'rgba(255, 255, 255, 0.92)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Bo góc mềm theo phong cách 2026 */
export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/**
 * Chiều cao tối thiểu của nút bấm.
 * Học sinh 8 tuổi bấm chưa chính xác nên vùng chạm phải đủ rộng — 48dp là mức
 * tối thiểu theo hướng dẫn của Material, 56dp cho nút hành động chính.
 */
export const touch = {
  min: 48,
  primary: 56,
} as const;

/** Bóng đổ nhẹ cho thẻ nổi */
export function elevation(level: 1 | 2 | 3): ViewStyle {
  const config = {
    1: { radius: 8, opacity: 0.06, offset: 2, android: 2 },
    2: { radius: 16, opacity: 0.1, offset: 4, android: 5 },
    3: { radius: 24, opacity: 0.14, offset: 8, android: 10 },
  }[level];

  return Platform.select<ViewStyle>({
    android: { elevation: config.android },
    default: {
      shadowColor: '#0F172A',
      shadowOpacity: config.opacity,
      shadowRadius: config.radius,
      shadowOffset: { width: 0, height: config.offset },
    },
  }) as ViewStyle;
}

/**
 * Khoảng trống phải chừa ở đáy mỗi màn hình.
 * Thanh tab nổi tuyệt đối nên nội dung cuộn phải có padding, nếu không dòng
 * cuối cùng sẽ nằm khuất phía sau thanh tab.
 */
export const TAB_BAR_SPACE = 96;

/** Ngưỡng chiều rộng để chuyển sang layout Tablet */
export const TABLET_BREAKPOINT = 768;

/** Chiều rộng tối đa của phần nội dung, giúp bố cục đẹp trên Tablet */
export const CONTENT_MAX_WIDTH = 760;
