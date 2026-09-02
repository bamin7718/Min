import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { radius } from '../constants/theme';

/**
 * Logo Min EG dùng trong ứng dụng: chồng sách giáo khoa (Toán / Tiếng Việt / vở
 * nháp) đặt cạnh tay cầm game khối 3D, kèm huy hiệu chữ "Min EG" ở góc dưới.
 *
 * Vẽ bằng View của React Native chứ KHÔNG dùng `react-native-svg`. Lý do: thư
 * viện đó có phần native, mà `runtimeVersion` theo chính sách fingerprint băm cả
 * phần native — thêm nó là mọi máy đang cài sẽ nhận `runtime-mismatch` từ
 * `api/manifest.ts` và ngừng nhận cập nhật ngầm cho tới khi cài lại APK mới.
 * Hình ở đây chỉ gồm chữ nhật bo góc và hình tròn nên View vẽ được sắc nét ở mọi
 * kích cỡ, không cần SVG.
 *
 * Bản PNG dùng cho icon khi cài lên máy, favicon và màn hình chờ được sinh từ
 * `scripts/generate-icons.mjs` theo CÙNG mô tả hình học này. Sửa tỉ lệ ở đây thì
 * phải sửa `drawEmblem` bên đó rồi chạy `npm run generate-icons`, nếu không logo
 * trong app và icon ngoài màn hình chính sẽ lệch nhau.
 */

const BRAND = {
  bgTop: '#2563EB',
  bgBottom: '#0EA5E9',

  // Mỗi quyển sách có màu mặt và màu tối hơn cho gáy sách + bề dày giấy
  bookMath: '#38BDF8',
  bookMathDeep: '#0284C7',
  bookViet: '#10B981',
  bookVietDeep: '#047857',
  bookThird: '#F59E0B',
  bookThirdDeep: '#B45309',
  pageEdge: '#F8FAFC',

  // Tay cầm: mặt trên, cạnh bên, và khối đùn phía dưới tạo cảm giác 3D
  padFace: '#8B5CF6',
  padSide: '#6D28D9',
  padDeep: '#4C1D95',
  padGloss: 'rgba(255,255,255,0.22)',

  // Nút bấm nhiều màu cho tươi tắn
  padDpad: '#FFFFFF',
  btnTop: '#FCD34D',
  btnRight: '#FB7185',
  btnBottom: '#34D399',
  btnLeft: '#FFFFFF',

  badgeBg: '#FBBF24',
  badgeText: '#1E3A8A',
} as const;

export interface AppIconProps {
  /** Cạnh của logo, tính bằng dp. Dùng tốt ở 32 / 48 / 64 / 96 / 128. */
  size?: number;
  /** Hiện huy hiệu chữ "Min EG". Mặc định chỉ hiện từ 56dp trở lên. */
  withBadge?: boolean;
  /** Vẽ cả nền bo góc chuyển màu, hay chỉ vẽ hình bên trong */
  withBackground?: boolean;
  /** Style thêm cho khung ngoài (canh lề, đổ bóng, xoay…) */
  style?: StyleProp<ViewStyle>;
}

