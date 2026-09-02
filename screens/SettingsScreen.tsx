import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AvatarPicker from '../components/AvatarPicker';
import BrandFooter from '../components/BrandFooter';
import GradePicker, { gradeLabel } from '../components/GradePicker';
import {
  TAB_BAR_SPACE,
  colors,
  elevation,
  radius,
  spacing,
  touch,
} from '../constants/theme';
import { APP_VERSION } from '../constants/version';
import { useAuth } from '../context/AuthContext';
import { usePlaytime } from '../context/PlaytimeContext';
import { isApiConfigured } from '../lib/authApi';
import { checkAppUpdate, type UpdateInfo } from '../lib/updateChecker';
import { isOtaSupported } from '../lib/otaUpdates';
import {
  DEFAULT_AV_PREFS,
  isBgmSupported,
  isHapticsSupported,
  isSfxSupported,
  loadAvPrefs,
  saveAvPrefs,
  type AvPrefs,
} from '../lib/prefs';
import { clearDerivedCache } from '../lib/storage';
import {
  checkForInAppUpdate,
  downloadAndApplyUpdate,
  isDemoUpdate,
  runningUpdateLabel,
} from '../services/updateService';
import { REWARD_MULTIPLIER_CHOICES, type ParentSettings } from '../types';
import UpdateModal from './UpdateModal';

/** Đường dẫn tải APK, đặt trong .env */
const APK_URL = process.env.EXPO_PUBLIC_APK_DOWNLOAD_URL?.trim();

interface Message {
  type: 'ok' | 'error';
  text: string;
}

/**
 * Màn hình Cài đặt, chia làm hai vùng rõ rệt:
 *
 *  - **Vùng của học sinh** (hồ sơ, âm thanh) mở thẳng, không cần mã gì. Con tự
 *    đổi avatar và tên được.
 *  - **Vùng quản lý của phụ huynh** (hạn mức giờ, đổi PIN, báo cáo, khoá app)
 *    nằm sau mã PIN 4 số, và chỉ được **render sau khi nhập đúng** — không phải
 *    ẩn bằng style, nên không có ô nào trong cây component để dò ra.
 *
 * Trước bản 1.0.8, cả màn hình này bị chặn bởi PIN với tài khoản vai trò
 * `parent`, còn học sinh thì không thấy các mục quản lý. Cách đó chết khi đăng ký
 * bỏ phần chọn vai trò — mọi tài khoản thành `student` nên sẽ không ai vào được
 * vùng quản lý nữa. Vì vậy cổng bảo vệ chuyển từ "vai trò" sang "mã PIN".
 *
 * @param embedded Màn này mở được từ hai chỗ: modal bánh răng (chiếm cả màn hình
 *   nên phải tự chừa tai thỏ) và tab "Cài Đặt" (nằm dưới thanh header cố định,
 *   phần tai thỏ đã được chừa sẵn). `embedded` phân biệt hai trường hợp đó để
 *   không chừa khoảng trắng hai lần.
 */
export default function SettingsScreen({
  onClose,
  embedded = false,
}: {
  onClose: () => void;
  embedded?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          { paddingTop: (embedded ? 0 : insets.top) + spacing.md },
        ]}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Đóng cài đặt"
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textOnPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Cài đặt</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + TAB_BAR_SPACE },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ProfileSection />
        <SoundSection />
        <ParentZoneSection />
        <UpdateSection onSignedOut={onClose} />
        <SignOutSection onClose={onClose} />

        <BrandFooter />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */
/* 1. 👤 Thông tin học sinh                                            */
/* ------------------------------------------------------------------ */

