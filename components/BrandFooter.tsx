import React, { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import {
  BRAND_COPYRIGHT_PREFIX,
  BRAND_FOOTER,
  BRAND_WEBSITE_LABEL,
  BRAND_WEBSITE_URL,
} from '../constants/brand';
import { colors, spacing, touch } from '../constants/theme';

/**
 * Chân trang bản quyền, dùng chung cho màn Đăng nhập và màn Cài đặt.
 *
 *     Min EG v1.0.8 • Min Education Gamification
 *     Copyright © Ba Min - NKTechs.vn
 *
 * Tách thành component riêng chứ không chép hai lần: `constants/brand.ts` đã ghi
 * lại chuyện chuỗi thương hiệu từng bị chép tay ở bốn nơi và đổi tên là phải nhớ
 * sửa đủ cả bốn. Footer có thêm sự kiện chạm nên còn dễ lệch hơn một chuỗi.
 */
export default function BrandFooter({ style }: { style?: StyleProp<ViewStyle> }) {
  const openWebsite = useCallback(async () => {
    try {
      await Linking.openURL(BRAND_WEBSITE_URL);
    } catch (error) {
      // Không có trình duyệt hoặc URL bị chặn — chân trang không phải chỗ để
      // báo lỗi, im lặng còn hơn làm bé hoảng vì một dòng đỏ.
      console.warn('[footer] Không mở được website:', error);
    }
  }, []);

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.line}>{BRAND_FOOTER}</Text>

      {/*
        Vùng chạm bọc CẢ dòng thứ hai, không chỉ mấy chữ tên miền: chữ ở cỡ 12
        thì riêng "NKTechs.vn" chỉ cao khoảng 14dp, thấp hơn nhiều ngưỡng 48dp mà
        app đang giữ. Bọc cả dòng thì vùng chạm đủ rộng, còn phần tên miền vẫn
        được gạch chân để bé biết chỗ nào bấm được.
      */}
      <Pressable
        onPress={() => void openWebsite()}
        accessibilityRole="link"
        accessibilityLabel={`Mở website ${BRAND_WEBSITE_LABEL}`}
        hitSlop={8}
        style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
      >
        <Text style={styles.line}>
          {BRAND_COPYRIGHT_PREFIX}
          <Text style={styles.link}>{BRAND_WEBSITE_LABEL}</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md,
  },
  line: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: 'center',
    // Chữ đã là màu xám dịu; thêm opacity cho nó lùi hẳn về sau nội dung chính
    opacity: 0.7,
  },
  linkRow: {
    minHeight: touch.min / 2,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  pressed: { opacity: 0.6 },
});
