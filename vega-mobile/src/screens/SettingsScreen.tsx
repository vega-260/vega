import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  useColorScheme,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RootState, logout, toggleLanguage, setNetworkStatus } from "../store";
import { syncOfflineQueue } from "../services/api";
import { Badge } from "../components/Badge";

export function SettingsScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const dispatch = useDispatch();

  const { biometricsEnabled, user } = useSelector((state: RootState) => state.auth);
  const { language, isOffline } = useSelector((state: RootState) => state.config);

  const [biometrics, setBiometrics] = useState(biometricsEnabled || true);
  const [offlineRequestsCount, setOfflineRequestsCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const checkOfflineQueue = async () => {
    try {
      const q = await AsyncStorage.getItem("offline_request_queue");
      if (q) {
        const parsed = JSON.parse(q);
        setOfflineRequestsCount(parsed.length);
      } else {
        setOfflineRequestsCount(0);
      }
    } catch (e) {
      setOfflineRequestsCount(0);
    }
  };

  useEffect(() => {
    checkOfflineQueue();
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    const count = await syncOfflineQueue();
    await checkOfflineQueue();
    setSyncing(false);
    Alert.alert("Sync Complete", `${count} buffered offline requests synchronized with backend cloud services.`);
  };

  const handleClearOfflineQueue = async () => {
    await AsyncStorage.removeItem("offline_request_queue");
    setOfflineRequestsCount(0);
    Alert.alert("Buffer Cleared", "Offline request outbox reset.");
  };

  const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure you want to securely log out of your session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove(["userToken", "userRefreshToken", "userData"]);
          dispatch(logout());
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? "#070b19" : "#f8fafc" }]}>
      <View style={[styles.card, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={styles.subTitle}>SYSTEM PREFERENCES</Text>
        <Text style={[styles.title, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Settings & Security</Text>
        <Text style={styles.infoText}>Configure security policies, language preferences, and offline caching telemetry.</Text>
      </View>

      {/* Account Info */}
      <View style={[styles.card, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? "#f1f5f9" : "#0f172a", marginBottom: 12 }]}>
          Current Account Profile
        </Text>
        <View style={styles.userBox}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{user?.fullName || "Sai Prasad"}</Text>
            <Text style={styles.userRole}>Role: {user?.role || "STUDENT"}</Text>
          </View>
          <Badge label="ACTIVE SESSION" variant="success" size="sm" />
        </View>
      </View>

      {/* Security & Biometrics */}
      <View style={[styles.card, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? "#f1f5f9" : "#0f172a", marginBottom: 16 }]}>
          Authentication & Enclave
        </Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleLabel, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Biometric Quick Unlock</Text>
            <Text style={styles.toggleSub}>Face ID / Fingerprint fast login</Text>
          </View>
          <Switch
            value={biometrics}
            onValueChange={setBiometrics}
            trackColor={{ false: "#1e293b", true: "#6366f1" }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={[styles.toggleRow, { marginTop: 16 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleLabel, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Interface Language</Text>
            <Text style={styles.toggleSub}>Current: {language === "en" ? "English (Global)" : "Marathi (मराठी)"}</Text>
          </View>
          <TouchableOpacity
            style={styles.langBtn}
            onPress={() => dispatch(toggleLanguage())}
          >
            <Text style={styles.langBtnText}>{language === "en" ? "मराठी" : "English"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Outbox & Network Resilience */}
      <View style={[styles.card, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? "#f1f5f9" : "#0f172a", marginBottom: 8 }]}>
          Network Resilience & Outbox
        </Text>
        <Text style={styles.infoText}>
          When offline, interview speech submissions and job applications are cached locally.
        </Text>

        <View style={styles.outboxInfo}>
          <Text style={styles.outboxVal}>{offlineRequestsCount}</Text>
          <Text style={styles.outboxLbl}>Pending Buffered Requests</Text>
        </View>

        <View style={styles.outboxActions}>
          <TouchableOpacity
            style={[styles.syncBtn, { backgroundColor: "#6366f1" }]}
            onPress={handleManualSync}
            disabled={syncing}
          >
            <Text style={styles.btnText}>{syncing ? "SYNCING..." : "SYNC OUTBOX NOW"}</Text>
          </TouchableOpacity>

          {offlineRequestsCount > 0 && (
            <TouchableOpacity
              style={[styles.syncBtn, { backgroundColor: "#ef4444", marginTop: 8 }]}
              onPress={handleClearOfflineQueue}
            >
              <Text style={styles.btnText}>PURGE CACHED BUFFER</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>TERMINATE SECURE SESSION</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
  },
  subTitle: {
    fontSize: 9,
    fontWeight: "900",
    color: "#6366f1",
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 18,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  userBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 12,
  },
  userName: {
    fontSize: 14,
    fontWeight: "800",
  },
  userRole: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  toggleSub: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  langBtn: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  langBtnText: {
    color: "#818cf8",
    fontWeight: "800",
    fontSize: 12,
  },
  outboxInfo: {
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 14,
    marginVertical: 16,
  },
  outboxVal: {
    fontSize: 32,
    fontWeight: "900",
    color: "#6366f1",
  },
  outboxLbl: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 4,
  },
  outboxActions: {
    width: "100%",
  },
  syncBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  logoutBtn: {
    backgroundColor: "#450a0a",
    borderWidth: 1.5,
    borderColor: "#dc2626",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 40,
  },
  logoutBtnText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