function ProfileSection() {
  const { session, updateProfile } = useAuth();
  const [name, setName] = useState(session?.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);

  if (!session) return null;

  const saveName = async () => {
    Keyboard.dismiss();
    setBusy(true);
    setMessage(null);
    const result = await updateProfile({ displayName: name });
    setBusy(false);
    setMessage(
      result.ok
        ? { type: 'ok', text: 'Đã lưu họ và tên.' }
        : { type: 'error', text: result.error ?? 'Không lưu được tên.' },
    );
  };

  /**
   * Avatar và khối lớp lưu NGAY khi chọn, không cần nút Lưu riêng.
   *
   * Khác họ tên: hai thứ này chọn từ danh sách cố định nên không có gì để kiểm
   * tra hay sửa lại, thêm một nút bấm nữa chỉ làm dài thao tác.
   */
  const savePick = async (patch: { avatar?: string; grade?: number }) => {
    setBusy(true);
    setMessage(null);
    const result = await updateProfile(patch);
    setBusy(false);
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'Không lưu được thay đổi.' });
    }
  };

  return (
    <Section icon="person-circle-outline" title="Thông tin học sinh">
      {/* Avatar bấm được để đổi hình */}
      <View style={styles.profileTop}>
        <Pressable
          onPress={() => setAvatarOpen(true)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Đổi hình đại diện"
          style={({ pressed }) => [styles.avatarCircle, pressed && styles.pressed]}
        >
          <Text style={styles.avatarEmoji}>{session.avatar}</Text>
          <View style={styles.avatarEditDot}>
            <Ionicons name="pencil" size={11} color={colors.textOnPrimary} />
          </View>
        </Pressable>

        <View style={styles.profileMeta}>
          <Text style={styles.profileName} numberOfLines={2}>
            {session.displayName}
          </Text>
          {/* Tên đăng nhập chỉ đọc: nó là ID tra tài khoản, đổi được thì con
              có thể tự làm mình không đăng nhập lại được. */}
          <View style={styles.usernameBadge}>
            <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
            <Text style={styles.usernameText}>{session.username}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.label}>Họ và tên</Text>
      <TextInput
        value={name}
        onChangeText={(text) => {
          setName(text);
          setMessage(null);
        }}
        placeholder="vidu: Nguyễn Minh Khang"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="words"
        maxLength={48}
        editable={!busy}
        style={styles.input}
        accessibilityLabel="Họ và tên"
      />
      {message && <Message message={message} />}
      <ActionButton
        label="Lưu tên"
        icon="save-outline"
        busy={busy}
        onPress={() => void saveName()}
        accessibilityLabel="Lưu họ và tên"
      />

      <Text style={styles.label}>Khối lớp</Text>
      <Pressable
        onPress={() => setGradeOpen(true)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Khối lớp hiện tại: ${gradeLabel(session.grade)}. Bấm để đổi.`}
        style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
      >
        <Text style={styles.selectorText}>🎓 {gradeLabel(session.grade)}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.primary} />
      </Pressable>
      <Text style={styles.hint}>
        Câu hỏi trong app hiện là chương trình Lớp 3. Khối lớp chỉ hiện trên hồ sơ
        và trên thanh đầu ứng dụng.
      </Text>

      <AvatarPicker
        visible={avatarOpen}
        value={session.avatar}
        onSelect={(avatar) => void savePick({ avatar })}
        onClose={() => setAvatarOpen(false)}
      />
      <GradePicker
        visible={gradeOpen}
        value={session.grade}
        onSelect={(grade) => void savePick({ grade })}
        onClose={() => setGradeOpen(false)}
      />
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. 🔊 Âm thanh & Game                                               */
/* ------------------------------------------------------------------ */

function SoundSection() {
  const [prefs, setPrefs] = useState<AvPrefs>(DEFAULT_AV_PREFS);

  useEffect(() => {
    let cancelled = false;
    void loadAvPrefs().then((loaded) => {
      if (!cancelled) setPrefs(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<AvPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      void saveAvPrefs(next);
      return next;
    });
  }, []);

  const sfxOn = isSfxSupported();
  const bgmOn = isBgmSupported();
  const hapticsOn = isHapticsSupported();

  return (
    <Section icon="volume-high-outline" title="Âm thanh & Game">
      <ToggleRow
        label="Nhạc nền"
        value={prefs.bgm}
        disabled={!bgmOn}
        onChange={(value) => update({ bgm: value })}
      />
      {!bgmOn && (
        <Text style={styles.hint}>
          Bản này chưa có nhạc nền: app không kèm tệp nhạc nào và cũng chưa cài
          thư viện phát nhạc. Thêm được nhạc thì công tắc này sẽ hoạt động.
        </Text>
      )}

      <ToggleRow
        label="Hiệu ứng âm thanh trong game"
        value={prefs.sfx}
        disabled={!sfxOn}
        onChange={(value) => update({ sfx: value })}
      />
      {!sfxOn && (
        <Text style={styles.hint}>
          Máy này chưa phát được tiếng. Tiếng trong game được sinh bằng Web Audio
          API nên hiện chỉ kêu ở bản chạy trên trình duyệt.
        </Text>
      )}

      <ToggleRow
        label="Rung khi trả lời sai"
        value={prefs.haptics}
        disabled={!hapticsOn}
        onChange={(value) => update({ haptics: value })}
      />
      {!hapticsOn && <Text style={styles.hint}>Máy này không có motor rung.</Text>}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. 🛡️ Khu vực quản lý của phụ huynh — sau mã PIN                    */
/* ------------------------------------------------------------------ */

function ParentZoneSection() {
  const { session, pinUnlocked } = useAuth();
  const [open, setOpen] = useState(false);

  if (!session) return null;

  // Đã mở khoá trong phiên này thì vào thẳng, không hỏi lại liên tục
  if (pinUnlocked) return <ParentPanel />;

  if (!open) {
    return (
      <Section icon="shield-checkmark-outline" title="Khu vực phụ huynh">
        <Text style={styles.hint}>
          {session.hasPin
            ? 'Nhập mã PIN 4 số để cấu hình thời gian chơi game và xem báo cáo học tập.'
            : 'Tài khoản chưa có mã PIN. Phụ huynh đặt mã 4 số để bảo vệ vùng cấu hình.'}
        </Text>
        <ActionButton
          label={session.hasPin ? 'Mở cấu hình quản lý' : 'Thiết lập mã PIN phụ huynh'}
          icon="lock-open-outline"
          busy={false}
          onPress={() => setOpen(true)}
          accessibilityLabel="Mở cấu hình quản lý phụ huynh"
        />
      </Section>
    );
  }

  return session.hasPin ? (
    <ParentPinPrompt onCancel={() => setOpen(false)} />
  ) : (
    <PinChangeSection firstTime onDone={() => setOpen(false)} />
  );
}

/** Ô nhập PIN gọn nằm ngay trong màn Cài đặt */
function ParentPinPrompt({ onCancel }: { onCancel: () => void }) {
  const { verifyPin } = useAuth();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const submit = useCallback(async () => {
    Keyboard.dismiss();
    if (!/^\d{4}$/.test(pin)) {
      setMessage({ type: 'error', text: 'Mã PIN gồm đúng 4 chữ số.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await verifyPin(pin);
    setBusy(false);
    if (!result.ok) {
      setPin('');
      setMessage({ type: 'error', text: result.error ?? 'Mã PIN không đúng.' });
    }
    // Đúng thì `pinUnlocked` đổi và ParentZoneSection tự render bảng quản lý
  }, [pin, verifyPin]);

  return (
    <Section icon="shield-checkmark-outline" title="Khu vực phụ huynh">
      <Text style={styles.label}>Mã PIN phụ huynh</Text>
      <TextInput
        value={pin}
        onChangeText={(text) => {
          setPin(text.replace(/[^0-9]/g, ''));
          setMessage(null);
        }}
        placeholder="4 chữ số"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        editable={!busy}
        onSubmitEditing={() => void submit()}
        style={styles.input}
        accessibilityLabel="Mã PIN phụ huynh"
      />
      {message && <Message message={message} />}
      <ActionButton
        label="Mở khoá"
        icon="lock-open-outline"
        busy={busy}
        onPress={() => void submit()}
        accessibilityLabel="Xác nhận mã PIN"
      />
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Huỷ nhập mã PIN"
        style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
      >
        <Text style={styles.ghostText}>Để sau</Text>
      </Pressable>
      {isApiConfigured && (
        <Text style={styles.hint}>
          Mã PIN được kiểm tra ở máy chủ nên bước này cần mạng. Đổi lại: mã không
          nằm trong bản app nên không đọc trộm hay thử vét cạn ngoại tuyến được.
        </Text>
      )}
    </Section>
  );
}

/** Bảng quản lý, chỉ render SAU KHI nhập đúng PIN */
function ParentPanel() {
  return (
    <>
      <PlaytimeConfigSection />
      <PinChangeSection />
      <ReportSection />
      <AppLockSection />
    </>
  );
}

/* ----- 3a. Cấu hình thời gian chơi game ----- */

/** Các mức hạn mức ngày cho phụ huynh chọn. `0` = không giới hạn. */
const DAILY_LIMIT_CHOICES = [0, 15, 30, 45, 60, 90, 120];

function PlaytimeConfigSection() {
  const { parentSettings, saveParentSettings, remainingTodaySeconds, dailyLimitReached } =
    usePlaytime();

  const set = (patch: Partial<ParentSettings>) =>
    saveParentSettings({ ...parentSettings, ...patch });

  const hasLimit = parentSettings.dailyLimitMinutes > 0;

  return (
    <Section icon="hourglass-outline" title="Thời gian chơi game">
      <Text style={styles.label}>Giới hạn mỗi ngày</Text>
      <View style={styles.chipRow}>
        {DAILY_LIMIT_CHOICES.map((minutes) => {
          const isActive = parentSettings.dailyLimitMinutes === minutes;
          return (
            <Pressable
              key={minutes}
              onPress={() => set({ dailyLimitMinutes: minutes })}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={
                minutes === 0 ? 'Không giới hạn mỗi ngày' : `Giới hạn ${minutes} phút mỗi ngày`
              }
              style={({ pressed }) => [
                styles.choiceChip,
                isActive && styles.choiceChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.choiceText, isActive && styles.choiceTextActive]}>
                {minutes === 0 ? 'Không giới hạn' : `${minutes} phút`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        {hasLimit
          ? dailyLimitReached
            ? 'Hôm nay đã dùng hết hạn mức — Góc Game đang khoá tới sáng mai.'
            : `Hôm nay còn ${Math.ceil(remainingTodaySeconds / 60)} phút trong hạn mức.`
          : 'Con chơi tới khi hết số phút đã tích được, không có trần theo ngày.'}
      </Text>

      <Text style={styles.label}>Phút thưởng mỗi câu đúng</Text>
      <View style={styles.chipRow}>
        {REWARD_MULTIPLIER_CHOICES.map((multiplier) => {
          const isActive = parentSettings.rewardMultiplier === multiplier;
          return (
            <Pressable
              key={multiplier}
              onPress={() => set({ rewardMultiplier: multiplier })}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Nhân phút thưởng ${multiplier} lần`}
              style={({ pressed }) => [
                styles.choiceChip,
                isActive && styles.choiceChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.choiceText, isActive && styles.choiceTextActive]}>
                ×{multiplier}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        Mỗi câu đúng vốn được 2-3 phút. Hệ số này nhân vào con số đó, làm tròn
        xuống — đặt ×0.5 thì câu 3 phút chỉ còn 1 phút.
      </Text>
    </Section>
  );
}

