import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors, radius, spacing } from './constants/theme';
import { AuthProvider } from './context/AuthContext';
import { PlaytimeProvider, usePlaytime } from './context/PlaytimeContext';
import GameVaultScreen from './screens/GameVaultScreen';
import QuizScreen from './screens/QuizScreen';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      {/* AuthProvider phải bọc ngoài: PlaytimeProvider dùng session để đồng bộ. */}
      <AuthProvider>
        <PlaytimeProvider>
          <StatusBar style="light" />
          <AppContent />
        </PlaytimeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/**
 * Chờ đọc xong tiến độ từ AsyncStorage trước khi vẽ các tab,
 * tránh việc số phút chơi game "nhảy" từ 0 lên giá trị thật.
 */
function AppContent() {
  const { hydrated, availableMinutes } = usePlaytime();

  if (!hydrated) {
    return <LoadingScreen />;
  }

  return (
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
            // Hiển thị số phút chơi game còn lại ngay trên thanh tab
            tabBarBadge: availableMinutes > 0 ? availableMinutes : undefined,
            tabBarBadgeStyle: styles.tabBarBadge,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingEmoji}>📚🎮</Text>
      <Text style={styles.loadingTitle}>Học tập & Góc Game Lớp 3</Text>
      <ActivityIndicator color={colors.primary} style={styles.loadingSpinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.sm,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  tabBarItem: { paddingVertical: spacing.xs },
  tabBarLabel: { fontSize: 12, fontWeight: '700' },
  tabBarBadge: {
    backgroundColor: colors.success,
    color: colors.textOnPrimary,
    fontSize: 11,
    fontWeight: '800',
    borderRadius: radius.pill,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingEmoji: { fontSize: 44 },
  loadingTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  loadingSpinner: { marginTop: spacing.sm },
});
