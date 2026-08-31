/** Bảng màu & khoảng cách dùng chung, tươi sáng phù hợp học sinh Lớp 3 */
export const colors = {
  // Nền
  background: '#F4F8FF',
  surface: '#FFFFFF',

  // Màu thương hiệu
  primary: '#4C6FFF',
  primaryDark: '#2E4BD8',
  primarySoft: '#E8EDFF',

  // Trạng thái
  success: '#22C55E',
  successSoft: '#DCFCE7',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',

  // Điểm nhấn
  coin: '#FBBF24',
  purple: '#8B5CF6',
  purpleSoft: '#EDE9FE',

  // Chữ
  text: '#1E293B',
  textMuted: '#64748B',
  textOnPrimary: '#FFFFFF',

  // Viền
  border: '#E2E8F0',
  lockOverlay: 'rgba(15, 23, 42, 0.92)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Ngưỡng chiều rộng để chuyển sang layout Tablet */
export const TABLET_BREAKPOINT = 768;

/** Chiều rộng tối đa của phần nội dung, giúp bố cục đẹp trên Tablet */
export const CONTENT_MAX_WIDTH = 760;
