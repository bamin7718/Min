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
export const BRAND_TAGLINE = 'Học tập & Góc Game - Dành cho học sinh Lớp 3';

/**
 * Dòng bản quyền ở chân màn hình Đăng nhập và Cài đặt.
 *
 * Số hiệu bản lấy từ `APP_VERSION` chứ KHÔNG ghi cứng: ghi cứng thì mỗi lần
 * bump version lại phải nhớ sửa thêm chỗ này, và quên một lần là chân màn hình
 * báo sai bản đang chạy.
 */
export const BRAND_FOOTER = `${BRAND_SHORT} v${APP_VERSION} • ${BRAND_NAME}`;
