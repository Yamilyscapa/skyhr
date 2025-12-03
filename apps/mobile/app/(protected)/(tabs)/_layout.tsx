import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].primary,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="home" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="announcements/index"
        options={{
          title: 'Avisos',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="notifications" size={28} color={color} />,
          tabBarLabel: 'Avisos',
        }}
      />
      <Tabs.Screen
        name="permissions/index"
        options={{
          title: 'Permisos',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={28} color={color} />,
          tabBarLabel: 'Permisos',
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Ajustes',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="visitors/index"
        options={{
          title: 'Visitantes',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="people" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}
