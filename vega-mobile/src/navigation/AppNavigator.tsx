import React from "react";
import { useColorScheme, Text, View } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSelector } from "react-redux";
import { RootState } from "../store";

// Screens
import LoginScreen from "../screens/LoginScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { JobsScreen } from "../screens/JobsScreen";
import { ApplicationTrackerScreen } from "../screens/ApplicationTrackerScreen";
import { InterviewScreen } from "../screens/InterviewScreen";
import { InterviewReportScreen } from "../screens/InterviewReportScreen";
import { AssessmentCenterScreen } from "../screens/AssessmentCenterScreen";
import { CodingArenaScreen } from "../screens/CodingArenaScreen";
import { ResumeBuilderScreen } from "../screens/ResumeBuilderScreen";
import { CommunityScreen } from "../screens/CommunityScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { RecruiterDashboardScreen } from "../screens/RecruiterDashboardScreen";
import { RecruiterCandidatesScreen } from "../screens/RecruiterCandidatesScreen";
import { RecruiterJobsScreen } from "../screens/RecruiterJobsScreen";
import { TpoDashboardScreen } from "../screens/TpoDashboardScreen";
import { AdminDashboardScreen } from "../screens/AdminDashboardScreen";

export type RootStackParamList = {
  Auth: undefined;
  StudentApp: undefined;
  RecruiterApp: undefined;
  TpoApp: undefined;
  AdminApp: undefined;
  InterviewReport: { interviewId?: number };
  ApplicationTracker: undefined;
  CodingArena: undefined;
  ResumeBuilder: undefined;
  AssessmentCenter: undefined;
  Community: undefined;
  Settings: undefined;
};

export type StudentTabParamList = {
  TalentHub: undefined;
  Opportunities: undefined;
  AIInterview: undefined;
  PracticeZone: undefined;
  Account: undefined;
};

export type RecruiterTabParamList = {
  Overview: undefined;
  TalentSearch: undefined;
  JobRequisitions: undefined;
  Settings: undefined;
};

export type TpoTabParamList = {
  PlacementDrives: undefined;
  StudentProfiles: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const StudentTab = createBottomTabNavigator<StudentTabParamList>();
const RecruiterTab = createBottomTabNavigator<RecruiterTabParamList>();
const TpoTab = createBottomTabNavigator<TpoTabParamList>();

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.6 }}>{icon}</Text>
    </View>
  );
}

// Student Bottom Tabs
function StudentTabs() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  return (
    <StudentTab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: isDark ? "#0c1224" : "#ffffff",
          borderBottomWidth: 1,
          borderBottomColor: isDark ? "#1e293b" : "#e2e8f0",
        },
        headerTitleStyle: {
          fontSize: 16,
          fontWeight: "800",
          color: isDark ? "#f1f5f9" : "#0f172a",
        },
        tabBarStyle: {
          backgroundColor: isDark ? "#070b19" : "#ffffff",
          borderTopColor: isDark ? "#1e293b" : "#e2e8f0",
          borderTopWidth: 1.5,
          height: 62,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: "#6366f1",
        tabBarInactiveTintColor: "#64748b",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "800",
        },
      }}
    >
      <StudentTab.Screen
        name="TalentHub"
        component={DashboardScreen}
        options={{
          title: "Talent Hub",
          tabBarIcon: ({ focused }) => <TabIcon icon="⚡" focused={focused} />,
        }}
      />
      <StudentTab.Screen
        name="Opportunities"
        component={JobsScreen}
        options={{
          title: "Job Board",
          tabBarIcon: ({ focused }) => <TabIcon icon="💼" focused={focused} />,
        }}
      />
      <StudentTab.Screen
        name="AIInterview"
        component={InterviewScreen}
        options={{
          title: "AI Interview",
          tabBarIcon: ({ focused }) => <TabIcon icon="🎙️" focused={focused} />,
        }}
      />
      <StudentTab.Screen
        name="PracticeZone"
        component={AssessmentCenterScreen}
        options={{
          title: "Assessments",
          tabBarIcon: ({ focused }) => <TabIcon icon="🎯" focused={focused} />,
        }}
      />
      <StudentTab.Screen
        name="Account"
        component={ProfileScreen}
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />,
        }}
      />
    </StudentTab.Navigator>
  );
}

