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
/**
 * Câu giới thiệu dưới logo.
 *
 * Không nhắc "Lớp 3" nữa: app đã có nội dung cho Lớp 1, 2, 3, 4, 5 và hồ sơ chọn
 * được tới Lớp 12, nên gắn một khối lớp cụ thể vào đây là nói sai với phần lớn
 * người dùng.
 */
export const BRAND_TAGLINE =
  'Ứng Dụng Học Tập & Giải Trí Thông Minh Dành Cho Học Sinh';

/**
 * Dòng THỨ NHẤT ở chân màn hình: phiên bản và tên đầy đủ.
 *
 * Số hiệu bản lấy từ `APP_VERSION` chứ KHÔNG ghi cứng: ghi cứng thì mỗi lần
 * bump version lại phải nhớ sửa thêm chỗ này, và quên một lần là chân màn hình
 * báo sai bản đang chạy.
 */
export const BRAND_FOOTER = `${BRAND_SHORT} v${APP_VERSION} • ${BRAND_NAME}`;

/* ------------------------------------------------------------------ */
/* Bản quyền                                                           */
/* ------------------------------------------------------------------ */

export const BRAND_OWNER = 'Ba Min';
export const BRAND_WEBSITE_LABEL = 'NKTechs.vn';
export const BRAND_WEBSITE_URL = 'https://nktechs.vn/';

/**
 * Dòng THỨ HAI ở chân màn hình.
 *
 * Tách `BRAND_WEBSITE_LABEL` ra thành hằng số riêng thay vì viết cả câu thành
 * một chuỗi: phần tên miền được render bằng một `Text` bấm được, nên nó phải là
 * một mảnh riêng để gắn sự kiện chạm vào.
 */
export const BRAND_COPYRIGHT_PREFIX = `Copyright © ${BRAND_OWNER} - `;
