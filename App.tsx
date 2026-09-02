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
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppIcon from './components/AppIcon';
import Header from './components/Header';
import { BRAND_SHORT, BRAND_TAGLINE } from './constants/brand';
import { colors, elevation, radius, spacing, touch } from './constants/theme';
import { APP_VERSION } from './constants/version';
import { loadAvPrefs } from './lib/prefs';
import { checkAppUpdate, type UpdateInfo } from './lib/updateChecker';
import { checkForInAppUpdate } from './services/updateService';
import OtaUpdateModal from './screens/OtaUpdateModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PlaytimeProvider, usePlaytime } from './context/PlaytimeContext';
import AuthScreen from './screens/AuthScreen';
import PinGate from './screens/PinGate';
import SettingsScreen from './screens/SettingsScreen';
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

  /*
   * Đọc cài đặt âm thanh / rung ngay khi mở app.
   *
   * Phải làm ở đây chứ không chỉ trong màn hình Cài đặt: nếu chờ tới lúc mở Cài
   * đặt mới đọc, thì con tắt tiếng hôm qua nhưng hôm nay vào game vẫn kêu, cho
   * tới khi ai đó tình cờ mở màn hình Cài đặt. KHÔNG chặn splash chờ nó — mất
   * cài đặt âm thanh không đáng để app mở chậm hơn.
   */
  useEffect(() => {
    void loadAvPrefs();
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

    // Cập nhật trong app: kiểm ngay sau khi đăng nhập thành công
    checkForInAppUpdate().then((result) => {
      if (cancelled) return;
      if (result.outcome === 'available' || result.outcome === 'demo') setOtaReady(true);
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

  /*
   * Khoá ứng dụng: chỉ áp dụng khi phụ huynh bật trong Cài đặt.
   *
   * KHÔNG còn kèm điều kiện `session.role === 'parent'`. Từ khi đăng ký bỏ phần
   * chọn vai trò, mọi tài khoản đều là `student` — giữ điều kiện cũ thì công tắc
   * khoá ứng dụng bật lên cũng chẳng khoá gì cả. Thứ mở khoá là mã PIN.
   */
  if (appLockEnabled && !pinUnlocked) {
    return (
      <PinGate
        title="Ứng dụng đang khoá"
        description="Nhập mã PIN phụ huynh để tiếp tục."
      />
    );
  }

  return (
    <>
      <MainTabs />

      {/*
        Cập nhật trong app: hộp thoại hiện ngay sau khi đăng nhập, cho phép để
        sau. Chỉ tải phần JavaScript nên không cần cài lại APK.
      */}
      {/*
        Render CÓ ĐIỀU KIỆN thay vì chỉ đặt visible={false}: Modal của React
        Native Web không tháo nội dung ra khi visible chuyển thành false (hiệu
        ứng đóng không bao giờ kết thúc), nên bấm "Để sau" mà hộp thoại vẫn còn
        nguyên trên màn hình.
      */}
      {otaReady && !otaDismissed && (
        <Modal
          visible
          animationType="fade"
          transparent
          onRequestClose={() => setOtaDismissed(true)}
        >
          <OtaUpdateModal onDismiss={() => setOtaDismissed(true)} />
        </Modal>
      )}

      {/* Cập nhật phải tải lại APK: hiện một lần, cho phép để sau */}
      {update !== null && !dismissed && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setDismissed(true)}
        >
          <UpdateModal
            info={update}
            currentVersion={APP_VERSION}
            onDismiss={() => setDismissed(true)}
          />
        </Modal>
      )}
    </>
  );
}

function MainTabs() {
  const { availableMinutes } = usePlaytime();
  const [showSettings, setShowSettings] = useState(false);

  // KHÔNG chặn ở đây nữa: dữ liệu Local đọc xong sau vài ms, còn các màn hình
  // tự hiện "…" ở chỗ số liệu khi chưa nạp xong. Nhờ vậy UI hiện ngay lập tức.
  return (
    <View style={styles.root}>
      <Header onOpenSettings={() => setShowSettings(true)} />

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
        <SettingsScreen onClose={() => setShowSettings(false)} />
      </Modal>
    </View>
  );
}

/**
 * Tab Cài đặt. Dùng lại chính màn hình Cài đặt; `onClose` đưa học sinh về tab
 * Học Tập thay vì đóng modal.
 *
 * KHÔNG còn bọc cổng PIN quanh cả màn hình: mục hồ sơ và âm thanh là của con,
 * chỉ khu vực quản lý bên trong mới hỏi mã PIN.
 */
function SettingsTab() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  // Tab này nằm dưới thanh header cố định nên truyền embedded để khỏi chừa tai thỏ lần hai
  return <SettingsScreen embedded onClose={() => navigation.navigate('HocTap')} />;
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

  // Style của thanh header đã chuyển sang `components/Header.tsx` cùng component

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