export default function AppIcon({
  size = 64,
  withBadge,
  withBackground = true,
  style,
}: AppIconProps) {
  // Dưới 56dp thì chữ trong huy hiệu chỉ còn vài pixel, hiện ra chỉ thành vệt mờ
  const showBadge = withBadge ?? size >= 56;

  const inset = size * 0.1;
  const box = size - inset * 2;

  /*
   * Huy hiệu nằm ĐÈ lên góc dưới phải chứ không chiếm một dải riêng: chiếm dải
   * riêng thì phần hình bị đẩy lên cao, để lại một khoảng trống rõ rệt giữa
   * chồng sách và huy hiệu.
   */
  const badgeFont = box * 0.09;
  const rowTop = inset;
  const rowHeight = box * (showBadge ? 0.88 : 1);

  const colGap = box * 0.06;
  const colWidth = (box - colGap) / 2;

  // ---- Chồng sách bên trái ----
  const bookH = rowHeight * 0.21;
  const bookGap = rowHeight * 0.05;
  const stackH = bookH * 3 + bookGap * 2;
  const stackTop = rowTop + rowHeight / 2 - stackH / 2;
  // Từ trên xuống: Toán, Tiếng Việt, vở nháp
  const books = [
    { face: BRAND.bookMath, deep: BRAND.bookMathDeep },
    { face: BRAND.bookViet, deep: BRAND.bookVietDeep },
    { face: BRAND.bookThird, deep: BRAND.bookThirdDeep },
  ];

  // ---- Tay cầm game bên phải ----
  const padW = colWidth * 0.98;
  const padH = padW * 0.6;
  const padCx = inset + colWidth + colGap + colWidth / 2;
  const padCy = rowTop + rowHeight / 2;
  const padLeft = padCx - padW / 2;
  const padTop = padCy - padH / 2;
  /** Độ dày khối đùn xuống dưới — thứ tạo ra cảm giác 3D */
  const depth = padH * 0.16;
  const gripR = padH * 0.42;
  const gripDx = padW * 0.4;
  const gripDy = padH * 0.14;

  const dpadCx = padCx - padW * 0.24;
  const dpadArm = padH * 0.28;
  const dpadThick = padH * 0.12;

  const faceCx = padCx + padW * 0.24;
  const faceGap = padH * 0.21;
  const faceR = padH * 0.105;
  /** Bốn nút mặt xếp thành hình thoi quanh `faceCx` */
  const faceButtons = [
    { color: BRAND.btnTop, dx: 0, dy: -faceGap },
    { color: BRAND.btnRight, dx: faceGap, dy: 0 },
    { color: BRAND.btnBottom, dx: 0, dy: faceGap },
    { color: BRAND.btnLeft, dx: -faceGap, dy: 0 },
  ];

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Logo Min EG"
      style={[
        { width: size, height: size },
        withBackground && {
          borderRadius: size * 0.22,
          overflow: 'hidden',
          backgroundColor: BRAND.bgTop,
        },
        style,
      ]}
    >
      {/*
        Nền chuyển màu giả lập bằng hai lớp phủ: React Native không có gradient
        sẵn, mà thêm `expo-linear-gradient` lại là một thư viện native nữa.
      */}
      {withBackground && (
        <>
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: BRAND.bgBottom, top: size * 0.45 },
            ]}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: BRAND.bgBottom, top: size * 0.62, opacity: 0.6 },
            ]}
          />
        </>
      )}

      {/* ---------------- Chồng sách ---------------- */}
      {books.map(({ face, deep }, index) => {
        // Quyển trên hẹp hơn cho giống chồng sách thật
        const shrink = (2 - index) * colWidth * 0.07;
        const width = colWidth - shrink * 2;
        const br = bookH * 0.3;
        return (
          <View
            key={face}
            style={{
              position: 'absolute',
              left: inset + shrink,
              top: stackTop + index * (bookH + bookGap),
              width,
              height: bookH,
              borderRadius: br,
              backgroundColor: face,
            }}
          >
            {/* Bề dày giấy: dải tối ở đáy, đọc ra thành độ dày của quyển sách */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: bookH * 0.26,
                borderBottomLeftRadius: br,
                borderBottomRightRadius: br,
                backgroundColor: deep,
                opacity: 0.55,
              }}
            />
            {/* Gáy sách ở cạnh trái */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: width * 0.14,
                borderTopLeftRadius: br,
                borderBottomLeftRadius: br,
                backgroundColor: deep,
              }}
            />
            {/* Mép giấy sáng màu ở cạnh phải */}
            <View
              style={{
                position: 'absolute',
                right: width * 0.07,
                top: bookH * 0.18,
                width: width * 0.14,
                height: bookH * 0.48,
                borderRadius: bookH * 0.2,
                backgroundColor: BRAND.pageEdge,
                opacity: 0.92,
              }}
            />
          </View>
        );
      })}

      {/* ---------------- Tay cầm game ---------------- */}
      {/*
        Vẽ ba lớp chồng lên nhau, từ dưới lên: khối đùn (tối nhất, lệch xuống
        `depth`), rồi mặt trên. Chính khoảng lệch đó tạo ra cảm giác dày và nổi
        khối mà không cần đến gradient hay bóng đổ.
      */}
      <View
        style={{
          position: 'absolute',
          left: padCx - gripDx - gripR,
          top: padCy + gripDy - gripR + depth,
          width: gripR * 2,
          height: gripR * 2,
          borderRadius: gripR,
          backgroundColor: BRAND.padDeep,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: padCx + gripDx - gripR,
          top: padCy + gripDy - gripR + depth,
          width: gripR * 2,
          height: gripR * 2,
          borderRadius: gripR,
          backgroundColor: BRAND.padDeep,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: padLeft,
          top: padTop + depth,
          width: padW,
          height: padH,
          borderRadius: padH * 0.42,
          backgroundColor: BRAND.padDeep,
        }}
      />

      {/* Tay nắm hai bên, màu cạnh cho tách khỏi mặt trên */}
      <View
        style={{
          position: 'absolute',
          left: padCx - gripDx - gripR,
          top: padCy + gripDy - gripR,
          width: gripR * 2,
          height: gripR * 2,
          borderRadius: gripR,
          backgroundColor: BRAND.padSide,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: padCx + gripDx - gripR,
          top: padCy + gripDy - gripR,
          width: gripR * 2,
          height: gripR * 2,
          borderRadius: gripR,
          backgroundColor: BRAND.padSide,
        }}
      />

      {/* Mặt trên của tay cầm */}
      <View
        style={{
          position: 'absolute',
          left: padLeft,
          top: padTop,
          width: padW,
          height: padH,
          borderRadius: padH * 0.42,
          backgroundColor: BRAND.padFace,
        }}
      >
        {/* Vệt sáng ở mép trên cho ra chất nhựa bóng */}
        <View
          style={{
            position: 'absolute',
            left: padW * 0.1,
            top: padH * 0.1,
            width: padW * 0.8,
            height: padH * 0.2,
            borderRadius: padH * 0.1,
            backgroundColor: BRAND.padGloss,
          }}
        />
      </View>

      {/* Nút thập bên trái */}
      <View
        style={{
          position: 'absolute',
          left: dpadCx - dpadThick / 2,
          top: padCy - dpadArm,
          width: dpadThick,
          height: dpadArm * 2,
          borderRadius: dpadThick / 2,
          backgroundColor: BRAND.padDpad,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: dpadCx - dpadArm,
          top: padCy - dpadThick / 2,
          width: dpadArm * 2,
          height: dpadThick,
          borderRadius: dpadThick / 2,
          backgroundColor: BRAND.padDpad,
        }}
      />

      {/* Bốn nút mặt nhiều màu bên phải */}
      {faceButtons.map(({ color, dx, dy }) => (
        <View
          key={`${color}-${dx}-${dy}`}
          style={{
            position: 'absolute',
            left: faceCx + dx - faceR,
            top: padCy + dy - faceR,
            width: faceR * 2,
            height: faceR * 2,
            borderRadius: faceR,
            backgroundColor: color,
          }}
        />
      ))}

      {/* ---------------- Huy hiệu "Min EG" ở góc dưới phải ---------------- */}
      {showBadge && (
        <View
          style={{
            position: 'absolute',
            right: inset,
            bottom: inset,
            backgroundColor: BRAND.badgeBg,
            borderRadius: radius.pill,
            paddingHorizontal: box * 0.04,
            paddingVertical: badgeFont * 0.3,
          }}
        >
          <Text
            style={{
              fontSize: badgeFont,
              lineHeight: badgeFont * 1.2,
              fontWeight: '800',
              color: BRAND.badgeText,
            }}
          >
            Min EG
          </Text>
        </View>
      )}
    </View>
  );
}
