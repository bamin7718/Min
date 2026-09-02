import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, elevation, radius, spacing, touch } from '../constants/theme';
import { AVATAR_CHOICES } from '../types';

/**
 * Hộp thoại chọn avatar.
 *
 * Avatar là emoji chứ không phải ảnh — xem ghi chú ở `AVATAR_CHOICES` trong
 * `types/index.ts`: app chưa có tệp ảnh nhân vật nào, mà thêm ảnh vào `assets/`
 * sẽ làm gói cập nhật ngầm phình lên.
 */
export default function AvatarPicker({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  onSelect: (avatar: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Đóng">
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Chọn hình đại diện</Text>

          <View style={styles.grid}>
            {AVATAR_CHOICES.map((avatar) => {
              const isActive = avatar === value;
              return (
                <Pressable
                  key={avatar}
                  onPress={() => {
                    onSelect(avatar);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`Chọn hình ${avatar}`}
                  style={({ pressed }) => [
                    styles.cell,
                    isActive && styles.cellActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.emoji}>{avatar}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Đóng bộ chọn hình đại diện"
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
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
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
    height: 64,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  emoji: { fontSize: 32 },

  closeButton: {
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  closeText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  pressed: { opacity: 0.75 },
});
