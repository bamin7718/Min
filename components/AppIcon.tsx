import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radius } from '../constants/theme';

/**
 * Logo Min EG dùng trong ứng dụng: chồng sách tri thức đặt cạnh tay cầm game,
 * kèm huy hiệu chữ "Min EG".
 *
 * Vẽ bằng View của React Native chứ KHÔNG dùng `react-native-svg`. Lý do: thêm
 * thư viện đó là thay đổi phần native, mà `runtimeVersion` theo chính sách
 * fingerprint sẽ đổi theo — nghĩa là mọi máy đang cài phải tải lại APK mới nhận
 * được bản cập nhật, đúng cái vừa mất công tránh khi dựng cơ chế cập nhật ngầm.
 * Hình ở đây chỉ gồm hình chữ nhật bo góc và hình tròn nên View vẽ được sắc nét
 * ở mọi kích cỡ, không cần SVG.
 *
 * Bản PNG dùng cho icon khi cài lên máy, favicon và màn hình chờ được sinh từ
 * `scripts/generate-icons.mjs` theo cùng một mô tả hình học.
 */

const BRAND = {
  bgTop: '#2563EB',
  bgBottom: '#0EA5E9',
  bookMath: '#38BDF8',
  bookViet: '#10B981',
  bookThird: '#F59E0B',
  pageEdge: '#F8FAFC',
  pad: '#7C3AED',
  padDark: '#5B21B6',
  padButton: '#FFFFFF',
  badgeBg: '#FFFFFF',
  badgeText: '#1D4ED8',
} as const;

export interface AppIconProps {
  /** Cạnh của logo, tính bằng dp */
  size?: number;
  /** Hiện huy hiệu chữ "Min EG". Nên tắt ở cỡ nhỏ vì chữ sẽ không đọc được. */
  withBadge?: boolean;
  /** Vẽ cả nền bo góc chuyển màu, hay chỉ vẽ hình bên trong */
  withBackground?: boolean;
}

export default function AppIcon({
  size = 64,
  withBadge,
  withBackground = true,
}: AppIconProps) {
  // Dưới 56dp thì chữ trong huy hiệu chỉ còn vài pixel, hiện ra chỉ thành vệt mờ
  const showBadge = withBadge ?? size >= 56;

  const inset = size * 0.1;
  const box = size - inset * 2;

  const badgeFont = box * 0.19;
  const badgeH = showBadge ? badgeFont * 1.85 : 0;
  const rowTop = inset + badgeH + (showBadge ? box * 0.08 : box * 0.06);
  const rowHeight = inset + box - rowTop;

  const colGap = box * 0.08;
  const colWidth = (box - colGap) / 2;

  const bookH = rowHeight * 0.26;
  const bookGap = rowHeight * 0.09;
  const stackH = bookH * 3 + bookGap * 2;
  const stackTop = rowTop + rowHeight / 2 - stackH / 2;

  const padW = colWidth * 0.94;
  const padH = padW * 0.56;
  const padLeft = inset + colWidth + colGap + (colWidth - padW) / 2;
  const padTop = rowTop + rowHeight / 2 - padH / 2;
  const gripR = padH * 0.44;

  // Từ trên xuống: Toán, Tiếng Việt, vở nháp
  const books = [BRAND.bookMath, BRAND.bookViet, BRAND.bookThird];

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
      ]}
    >
      {/*
        Nền chuyển màu giả lập bằng hai lớp phủ: React Native không có gradient
        sẵn, mà thêm `expo-linear-gradient` lại là một thư viện native nữa.
      */}
      {withBackground && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: BRAND.bgBottom, top: size * 0.45 },
          ]}
        />
      )}
      {withBackground && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: BRAND.bgBottom, top: size * 0.62, opacity: 0.6 },
          ]}
        />
      )}

      {/* Huy hiệu "Min EG" */}
      {showBadge && (
        <View
          style={{
            position: 'absolute',
            top: inset,
            left: inset,
            width: box,
            height: badgeH,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: BRAND.badgeBg,
              borderRadius: radius.pill,
              paddingHorizontal: box * 0.09,
              paddingVertical: badgeH * 0.14,
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
        </View>
      )}

      {/* Chồng sách */}
      {books.map((color, index) => {
        const shrink = (2 - index) * colWidth * 0.06;
        const width = colWidth - shrink * 2;
        return (
          <View
            key={color}
            style={{
              position: 'absolute',
              left: inset + shrink,
              top: stackTop + index * (bookH + bookGap),
              width,
              height: bookH,
              borderRadius: bookH * 0.32,
              backgroundColor: color,
            }}
          >
            {/* Mép giấy sáng màu ở cạnh phải */}
            <View
              style={{
                position: 'absolute',
                right: width * 0.06,
                top: bookH * 0.18,
                width: width * 0.16,
                height: bookH * 0.64,
                borderRadius: bookH * 0.2,
                backgroundColor: BRAND.pageEdge,
                opacity: 0.9,
              }}
            />
          </View>
        );
      })}

      {/* Tay cầm game: hai tay nắm tròn rồi tới thân */}
      <View
        style={{
          position: 'absolute',
          left: padLeft + padW * 0.1 - gripR,
          top: padTop + padH * 0.16 + padH / 2 - gripR,
          width: gripR * 2,
          height: gripR * 2,
          borderRadius: gripR,
          backgroundColor: BRAND.padDark,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: padLeft + padW * 0.9 - gripR,
          top: padTop + padH * 0.16 + padH / 2 - gripR,
          width: gripR * 2,
          height: gripR * 2,
          borderRadius: gripR,
          backgroundColor: BRAND.padDark,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: padLeft,
          top: padTop,
          width: padW,
          height: padH,
          borderRadius: padH * 0.42,
          backgroundColor: BRAND.pad,
        }}
      >
        {/* Nút thập bên trái */}
        <View
          style={{
            position: 'absolute',
            left: padW * 0.26 - padH * 0.065,
            top: padH * 0.2,
            width: padH * 0.13,
            height: padH * 0.6,
            borderRadius: padH * 0.065,
            backgroundColor: BRAND.padButton,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: padW * 0.26 - padH * 0.3,
            top: padH * 0.435,
            width: padH * 0.6,
            height: padH * 0.13,
            borderRadius: padH * 0.065,
            backgroundColor: BRAND.padButton,
          }}
        />
        {/* Hai nút bấm bên phải */}
        <View
          style={{
            position: 'absolute',
            left: padW * 0.68 - padH * 0.12,
            top: padH * 0.6 - padH * 0.12,
            width: padH * 0.24,
            height: padH * 0.24,
            borderRadius: padH * 0.12,
            backgroundColor: BRAND.padButton,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: padW * 0.82 - padH * 0.12,
            top: padH * 0.36 - padH * 0.12,
            width: padH * 0.24,
            height: padH * 0.24,
            borderRadius: padH * 0.12,
            backgroundColor: BRAND.padButton,
          }}
        />
      </View>
    </View>
  );
}
