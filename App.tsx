import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import AppIcon from './components/AppIcon';
import { BRAND_SHORT, BRAND_TAGLINE } from './constants/brand';
import { colors, elevation, radius, spacing, touch } from './constants/theme';
import { APP_VERSION } from './constants/version';
import { checkAppUpdate, type UpdateInfo } from './lib/updateChecker';
import { checkOta, downloadAndApplyOta } from './lib/otaUpdates';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PlaytimeProvider, usePlaytime } from './context/PlaytimeContext';
import AuthScreen from './screens/AuthScreen';
import PinGate from './screens/PinGate';
import { SettingsWithPinGate } from './screens/SettingsScreen';
import UpdateModal from './screens/UpdateModal';
import GameVaultScreen from './screens/GameVaultScreen';
import QuizScreen from './screens/QuizScreen';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

/**
 * Ảnh cần nạp sẵn vào cache.
 *
 * Ghi chú thật: phần gamification của app hiện dùng emoji và View thuần, không
 * có ảnh hay âm thanh khen thưởng. Nên việc preload ở đây chủ yếu là **font
 * icon Ionicons** — nếu không nạp trước, lần đầu mở app các icon tab sẽ hiện
 * ô vuông trống rồi mới nhảy thành icon.
 */
const IMAGE_ASSETS = [
  require('./assets/icon.png'),
  require('./assets/favicon.png'),
];

/** Quá thời gian này thì vào app luôn, không chờ asset nữa */
const PRELOAD_TIMEOUT_MS = 2000;

/**
 * Nạp trước font icon và ảnh.
 *
 * QUAN TRỌNG: hàm này KHÔNG BAO GIỜ được phép treo. Trên web, `Asset.loadAsync`
 * và `Font.loadAsync` đi qua mạng, nên khi mất mạng chúng có thể không bao giờ
 * kết thúc — nếu chặn UI chờ nó thì app đứng ở màn splash vĩnh viễn. Vì vậy vừa
 * bắt lỗi vừa đặt hạn thời gian; hết hạn là vào app, icon nạp sau cũng được.
 */
async function preloadAssets(): Promise<void> {
  // try/catch bọc cả phần tạo Promise: nếu môi trường thiếu `fetch` thì
  // loadAsync có thể ném lỗi đồng bộ, lúc đó Promise.all chưa kịp hình thành.
  try {
    await preloadWithTimeout();
  } catch (error) {
    console.warn('[preload] Bỏ qua preload:', error);
  }
}

async function preloadWithTimeout(): Promise<void> {
  const work = Promise.all([
    Font.loadAsync(Ionicons.font).catch((error) =>
      console.warn('[preload] Không nạp được font icon:', error),
    ),
    Asset.loadAsync(IMAGE_ASSETS).catch((error) =>
      console.warn('[preload] Không nạp được ảnh:', error),
    ),
  ]);

  const timeout = new Promise<void>((resolve) => {
    setTimeout(resolve, PRELOAD_TIMEOUT_MS);
  });

  await Promise.race([work.then(() => undefined), timeout]);
}