/* ----- 3b. Đặt / đổi mã PIN ----- */

function PinChangeSection({
  firstTime = false,
  onDone,
}: {
  /** `true` khi tài khoản chưa có PIN — lúc đó không hỏi PIN cũ */
  firstTime?: boolean;
  onDone?: () => void;
}) {
  const { changePin, session } = useAuth();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const needsOldPin = !firstTime && (session?.hasPin ?? false);

  const save = useCallback(async () => {
    Keyboard.dismiss();
    if (!/^\d{4}$/.test(newPin)) {
      setMessage({ type: 'error', text: 'Mã PIN mới phải gồm đúng 4 chữ số.' });
      return;
    }
    // Bắt nhập lại: đặt sai một số mà không ai biết thì lần sau chính phụ huynh
    // bị chặn khỏi vùng quản lý của mình.
    if (newPin !== confirmPin) {
      setMessage({ type: 'error', text: 'Hai lần nhập mã PIN mới chưa giống nhau.' });
      return;
    }

    setBusy(true);
    setMessage(null);
    const result = await changePin(oldPin, newPin);
    setBusy(false);

    if (result.ok) {
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setMessage({ type: 'ok', text: firstTime ? 'Đã đặt mã PIN.' : 'Đã đổi mã PIN.' });
      onDone?.();
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Không đổi được mã PIN.' });
    }
  }, [changePin, confirmPin, firstTime, newPin, oldPin, onDone]);

  return (
    <Section
      icon="key-outline"
      title={firstTime ? 'Thiết lập mã PIN phụ huynh' : 'Đổi mã PIN phụ huynh'}
    >
      {needsOldPin && (
        <>
          <Text style={styles.label}>Mã PIN hiện tại</Text>
          <TextInput
            value={oldPin}
            onChangeText={(t) => {
              setOldPin(t.replace(/[^0-9]/g, ''));
              setMessage(null);
            }}
            placeholder="4 chữ số"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            editable={!busy}
            style={styles.input}
            accessibilityLabel="Mã PIN hiện tại"
          />
        </>
      )}

      <Text style={styles.label}>Mã PIN mới</Text>
      <TextInput
        value={newPin}
        onChangeText={(t) => {
          setNewPin(t.replace(/[^0-9]/g, ''));
          setMessage(null);
        }}
        placeholder="4 chữ số"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        editable={!busy}
        style={styles.input}
        accessibilityLabel="Mã PIN mới"
      />

      <Text style={styles.label}>Nhập lại mã PIN mới</Text>
      <TextInput
        value={confirmPin}
        onChangeText={(t) => {
          setConfirmPin(t.replace(/[^0-9]/g, ''));
          setMessage(null);
        }}
        placeholder="4 chữ số"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        editable={!busy}
        onSubmitEditing={() => void save()}
        style={styles.input}
        accessibilityLabel="Nhập lại mã PIN mới"
      />

      {message && <Message message={message} />}
      <ActionButton
        label={firstTime ? 'Đặt mã PIN' : 'Đổi mã PIN'}
        icon="key-outline"
        busy={busy}
        onPress={() => void save()}
        accessibilityLabel="Xác nhận mã PIN"
      />
    </Section>
  );
}