// Recruiter Bottom Tabs
function RecruiterTabs() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  return (
    <RecruiterTab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: isDark ? "#0c1224" : "#ffffff",
          borderBottomWidth: 1,
          borderBottomColor: isDark ? "#1e293b" : "#e2e8f0",
        },
        headerTitleStyle: {
          fontSize: 16,
          fontWeight: "800",
          color: isDark ? "#f1f5f9" : "#0f172a",
        },
        tabBarStyle: {
          backgroundColor: isDark ? "#070b19" : "#ffffff",
          borderTopColor: isDark ? "#1e293b" : "#e2e8f0",
          borderTopWidth: 1.5,
          height: 62,
        },
        tabBarActiveTintColor: "#10b981",
        tabBarInactiveTintColor: "#64748b",
      }}
    >
      <RecruiterTab.Screen
        name="Overview"
        component={RecruiterDashboardScreen}
        options={{
          title: "Pipeline",
          tabBarIcon: ({ focused }) => <TabIcon icon="📊" focused={focused} />,
        }}
      />
      <RecruiterTab.Screen
        name="TalentSearch"
        component={RecruiterCandidatesScreen}
        options={{
          title: "Candidates",
          tabBarIcon: ({ focused }) => <TabIcon icon="🔍" focused={focused} />,
        }}
      />
      <RecruiterTab.Screen
        name="JobRequisitions"
        component={RecruiterJobsScreen}
        options={{
          title: "Openings",
          tabBarIcon: ({ focused }) => <TabIcon icon="📄" focused={focused} />,
        }}
      />
      <RecruiterTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "Preferences",
          tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} />,
        }}
      />
    </RecruiterTab.Navigator>
  );
}

// TPO Bottom Tabs
function TpoTabs() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  return (
    <TpoTab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: isDark ? "#0c1224" : "#ffffff",
          borderBottomWidth: 1,
          borderBottomColor: isDark ? "#1e293b" : "#e2e8f0",
        },
        headerTitleStyle: {
          fontSize: 16,
          fontWeight: "800",
          color: isDark ? "#f1f5f9" : "#0f172a",
        },
        tabBarStyle: {
          backgroundColor: isDark ? "#070b19" : "#ffffff",
          borderTopColor: isDark ? "#1e293b" : "#e2e8f0",
          borderTopWidth: 1.5,
          height: 62,
        },
        tabBarActiveTintColor: "#6366f1",
      }}
    >
      <TpoTab.Screen
        name="PlacementDrives"
        component={TpoDashboardScreen}
        options={{
          title: "Drives",
          tabBarIcon: ({ focused }) => <TabIcon icon="🏢" focused={focused} />,
        }}
      />
      <TpoTab.Screen
        name="StudentProfiles"
        component={RecruiterCandidatesScreen}
        options={{
          title: "Students",
          tabBarIcon: ({ focused }) => <TabIcon icon="🎓" focused={focused} />,
        }}
      />
      <TpoTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "Preferences",
          tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} />,
        }}
      />
    </TpoTab.Navigator>
  );
}

export function AppNavigator() {
  const scheme = useColorScheme();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: "#070b19",
      card: "#0c1224",
      text: "#f1f5f9",
      border: "#1e293b",
      primary: "#6366f1",
    },
  };

  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: "#faf9f6",
      card: "#ffffff",
      text: "#1e293b",
      border: "#e2e8f0",
      primary: "#4f46e5",
    },
  };

  return (
    <NavigationContainer theme={scheme === "dark" ? customDarkTheme : customLightTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={LoginScreen} />
        ) : (
          <>
            {user?.role === "STUDENT" && (
              <>
                <Stack.Screen name="StudentApp" component={StudentTabs} />
                <Stack.Screen name="InterviewReport" component={InterviewReportScreen} options={{ headerShown: true, title: "Diagnostic Report" }} />
                <Stack.Screen name="ApplicationTracker" component={ApplicationTrackerScreen} options={{ headerShown: true, title: "Live Pipeline" }} />
                <Stack.Screen name="CodingArena" component={CodingArenaScreen} options={{ headerShown: true, title: "Coding Arena" }} />
                <Stack.Screen name="ResumeBuilder" component={ResumeBuilderScreen} options={{ headerShown: true, title: "ATS Optimizer" }} />
                <Stack.Screen name="Community" component={CommunityScreen} options={{ headerShown: true, title: "Campus Community" }} />
                <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: "Settings" }} />
              </>
            )}
            {user?.role === "COMPANY" && (
              <>
                <Stack.Screen name="RecruiterApp" component={RecruiterTabs} />
                <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: "Settings" }} />
              </>
            )}
            {user?.role === "TPO" && (
              <>
                <Stack.Screen name="TpoApp" component={TpoTabs} />
                <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: "Settings" }} />
              </>
            )}
            {user?.role === "ADMIN" && (
              <>
                <Stack.Screen name="AdminApp" component={AdminDashboardScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: "Settings" }} />
              </>
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
