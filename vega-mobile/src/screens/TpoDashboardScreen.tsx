import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
} from "react-native";
import { useDispatch } from "react-redux";
import { logout } from "../store";
import { Badge } from "../components/Badge";

export function TpoDashboardScreen() {
  const dispatch = useDispatch();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const [stats, setStats] = useState({
    totalEligible: 680,
    placedCount: 574,
    placementRate: 84.4,
    avgPackageLPA: 12.8,
    highestPackageLPA: 44.0,
    activeDrives: 8,
  });

  const [drives, setDrives] = useState([
    { id: 1, company: "Google Cloud", role: "Software Engineer", date: "Aug 18, 2026", status: "SCHEDULED", applicants: 142 },
    { id: 2, company: "Microsoft IDC", role: "Cloud Solution Architect", date: "Aug 22, 2026", status: "SHORTLISTING", applicants: 198 },
    { id: 3, company: "Razorpay", role: "Backend Performance Engineer", date: "Aug 26, 2026", status: "COMPLETED", applicants: 110 },
  ]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? "#070b19" : "#f8fafc" }]}>
      {/* Nav Header */}
      <View style={styles.navHeader}>
        <View>
          <Text style={[styles.logo, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>TPO Portal</Text>
          <Text style={styles.collegeSub}>Placement & Training Cell</Text>
        </View>
        <TouchableOpacity onPress={() => dispatch(logout())} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Main Placement Stats Card */}
      <View style={[styles.card, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={styles.bannerSubtitle}>2026 BATCH PLACEMENT METRICS</Text>
        <Text style={[styles.bannerTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Campus Placement Overview</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: "#34d399" }]}>{stats.placementRate}%</Text>
            <Text style={styles.statLabel}>Placement Rate</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>₹{stats.avgPackageLPA} LPA</Text>
            <Text style={styles.statLabel}>Avg CTC</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: "#c084fc" }]}>₹{stats.highestPackageLPA} LPA</Text>
            <Text style={styles.statLabel}>Highest CTC</Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Placed: {stats.placedCount} / {stats.totalEligible} Students</Text>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${stats.placementRate}%` }]} />
          </View>
        </View>
      </View>

      {/* Active Campus Drives */}
      <View style={[styles.card, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? "#f1f5f9" : "#0f172a", marginBottom: 16 }]}>
          Upcoming Campus Drives
        </Text>

        {drives.map((drive) => (
          <View key={drive.id} style={styles.driveCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.driveCompany}>{drive.company}</Text>
              <Text style={styles.driveRole}>{drive.role}</Text>
              <Text style={styles.driveDate}>📅 {drive.date} • {drive.applicants} Registered</Text>
            </View>
            <Badge label={drive.status} variant={drive.status === "COMPLETED" ? "neutral" : "primary"} size="sm" />
          </View>
        ))}

        <TouchableOpacity
          style={styles.scheduleBtn}
          onPress={() => Alert.alert("Drive Scheduler", "Opening multi-company on-campus placement drive configurator...")}
        >
          <Text style={styles.scheduleBtnText}>+ SCHEDULE NEW CAMPUS DRIVE</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  navHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
  },
  logo: {
    fontSize: 22,
    fontWeight: "900",
  },
  collegeSub: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "700",
  },
  logoutBtn: {
    padding: 8,
  },
  logoutText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "800",
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
  },
  bannerSubtitle: {
    fontSize: 9,
    fontWeight: "900",
    color: "#6366f1",
    letterSpacing: 2,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statVal: {
    fontSize: 20,
    fontWeight: "900",
    color: "#6366f1",
  },
  statLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 2,
  },
  progressRow: {
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingTop: 16,
  },
  progressLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "700",
    marginBottom: 8,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#1e293b",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  driveCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  driveCompany: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
  driveRole: {
    fontSize: 12,
    color: "#a5b4fc",
    fontWeight: "600",
    marginTop: 2,
  },
  driveDate: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 4,
  },
  scheduleBtn: {
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  scheduleBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