/* ----- 3c. Báo cáo tiến độ ----- */

function ReportSection() {
  const { answerStats, totalPoints, masteredQuestionIds, completedWeeks, hydrated } =
    usePlaytime();

  const wrong = Math.max(0, answerStats.answered - answerStats.correct);
  const accuracy =
    answerStats.answered > 0
      ? Math.round((answerStats.correct / answerStats.answered) * 100)
      : 0;

  /**
   * Đổi khoá `"<lớp>:<môn>"` thành dòng đọc được: "Toán · Lớp 3".
   *
   * Chỉ liệt kê những khoá thật sự có tiến độ. Con có thể từng học ở lớp khác
   * (phụ huynh sửa hồ sơ), nên bảng này hiện đủ mọi lớp đã có tiến độ chứ không
   * chỉ lớp hiện tại — đó chính là thứ phụ huynh cần thấy.
   */
  const progressRows = useMemo(
    () =>
      Object.entries(completedWeeks)
        .filter(([, week]) => week > 0)
        .map(([key, week]) => {
          const separator = key.indexOf(':');
          const grade = key.slice(0, separator);
          const subject = key.slice(separator + 1);
          return { key, label: `${subject} · Lớp ${grade}`, week };
        })
        .sort((a, b) => a.label.localeCompare(b.label, 'vi')),
    [completedWeeks],
  );

  return (
    <Section icon="stats-chart-outline" title="Báo cáo học tập">
      {!hydrated ? (
        <Text style={styles.hint}>Đang đọc dữ liệu…</Text>
      ) : answerStats.answered === 0 ? (
        <Text style={styles.hint}>
          Chưa có dữ liệu. Số câu đúng/sai chỉ được ghi từ bản 1.0.8 trở đi — các
          bài con làm trước đó không được đếm nên không hiện ở đây.
        </Text>
      ) : (
        <>
          <View style={styles.statGrid}>
            <StatTile label="Đã làm" value={String(answerStats.answered)} tone="neutral" />
            <StatTile label="Đúng" value={String(answerStats.correct)} tone="ok" />
            <StatTile label="Sai" value={String(wrong)} tone="bad" />
            <StatTile label="Tỉ lệ đúng" value={`${accuracy}%`} tone="primary" />
          </View>

          {/* Thanh tỉ lệ: nhìn nhanh hơn đọc con số phần trăm */}
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${accuracy}%` }]} />
          </View>
        </>
      )}

      <Text style={styles.label}>Tiến độ theo môn</Text>
      {progressRows.length === 0 ? (
        <Text style={styles.hint}>Con chưa hoàn thành tuần nào.</Text>
      ) : (
        progressRows.map((row) => (
          <View key={row.key} style={styles.reportRow}>
            <Text style={styles.reportLabel}>{row.label}</Text>
            <Text style={styles.reportValue}>đã qua tuần {row.week}</Text>
          </View>
        ))
      )}

      <View style={styles.reportRow}>
        <Text style={styles.reportLabel}>Tổng điểm</Text>
        <Text style={styles.reportValue}>{totalPoints}</Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={styles.reportLabel}>Số câu đã chinh phục</Text>
        <Text style={styles.reportValue}>{masteredQuestionIds.length}</Text>
      </View>
    </Section>
  );
}

/* ----- 3d. Khoá ứng dụng ----- */

function AppLockSection() {
  const { appLockEnabled, setAppLockEnabled } = useAuth();

  return (
    <Section icon="lock-closed-outline" title="Khoá ứng dụng">
      <ToggleRow
        label="Hỏi mã PIN mỗi khi mở ứng dụng"
        value={appLockEnabled}
        onChange={(value) => void setAppLockEnabled(value)}
      />
      <Text style={styles.hint}>
        Bật mục này thì mỗi lần mở ứng dụng đều phải nhập PIN phụ huynh — kể cả con
        muốn vào học. Chỉ nên bật khi máy dùng chung.
      </Text>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. 🚀 Phiên bản & quản lý hệ thống                                  */
/* ------------------------------------------------------------------ */

type VersionStatus = 'checking' | 'latest' | 'outdated' | 'unknown';

function UpdateSection({ onSignedOut }: { onSignedOut: () => void }) {
  const [message, setMessage] = useState<Message | null>(null);
  const [status, setStatus] = useState<VersionStatus>('checking');
  const [found, setFound] = useState<UpdateInfo | null>(null);
  const [otaBusy, setOtaBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  /** Kiểm tra một lần khi mở màn hình, để hiện badge trạng thái */
  useEffect(() => {
    let cancelled = false;
    void checkAppUpdate().then((result) => {
      if (cancelled) return;
      if (result.status === 'update-available') setStatus('outdated');
      else if (result.status === 'up-to-date') setStatus('latest');
      else setStatus('unknown');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Kiểm tra bản CẬP NHẬT NHANH (chỉ phần JavaScript).
   *
   * Khác hẳn nút tải APK ngay dưới: bản này vài megabyte, tải xong app tự mở
   * lại; còn APK là cài lại cả ứng dụng, chỉ cần khi phần native thay đổi.
   */
  const quickUpdate = useCallback(async () => {
    setOtaBusy(true);
    setMessage(null);

    const result = await checkForInAppUpdate();
    if (result.outcome === 'unavailable') {
      setOtaBusy(false);
      setMessage({
        type: 'error',
        text: 'Cập nhật nhanh chỉ hoạt động trên bản app đã cài (APK).',
      });
      return;
    }
    if (result.outcome === 'up-to-date') {
      setOtaBusy(false);
      setMessage({ type: 'ok', text: 'Bạn đang dùng bản mới nhất!' });
      return;
    }
    if (result.outcome === 'error') {
      setOtaBusy(false);
      setMessage({
        type: 'error',
        text: result.error ?? 'Không hỏi được máy chủ cập nhật.',
      });
      return;
    }

    // Có bản mới: tải rồi mở lại app luôn. Thành công thì code dưới không chạy tới.
    const applied = await downloadAndApplyUpdate();
    setOtaBusy(false);
    if (!applied.ok) {
      setMessage({ type: 'error', text: applied.error ?? 'Cập nhật thất bại.' });
    }
  }, []);

  const check = useCallback(async () => {
    setChecking(true);
    setMessage(null);
    const result = await checkAppUpdate();
    setChecking(false);

    if (result.status === 'update-available' && result.latest) {
      setStatus('outdated');
      setFound(result.latest);
      return;
    }
    if (result.status === 'up-to-date') {
      setStatus('latest');
      setMessage({ type: 'ok', text: 'Bạn đang sử dụng phiên bản mới nhất!' });
      return;
    }
    setStatus('unknown');
    setMessage({
      type: 'error',
      text:
        result.error ??
        (result.status === 'not-configured'
          ? 'Chưa cấu hình máy chủ cập nhật.'
          : 'Không kiểm tra được bản cập nhật.'),
    });
  }, []);

  const download = useCallback(async () => {
    if (!APK_URL) {
      setMessage({
        type: 'error',
        text: 'Chưa cấu hình EXPO_PUBLIC_APK_DOWNLOAD_URL trong tệp .env.',
      });
      return;
    }
    try {
      const supported = await Linking.canOpenURL(APK_URL);
      if (!supported) {
        setMessage({ type: 'error', text: 'Thiết bị không mở được đường dẫn này.' });
        return;
      }
      await Linking.openURL(APK_URL);
    } catch {
      setMessage({ type: 'error', text: 'Không mở được trang tải về.' });
    }
  }, []);

  return (
    <Section icon="cloud-download-outline" title="Phiên bản & hệ thống">
      <View style={styles.versionRow}>
        <Text style={styles.versionLabel}>Phiên bản ứng dụng</Text>
        <Text style={styles.versionValue}>v{APP_VERSION}</Text>
      </View>

      <VersionBadge status={status} />

      {(isOtaSupported() || isDemoUpdate()) && (
        <View style={styles.versionRow}>
          <Text style={styles.versionLabel}>Bản đang chạy</Text>
          <Text style={styles.versionValue}>
            {isDemoUpdate() ? 'Bản thử (chế độ phát triển)' : runningUpdateLabel()}
          </Text>
        </View>
      )}

      {message && <Message message={message} />}

      {/* Cập nhật nhanh: chỉ tải phần mới, đặt lên trước vì gần như lúc nào cũng
          là cách nên dùng — tải APK chỉ cần khi phần native thay đổi. */}
      <ActionButton
        label={otaBusy ? 'Đang tải bản mới...' : '⚡ Cập nhật nhanh OTA'}
        icon="flash-outline"
        busy={otaBusy}
        onPress={() => void quickUpdate()}
        accessibilityLabel="Cập nhật nhanh OTA"
      />

      <ActionButton
        label={checking ? 'Đang kiểm tra...' : 'Kiểm tra bản cập nhật'}
        icon="refresh-outline"
        busy={checking}
        onPress={() => void check()}
        accessibilityLabel="Kiểm tra bản cập nhật"
      />

      <ClearCacheButton onSignedOut={onSignedOut} />

      <Pressable
        onPress={() => void download()}
        accessibilityRole="button"
        accessibilityLabel="Tải bản cập nhật APK mới nhất"
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
      >
        <Ionicons name="download-outline" size={18} color={colors.primary} />
        <Text style={styles.secondaryText}>Tải bản cập nhật APK mới nhất</Text>
      </Pressable>

      <Modal
        visible={found !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setFound(null)}
      >
        {found && (
          <UpdateModal
            info={found}
            currentVersion={APP_VERSION}
            onDismiss={() => setFound(null)}
          />
        )}
      </Modal>
    </Section>
  );
}

function VersionBadge({ status }: { status: VersionStatus }) {
  const text =
    status === 'checking'
      ? '⏳ Đang kiểm tra...'
      : status === 'latest'
        ? '🟢 Đã là bản mới nhất'
        : status === 'outdated'
          ? '🟠 Đã có bản mới hơn'
          : '⚪ Chưa kiểm tra được';

  return (
    <View
      style={[
        styles.statusBadge,
        status === 'latest' && styles.statusOk,
        status === 'outdated' && styles.statusWarn,
      ]}
    >
      <Text
        style={[
          styles.statusText,
          status === 'latest' && styles.statusTextOk,
          status === 'outdated' && styles.statusTextWarn,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

/**
 * Xoá bộ nhớ đệm cục bộ rồi đăng xuất.
 *
 * CHỈ cho bấm khi đã đồng bộ hết và có máy chủ: thứ bị xoá là ảnh chụp tiến độ
 * và hàng đợi đồng bộ, hai thứ chỉ dựng lại được từ server. Ở Local Mode hoặc
 * khi còn thay đổi chưa đẩy lên, xoá đi là mất tiến độ thật — nên nút tự chặn
 * thay vì hiện một hộp thoại "bạn có chắc không".
 *
 * Đăng xuất sau khi xoá là cố ý: state trong `PlaytimeContext` vẫn đang giữ số
 * liệu cũ trong bộ nhớ, không đăng xuất thì lần lưu kế tiếp ghi y nguyên chúng
 * trở lại và việc xoá thành vô nghĩa.
 */
function ClearCacheButton({ onSignedOut }: { onSignedOut: () => void }) {
  const { session, signOut } = useAuth();
  const { pendingChanges } = usePlaytime();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const blockedReason = !isApiConfigured
    ? 'Máy này chưa nối máy chủ đồng bộ, nên bộ nhớ đệm chính là bản duy nhất — xoá đi là mất tiến độ.'
    : pendingChanges > 0
      ? `Còn ${pendingChanges} thay đổi chưa đồng bộ. Bấm "Đồng bộ ngay" trước đã.`
      : null;

  const run = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    await clearDerivedCache(session.userId);
    await signOut();
    setBusy(false);
    onSignedOut();
  }, [onSignedOut, session, signOut]);

  return (
    <>
      <Pressable
        onPress={() => {
          if (blockedReason) {
            setMessage({ type: 'error', text: blockedReason });
            return;
          }
          void run();
        }}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Xoá bộ nhớ đệm"
        style={({ pressed }) => [
          styles.secondaryButton,
          busy && styles.disabled,
          pressed && !busy && styles.pressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Ionicons name="trash-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryText}>🗑️ Xoá bộ nhớ đệm</Text>
          </>
        )}
      </Pressable>
      {message && <Message message={message} />}
      <Text style={styles.hint}>
        Xoá dữ liệu tạm trên máy rồi đăng xuất; lần đăng nhập sau app tải lại tiến
        độ từ máy chủ. Chỉ dùng khi app hiện số liệu sai.
      </Text>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 5. 🚪 Tài khoản                                                     */
/* ------------------------------------------------------------------ */

function SignOutSection({ onClose }: { onClose: () => void }) {
  const { signOut } = useAuth();
  const { pendingChanges } = usePlaytime();
  const [busy, setBusy] = useState(false);

  const handle = useCallback(async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
    onClose();
  }, [onClose, signOut]);

  return (
    <Section icon="log-out-outline" title="Tài khoản">
      {pendingChanges > 0 && (
        <Text style={styles.warn}>
          Còn {pendingChanges} thay đổi chưa đồng bộ. Tiến độ vẫn được giữ trên máy này.
        </Text>
      )}
      <Pressable
        onPress={handle}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Đăng xuất tài khoản"
        style={({ pressed }) => [
          styles.dangerButton,
          busy && styles.disabled,
          pressed && !busy && styles.pressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.dangerText}>🚪 Đăng xuất tài khoản</Text>
          </>
        )}
      </Pressable>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Thành phần dùng lại                                                 */
/* ------------------------------------------------------------------ */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Message({ message }: { message: Message }) {
  return (
    <Text style={[styles.message, message.type === 'ok' ? styles.ok : styles.error]}>
      {message.text}
    </Text>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.switchLabel, disabled && styles.switchLabelOff]}>{label}</Text>
      <Switch
        value={value && !disabled}
        disabled={disabled}
        onValueChange={onChange}
        accessibilityLabel={label}
      />
    </View>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'ok' | 'bad' | 'primary';
}) {
  const toneStyle =
    tone === 'ok'
      ? styles.tileOk
      : tone === 'bad'
        ? styles.tileBad
        : tone === 'primary'
          ? styles.tilePrimary
          : styles.tileNeutral;

  return (
    <View style={[styles.tile, toneStyle]}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  busy,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  busy: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.primaryButton,
        busy && styles.disabled,
        pressed && !busy && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.textOnPrimary} />
      ) : (
        <>
          <Ionicons name={icon} size={18} color={colors.textOnPrimary} />
          <Text style={styles.primaryText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  headerTitle: { color: colors.textOnPrimary, fontSize: 20, fontWeight: '800' },

  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },

  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...elevation(1),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },

  // ---- Hồ sơ ----
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 38 },
  /** Đốm bút chì góc avatar: dấu hiệu duy nhất cho biết avatar bấm được */
  avatarEditDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  profileMeta: { flex: 1, gap: spacing.xs, minWidth: 0 },
  profileName: { fontSize: 18, fontWeight: '800', color: colors.text },
  usernameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  usernameText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },

  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: spacing.xs },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: touch.primary,
    backgroundColor: colors.background,
  },
  selectorText: { fontSize: 16, fontWeight: '700', color: colors.text },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: touch.min,
  },
  switchLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  switchLabelOff: { color: colors.textMuted },

  // ---- Lựa chọn dạng chip ----
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choiceChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minHeight: touch.min,
    justifyContent: 'center',
  },
  choiceChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceText: { fontSize: 14, fontWeight: '700', color: colors.text },
  choiceTextActive: { color: colors.primary },

  // ---- Báo cáo ----
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  tileNeutral: { backgroundColor: colors.background },
  tileOk: { backgroundColor: colors.successSoft },
  tileBad: { backgroundColor: colors.dangerSoft },
  tilePrimary: { backgroundColor: colors.primarySoft },
  tileValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  tileLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },

  bar: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  barFill: { height: '100%', backgroundColor: colors.success },

  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  reportLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
  reportValue: { fontSize: 14, color: colors.primary, fontWeight: '800' },

  message: { fontSize: 13, fontWeight: '700', marginTop: spacing.xs, lineHeight: 19 },
  ok: { color: colors.success },
  error: { color: colors.danger },
  warn: { fontSize: 12, color: colors.warning, fontWeight: '700', lineHeight: 18 },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    minHeight: touch.primary,
    ...elevation(1),
  },
  primaryText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '800' },
  ghostButton: {
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1.5,
    borderColor: colors.danger,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    minHeight: touch.min,
  },
  dangerText: { color: colors.danger, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.6 },

  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  versionLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
  versionValue: { fontSize: 14, color: colors.primary, fontWeight: '800' },

  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  statusOk: { backgroundColor: colors.successSoft },
  statusWarn: { backgroundColor: colors.rewardSoft },
  statusText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  statusTextOk: { color: colors.success },
  statusTextWarn: { color: '#92400E' },

  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    minHeight: touch.min,
  },
  secondaryText: { color: colors.primary, fontSize: 14, fontWeight: '800' },

  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: spacing.xs },
  pressed: { opacity: 0.78 },
});
