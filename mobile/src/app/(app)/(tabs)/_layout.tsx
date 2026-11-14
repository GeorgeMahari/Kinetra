import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { TabIcon } from '@/components/TabIcon';
import { useTheme } from '@/theme/ThemeProvider';

export const unstable_settings = { anchor: 'today' };

/** Tabs appear only when they hold working features (no "coming soon" tabs). */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.brandText,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontFamily: 'Geologica_600SemiBold' },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: t('tabs.today'),
          tabBarButtonTestID: 'tab-today',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="today" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: t('plan.tab'),
          tabBarButtonTestID: 'tab-plan',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="trail" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="assess"
        options={{
          title: t('assess.tab'),
          tabBarButtonTestID: 'tab-assess',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="cardio" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t('progress.tab'),
          tabBarButtonTestID: 'tab-progress',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="endurance" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarButtonTestID: 'tab-profile',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="profile" color={color} size={size} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