export default function App() {
  const [assetsReady, setAssetsReady] = useState(false);

  // Nạp asset song song với việc đọc phiên đăng nhập, không nối tiếp
  useEffect(() => {
    let cancelled = false;
    preloadAssets().finally(() => {
      if (!cancelled) setAssetsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaProvider>
      {/* AuthProvider bọc ngoài: PlaytimeProvider cần user_id để cách ly dữ liệu */}
      <AuthProvider>
        <PlaytimeProvider>
          <StatusBar style="light" />
          <RootRouter assetsReady={assetsReady} />
        </PlaytimeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/** Chưa đăng nhập thì hiện AuthScreen, đã đăng nhập thì hiện Bottom Tabs */
function RootRouter({ assetsReady }: { assetsReady: boolean }) {
  const { initializing, session, appLockEnabled, pinUnlocked } = useAuth();

  /**
   * Tự kiểm tra bản mới ngay khi có phiên đăng nhập — bao gồm cả lần đăng nhập
   * mới lẫn lần mở app đã có sẵn session.
   */
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  /** Có bản cập nhật ngầm (chỉ tải phần JavaScript mới) đang chờ không */
  const [otaReady, setOtaReady] = useState(false);
  const [otaDismissed, setOtaDismissed] = useState(false);

  useEffect(() => {
    if (!session) {
      setUpdate(null);
      setDismissed(false);
      setOtaReady(false);
      setOtaDismissed(false);
      return;
    }

    let cancelled = false;
    // Không await ở chỗ render: kiểm tra chạy ngầm, hỏng cũng không chặn app
    checkAppUpdate().then((result) => {
      if (!cancelled && result.status === 'update-available' && result.latest) {
        setUpdate(result.latest);
      }
    });

    // Cập nhật ngầm: nhẹ hơn nhiều nên chỉ hiện một dải thông báo, không chặn app
    checkOta().then((result) => {
      if (!cancelled && result.status === 'available') setOtaReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (initializing || !assetsReady) {
    return <SplashScreen label="Đang mở ứng dụng..." />;
  }
  if (!session) return <AuthScreen />;

  // Cập nhật bắt buộc: chặn hẳn, không cho vào app
  if (update?.forceUpdate) {
    return <UpdateModal info={update} currentVersion={APP_VERSION} />;
  }

  // Khoá ứng dụng: chỉ áp dụng khi phụ huynh bật, và chỉ họ mở được
  if (appLockEnabled && session.role === 'parent' && !pinUnlocked) {
    return (
      <PinGate
        title="Ứng dụng đang khoá"
        description="Nhập mã PIN phụ huynh để tiếp tục."
      />
    );
  }

  return (
    <>
      <MainTabs
        otaBanner={
          otaReady && !otaDismissed ? (
            <OtaBanner onDismiss={() => setOtaDismissed(true)} />
          ) : null
        }
      />

      {/* Cập nhật không bắt buộc: hiện một lần, cho phép để sau */}
      <Modal
        visible={update !== null && !dismissed}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setDismissed(true)}
      >
        {update && (
          <UpdateModal
            info={update}
            currentVersion={APP_VERSION}
            onDismiss={() => setDismissed(true)}
          />
        )}
      </Modal>
    </>
  );
}

/**
 * Dải thông báo cập nhật ngầm.
 *
 * Cố ý KHÔNG dùng modal chặn màn hình như bản cập nhật APK: bản này chỉ tải mấy
 * megabyte JavaScript rồi mở lại app, không có gì phải hỏi long trọng. Học sinh
 * đang làm dở bài thì bấm "Để sau" là xong.
 */
function OtaBanner({ onDismiss }: { onDismiss: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await downloadAndApplyOta();
    // Thành công thì app tự khởi động lại, code phía dưới không chạy tới
    if (result.status === 'error') {
      setError(result.error ?? 'Cập nhật thất bại, thử lại sau nhé!');
      setBusy(false);
    } else if (result.status !== 'downloaded') {
      onDismiss();
    }
  }, [onDismiss]);

  return (
    <View style={styles.otaBanner}>
      <Text style={styles.otaEmoji}>⚡</Text>
      <View style={styles.otaTextGroup}>
        <Text style={styles.otaTitle}>
          {busy ? 'Đang tải bản cập nhật...' : 'Có bản cập nhật nhanh!'}
        </Text>
        <Text style={styles.otaText}>
          {error ??
            (busy
              ? 'Xong là app tự mở lại, em đợi một chút nhé.'
              : 'Chỉ tải phần mới, không phải cài lại app.')}
        </Text>
      </View>

      {!busy && (
        <>
          <Pressable
            onPress={() => void apply()}
            accessibilityRole="button"
            accessibilityLabel="Cập nhật ngay"
            style={({ pressed }) => [styles.otaButton, pressed && styles.pressed]}
          >
            <Text style={styles.otaButtonText}>Cập nhật</Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Để sau"
            style={({ pressed }) => [styles.otaLater, pressed && styles.pressed]}
          >
            <Text style={styles.otaLaterText}>Để sau</Text>
          </Pressable>
        </>
      )}
      {busy && <ActivityIndicator color={colors.textOnPrimary} />}
    </View>
  );
}

function MainTabs({ otaBanner }: { otaBanner?: React.ReactNode }) {
  const { availableMinutes } = usePlaytime();
  const [showSettings, setShowSettings] = useState(false);

  // KHÔNG chặn ở đây nữa: dữ liệu Local đọc xong sau vài ms, còn các màn hình
  // tự hiện "…" ở chỗ số liệu khi chưa nạp xong. Nhờ vậy UI hiện ngay lập tức.
  return (
    <View style={styles.root}>
      <AccountBar onOpenSettings={() => setShowSettings(true)} />
      {otaBanner}

      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="HocTap"
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: styles.tabBar,
            tabBarLabelStyle: styles.tabBarLabel,
            tabBarItemStyle: styles.tabBarItem,
          }}
        >
          <Tab.Screen
            name="HocTap"
            component={QuizScreen}
            options={{
              title: 'Học Tập',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="school" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="GocGame"
            component={GameVaultScreen}
            options={{
              title: 'Góc Game',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="game-controller" size={size} color={color} />
              ),
              tabBarBadge: availableMinutes > 0 ? availableMinutes : undefined,
              tabBarBadgeStyle: styles.tabBarBadge,
            }}
          />
          <Tab.Screen
            name="CaiDat"
            component={SettingsTab}
            options={{
              title: 'Cài Đặt',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="settings" size={size} color={color} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>

      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowSettings(false)}
      >
        <SettingsWithPinGate onClose={() => setShowSettings(false)} />
      </Modal>
    </View>
  );
}

/**
 * Tab Cài đặt. Dùng lại chính màn hình Cài đặt (kèm cổng PIN cho phụ huynh);
 * `onClose` đưa học sinh về tab Học Tập thay vì đóng modal.
 */
function SettingsTab() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  // Tab này nằm dưới thanh header cố định nên truyền embedded để khỏi chừa tai thỏ lần hai
  return (
    <SettingsWithPinGate embedded onClose={() => navigation.navigate('HocTap')} />
  );
}

/**
 * Thanh trên cùng, gói gọn trong MỘT hàng: bên trái là tài khoản (avatar, tên,
 * vai trò), bên phải là hai chỉ số (điểm, phút chơi game) và nút Cài đặt.
 *
 * Không còn dòng lời chào riêng: nó chiếm gần hai dòng chữ mà không mang thêm
 * thông tin nào so với việc hiện thẳng tên tài khoản.
 */
function AccountBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const { syncState, availableMinutes, totalPoints, hydrated } = usePlaytime();

  if (!session) return null;

  const isParent = session.role === 'parent';
  /** Máy hẹp thì bỏ chữ "điểm"/"phút" trong chip để một hàng vẫn vừa */
  const compact = width < 380;

  const syncColor =
    syncState === 'synced'
      ? colors.success
      : syncState === 'error'
        ? colors.danger
        : syncState === 'syncing'
          ? colors.warning
          : 'rgba(255,255,255,0.45)';

  return (
    <View style={[styles.accountBar, { paddingTop: insets.top + spacing.sm }]}>
      {/* Logo thương hiệu, kèm đốm nhỏ báo trạng thái đồng bộ */}
      <View style={styles.logoWrap}>
        <AppIcon size={34} withBadge={false} />
        <View style={[styles.syncDot, { backgroundColor: syncColor }]} />
      </View>

      <View style={styles.accountTextGroup}>
        <Text style={styles.brandName} numberOfLines={1}>
          {BRAND_SHORT}
        </Text>
        <View style={styles.accountRow}>
          <Text style={styles.accountName} numberOfLines={1}>
            {session.username}
          </Text>
          <Text style={[styles.roleBadge, isParent && styles.roleBadgeParent]}>
            {isParent ? '👨‍👩‍👧 Phụ huynh' : '🧑‍🎓 Học sinh'}
          </Text>
        </View>
      </View>

      {/* Điểm tích luỹ */}
      <View style={[styles.statChip, styles.statChipPoints]}>
        <Text style={styles.statEmoji}>⭐</Text>
        <Text style={styles.statValue}>{hydrated ? totalPoints : '…'}</Text>
        {compact ? null : <Text style={styles.statUnit}>điểm</Text>}
      </View>

      {/* Phút chơi game còn lại */}
      <View style={[styles.statChip, styles.statChipMinutes]}>
        <Text style={styles.statEmoji}>⏱️</Text>
        <Text style={styles.statValue}>{hydrated ? availableMinutes : '…'}</Text>
        {compact ? null : <Text style={styles.statUnit}>phút</Text>}
      </View>

      <Pressable
        onPress={onOpenSettings}
        accessibilityRole="button"
        accessibilityLabel="Mở cài đặt"
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Ionicons name="settings-outline" size={18} color={colors.textOnPrimary} />
      </Pressable>
    </View>
  );
}

function SplashScreen({ label }: { label: string }) {
  return (
    <View style={styles.splash}>
      <AppIcon size={104} />
      <Text style={styles.splashTitle}>{BRAND_SHORT}</Text>
      <Text style={styles.splashSubtitle}>{BRAND_TAGLINE}</Text>
      <ActivityIndicator color={colors.primary} style={styles.splashSpinner} />
      <Text style={styles.splashLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // ---- Header cố định ----
  accountBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    ...elevation(2),
  },
  logoWrap: { width: 34, height: 34 },
  /** Đốm báo đồng bộ nằm ở góc avatar để không chiếm thêm chỗ trên hàng */
  syncDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },

  accountTextGroup: { flex: 1, gap: 1, minWidth: 0 },
  brandName: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  accountName: { color: '#C7D2FE', fontSize: 11, fontWeight: '700', flexShrink: 1 },

  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  statChipPoints: { backgroundColor: 'rgba(255,255,255,0.22)' },
  statChipMinutes: { backgroundColor: colors.reward },
  statEmoji: { fontSize: 12 },
  statValue: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '800' },
  statUnit: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '700' },

  roleBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primaryDark,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  roleBadgeParent: { backgroundColor: '#FDE68A', color: '#92400E' },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  /** Dải thông báo cập nhật ngầm, nằm ngay dưới thanh header */
  otaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  otaEmoji: { fontSize: 20 },
  otaTextGroup: { flex: 1, minWidth: 0 },
  otaTitle: { fontSize: 13, fontWeight: '800', color: colors.textOnPrimary },
  otaText: { fontSize: 11, color: '#C7D2FE' },
  otaButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.reward,
  },
  otaButtonText: { fontSize: 12, fontWeight: '800', color: colors.textOnPrimary },
  otaLater: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm },
  otaLaterText: { fontSize: 11, fontWeight: '700', color: '#C7D2FE' },

  /**
   * Thanh điều hướng nổi, nền bán trong suốt kiểu kính mờ.
   * Dùng màu bán trong suốt + bóng đổ thay vì blur thật: blur cần thêm
   * `expo-blur` (native module), mà hiệu quả thị giác gần như tương đương.
   */
  tabBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    height: 68,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.glass,
    borderRadius: radius.xl,
    borderTopWidth: 0,
    ...elevation(3),
  },
  tabBarItem: { paddingVertical: spacing.xs },
  tabBarLabel: { fontSize: 11, fontWeight: '800' },
  tabBarBadge: {
    backgroundColor: colors.success,
    color: colors.textOnPrimary,
    fontSize: 11,
    fontWeight: '800',
    borderRadius: radius.pill,
  },

  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  splashTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  splashSubtitle: { fontSize: 13, color: colors.textMuted },
  splashSpinner: { marginTop: spacing.sm },
  splashLabel: { fontSize: 13, color: colors.textMuted },

  pressed: { opacity: 0.75 },
});
