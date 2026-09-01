import { APP_VERSION } from './version';

/**
 * Tên thương hiệu, khai một chỗ duy nhất.
 *
 * Trước đây chuỗi "Học tập & Góc Game Lớp 3" bị chép tay ở bốn nơi (app.json,
 * màn hình chờ, màn hình đăng nhập, màn hình cài đặt), đổi tên là phải nhớ sửa
 * đủ cả bốn. Từ nay chỉ sửa ở đây.
 */
export const BRAND_NAME = 'Min Education Gamification';
export const BRAND_SHORT = 'Min EG';
export const BRAND_TAGLINE = 'Học tập & Góc Game Lớp 3';

/** Dòng bản quyền ở chân màn hình Đăng nhập và Cài đặt */
export const BRAND_FOOTER = `${BRAND_SHORT} v${APP_VERSION} • ${BRAND_NAME}`;
