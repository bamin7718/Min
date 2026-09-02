import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, elevation, radius, spacing, touch } from '../constants/theme';
import { MAX_GRADE, MIN_GRADE } from '../types';

/**
 * Bộ chọn khối lớp 1-12, dạng lưới trong một hộp thoại.
 *
 * Dùng lưới chứ không dùng danh sách cuộn hay `Picker` của hệ thống: 12 lựa chọn
 * vừa đúng một lưới 4x3 nên học sinh thấy hết cùng lúc và chỉ cần một lần chạm.
 * `Picker` native thì mỗi nền tảng hiện một kiểu khác nhau và ô chạm nhỏ hơn
 * ngưỡng 48dp mà app đang giữ.
 *
 * LƯU Ý VỀ NỘI DUNG: khối lớp hiện chỉ là thông tin hồ sơ. Ngân hàng câu hỏi
 * trong `constants/mathCurriculum.ts` và `vietnameseCurriculum.ts` là của Lớp 3,
 * nên chọn lớp khác KHÔNG đổi đề bài. Chỗ hiển thị phải nói rõ điều này để phụ
 * huynh không hiểu sai.
 */

const GRADES = Array.from(
  { length: MAX_GRADE - MIN_GRADE + 1 },
  (_, index) => MIN_GRADE + index,
);

export function gradeLabel(grade: number): string {
  return `Lớp ${grade}`;
}

export default function GradePicker({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: number;
  onSelect: (grade: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Đóng">
        {/*
          Pressable lồng trong Pressable: lớp ngoài đóng hộp thoại khi bấm ra
          ngoài, lớp trong chặn sự kiện đó lại để bấm vào thẻ không làm đóng.
        */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Con học lớp mấy?</Text>
          <Text style={styles.note}>
            Câu hỏi trong app hiện là chương trình Lớp 3. Khối lớp ở đây chỉ để
            hiện trên hồ sơ.
          </Text>

          <ScrollView contentContainerStyle={styles.grid}>
            {GRADES.map((grade) => {
              const isActive = grade === value;
              return (
                <Pressable
                  key={grade}
                  onPress={() => {
                    onSelect(grade);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`Chọn ${gradeLabel(grade)}`}
                  style={({ pressed }) => [
                    styles.cell,
                    isActive && styles.cellActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.cellText, isActive && styles.cellTextActive]}>
                    {grade}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Đóng bộ chọn khối lớp"
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>Đóng</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...elevation(3),
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.sm,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  cell: {
    width: 64,
    height: touch.primary,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  cellText: { fontSize: 20, fontWeight: '800', color: colors.text },
  cellTextActive: { color: colors.primary },

  closeButton: {
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  closeText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  pressed: { opacity: 0.75 },
});
