// src/navigation/index.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { Colors } from '../utils/theme';
import { LoadingScreen } from '../components/UI';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';

// Student
import StudentHomeScreen     from '../screens/student/StudentHomeScreen';
import StudentCalendarScreen from '../screens/student/StudentCalendarScreen';
import StudentProfileScreen  from '../screens/student/StudentProfileScreen';
import MarkAttendanceScreen  from '../screens/student/MarkAttendanceScreen';

// Faculty
import FacultySessionScreen   from '../screens/faculty/FacultySessionScreen';
import FacultyAnalyticsScreen from '../screens/faculty/FacultyAnalyticsScreen';
import FacultyProfileScreen   from '../screens/faculty/FacultyProfileScreen';

// Admin
import AdminOverviewScreen   from '../screens/admin/AdminOverviewScreen';
import AdminStudentsScreen   from '../screens/admin/AdminStudentsScreen';
import AdminFacultyScreen    from '../screens/admin/AdminFacultyScreen';
import AdminDevicesScreen    from '../screens/admin/AdminDevicesScreen';
import AdminDisputesScreen   from '../screens/admin/AdminDisputesScreen';
import AdminLogsScreen       from '../screens/admin/AdminLogsScreen';
import AdminFaceModelScreen  from '../screens/admin/AdminFaceModelScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ── Shared tab bar style ───────────────────────────────────────────────────────
const tabBarStyle = {
  backgroundColor: Colors.deep,
  borderTopColor:  Colors.border,
  borderTopWidth:  1,
  height:          72,
  paddingBottom:   12,
  paddingTop:      8,
};

const tabIcon = (name, focused, color) => (
  <Ionicons name={focused ? name : `${name}-outline`} size={22} color={color} />
);

const tabLabelStyle = {
  fontFamily:    'monospace',
  fontSize:      9,
  letterSpacing: 0.5,
  marginTop:     2,
};

// ── Student Tabs ───────────────────────────────────────────────────────────────
function StudentTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:           false,
        tabBarStyle,
        tabBarActiveTintColor:   Colors.green,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle:        tabLabelStyle,
      }}
    >
      <Tab.Screen
        name="Home"
        component={StudentHomeScreen}
        options={{
          tabBarLabel: 'OVERVIEW',
          tabBarIcon: ({ focused, color }) => tabIcon('home', focused, color),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={StudentCalendarScreen}
        options={{
          tabBarLabel: 'CALENDAR',
          tabBarIcon: ({ focused, color }) => tabIcon('calendar', focused, color),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={StudentProfileScreen}
        options={{
          tabBarLabel: 'PROFILE',
          tabBarIcon: ({ focused, color }) => tabIcon('person', focused, color),
        }}
      />
    </Tab.Navigator>
  );
}

// ── Student Root Stack (wraps tabs + MarkAttendance modal) ────────────────────
function StudentRoot() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StudentTabs"    component={StudentTabs} />
      <Stack.Screen name="MarkAttendance" component={MarkAttendanceScreen} />
    </Stack.Navigator>
  );
}

// ── Faculty Tabs ───────────────────────────────────────────────────────────────
function FacultyRoot() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:           false,
        tabBarStyle,
        tabBarActiveTintColor:   Colors.cyan,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle:        tabLabelStyle,
      }}
    >
      <Tab.Screen
        name="Session"
        component={FacultySessionScreen}
        options={{
          tabBarLabel: 'SESSION',
          tabBarIcon: ({ focused, color }) => tabIcon('radio', focused, color),
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={FacultyAnalyticsScreen}
        options={{
          tabBarLabel: 'ANALYTICS',
          tabBarIcon: ({ focused, color }) => tabIcon('bar-chart', focused, color),
        }}
      />
      <Tab.Screen
        name="FacultyProfile"
        component={FacultyProfileScreen}
        options={{
          tabBarLabel: 'PROFILE',
          tabBarIcon: ({ focused, color }) => tabIcon('person', focused, color),
        }}
      />
    </Tab.Navigator>
  );
}

// ── Admin Tabs (7 tabs — includes FaceModel) ───────────────────────────────────
function AdminRoot() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:           false,
        tabBarStyle:           { ...tabBarStyle, height: 76 },
        tabBarActiveTintColor:   Colors.red,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle:        { ...tabLabelStyle, fontSize: 7.5 },
      }}
    >
      <Tab.Screen
        name="Overview"
        component={AdminOverviewScreen}
        options={{
          tabBarLabel: 'OVERVIEW',
          tabBarIcon: ({ focused, color }) => tabIcon('grid', focused, color),
        }}
      />
      <Tab.Screen
        name="Students"
        component={AdminStudentsScreen}
        options={{
          tabBarLabel: 'STUDENTS',
          tabBarIcon: ({ focused, color }) => tabIcon('people', focused, color),
        }}
      />
      <Tab.Screen
        name="Faculty"
        component={AdminFacultyScreen}
        options={{
          tabBarLabel: 'FACULTY',
          tabBarIcon: ({ focused, color }) => tabIcon('person-circle', focused, color),
        }}
      />
      <Tab.Screen
        name="Devices"
        component={AdminDevicesScreen}
        options={{
          tabBarLabel: 'DEVICES',
          tabBarIcon: ({ focused, color }) => tabIcon('phone-portrait', focused, color),
        }}
      />
      <Tab.Screen
        name="Disputes"
        component={AdminDisputesScreen}
        options={{
          tabBarLabel: 'DISPUTES',
          tabBarIcon: ({ focused, color }) => tabIcon('document-text', focused, color),
        }}
      />
      <Tab.Screen
        name="Logs"
        component={AdminLogsScreen}
        options={{
          tabBarLabel: 'LOGS',
          tabBarIcon: ({ focused, color }) => tabIcon('list', focused, color),
        }}
      />
      <Tab.Screen
        name="FaceModel"
        component={AdminFaceModelScreen}
        options={{
          tabBarLabel: 'AI MODEL',
          tabBarIcon: ({ focused, color }) => tabIcon('hardware-chip', focused, color),
        }}
      />
    </Tab.Navigator>
  );
}

// ── Auth Stack ─────────────────────────────────────────────────────────────────
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

// ── Root Navigator ─────────────────────────────────────────────────────────────
export default function RootNavigator() {
  const { token, role, loading } = useAuth();

  if (loading) return <LoadingScreen message="LOADING..." />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!token ? (
          <Stack.Screen name="Auth"        component={AuthStack}   />
        ) : role === 'faculty' ? (
          <Stack.Screen name="FacultyRoot" component={FacultyRoot} />
        ) : role === 'admin' ? (
          <Stack.Screen name="AdminRoot"   component={AdminRoot}   />
        ) : (
          <Stack.Screen name="StudentRoot" component={StudentRoot} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({});
