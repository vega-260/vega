import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { RootState, fetchDashboardStart, fetchDashboardSuccess, fetchDashboardFailure } from "../store";
import { api, syncOfflineQueue } from "../services/api";
import { Badge } from "../components/Badge";

export function DashboardScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const { dashboardData, isLoading, error } = useSelector((state: RootState) => state.student);
  const { isOffline } = useSelector((state: RootState) => state.config);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    dispatch(fetchDashboardStart());
    try {
      const response = await api.get("/analytics/student/1");
      dispatch(
        fetchDashboardSuccess({
          talentScore: response.data?.talentScore || 82,
          talentScoreBreakdown: response.data?.breakdown || {
            skills: 80,
            interview: 75,
            coding: 90,
            psychometric: 85,
            academic: 80,
          },
          xpBalance: response.data?.xpBalance || 450,
          streak: response.data?.streak || 5,
          recommendedJobsCount: response.data?.jobsCount || 12,
          upcomingInterviews: response.data?.interviews || [
            {
              id: 1,
              companyName: "Google Cloud",
              role: "Senior Full Stack Cloud Engineer",
              date: "Aug 16, 2:30 PM",
            },
            {
              id: 2,
              companyName: "Microsoft Research",
              role: "AI / Machine Learning Engineer",
              date: "Aug 18, 11:00 AM",
            },
          ],
        })
      );
    } catch (err: any) {
      dispatch(fetchDashboardFailure(err.message || "Could not retrieve student metrics."));
    }
  }, [dispatch]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (!isOffline) {
      await syncOfflineQueue();
    }
    await fetchDashboardData();
    setRefreshing(false);
  };

  const formattedScoreLabel = useMemo(() => {
    if (!dashboardData) return "82%";
    return `${dashboardData.talentScore}%`;
  }, [dashboardData]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? "#070b19" : "#f8fafc" }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
    >
      {isOffline && (
        <View style={styles.networkAlert}>
          <Text style={styles.networkText}>⚠️ Offline Outbox: Requests buffered locally until connection is restored.</Text>
        </View>
      )}

      {/* Hero Header Section */}
      <View style={[styles.heroCard, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={styles.subtitle}>HOLISTIC TALENT BENCHMARK</Text>
        <Text style={[styles.talentTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>VEGA Talent Score</Text>

        <View style={styles.gaugeContainer}>
          <Text style={styles.hugeScore}>{formattedScoreLabel}</Text>
          <View style={styles.tierBadge}>
            <Badge label="TOP 5% PLACEMENT TIER" variant="success" size="sm" />
          </View>
        </View>

        {/* Breakdown of score */}
        <View style={styles.breakdownGrid}>
          <View style={styles.gridItem}>
            <Text style={styles.gridVal}>{dashboardData?.talentScoreBreakdown?.coding || 90}%</Text>
            <Text style={styles.gridLabel}>DSA & Coding</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridVal}>{dashboardData?.talentScoreBreakdown?.interview || 88}%</Text>
            <Text style={styles.gridLabel}>AI Mock IV</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridVal}>{dashboardData?.talentScoreBreakdown?.psychometric || 85}%</Text>
            <Text style={styles.gridLabel}>Psychometric</Text>
          </View>
        </View>
      </View>

      {/* Gamification Hub */}
      <View style={styles.streakRow}>
        <View style={[styles.streakCard, { backgroundColor: isDark ? "#1e1b4b" : "#e0e7ff" }]}>
          <Text style={[styles.statTitle, { color: isDark ? "#c7d2fe" : "#4338ca" }]}>Daily Hot Streak</Text>
          <Text style={[styles.statValue, { color: isDark ? "#ffffff" : "#312e81" }]}>🔥 {dashboardData?.streak || 5} Days</Text>
        </View>
        <View style={[styles.streakCard, { backgroundColor: isDark ? "#14532d" : "#dcfce7" }]}>
          <Text style={[styles.statTitle, { color: isDark ? "#bbf7d0" : "#15803d" }]}>VEGA XP Wallet</Text>
          <Text style={[styles.statValue, { color: isDark ? "#ffffff" : "#14532d" }]}>🪙 {dashboardData?.xpBalance || 450} XP</Text>
        </View>
      </View>

      {/* Quick Launch Hub */}
      <View style={[styles.section, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Career Accelerators</Text>

        <View style={styles.launchGrid}>
          <TouchableOpacity
            style={[styles.launchTile, { backgroundColor: isDark ? "#111827" : "#f1f5f9" }]}
            onPress={() => navigation.navigate("ApplicationTracker")}
          >
            <Text style={styles.launchEmoji}>📈</Text>
            <Text style={[styles.launchTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Live Pipeline</Text>
            <Text style={styles.launchSub}>Track ATS Stages</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.launchTile, { backgroundColor: isDark ? "#111827" : "#f1f5f9" }]}
            onPress={() => navigation.navigate("CodingArena")}
          >
            <Text style={styles.launchEmoji}>💻</Text>
            <Text style={[styles.launchTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Coding Arena</Text>
            <Text style={styles.launchSub}>DSA & Challenges</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.launchTile, { backgroundColor: isDark ? "#111827" : "#f1f5f9" }]}
            onPress={() => navigation.navigate("ResumeBuilder")}
          >
            <Text style={styles.launchEmoji}>📄</Text>
            <Text style={[styles.launchTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>ATS Resume</Text>
            <Text style={styles.launchSub}>AI Keyword Match</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.launchTile, { backgroundColor: isDark ? "#111827" : "#f1f5f9" }]}
            onPress={() => navigation.navigate("Community")}
          >
            <Text style={styles.launchEmoji}>💬</Text>
            <Text style={[styles.launchTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Community</Text>
            <Text style={styles.launchSub}>Peer Debriefs</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dynamic Interview Board */}
      <View style={[styles.section, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Upcoming Sessions</Text>
        {(!dashboardData?.upcomingInterviews || dashboardData.upcomingInterviews.length === 0) ? (
          <Text style={styles.noInterviews}>No evaluation benchmarks scheduled. Keep up the learning streak!</Text>
        ) : (
          dashboardData.upcomingInterviews.map((session: any, index: number) => (
            <View key={session.id || index} style={styles.sessionCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionCompany}>{session.companyName}</Text>
                <Text style={styles.sessionRole}>{session.role}</Text>
                {session.date && <Text style={styles.sessionDate}>📅 {session.date}</Text>}
              </View>
              <TouchableOpacity
                style={styles.joinBtn}
                onPress={() => navigation.navigate("InterviewReport", { interviewId: session.id || 1 })}
              >
                <Text style={styles.joinBtnText}>VIEW REPORT</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  networkAlert: {
    backgroundColor: "#b45309",
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  networkText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
  },
  heroCard: {
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
  },
  subtitle: {
    fontSize: 9,
    fontWeight: "900",
    color: "#6366f1",
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  talentTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 16,
  },
  gaugeContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  hugeScore: {
    fontSize: 54,
    fontWeight: "900",
    color: "#6366f1",
  },
  tierBadge: {
    marginTop: 6,
  },
  breakdownGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingTop: 16,
  },
  gridItem: {
    alignItems: "center",
    flex: 1,
  },
  gridVal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#6366f1",
  },
  gridLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "bold",
    marginTop: 2,
    textTransform: "uppercase",
  },
  streakRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  streakCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 16,
    padding: 16,
  },
  statTitle: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
  },
  section: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 16,
  },
  launchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  launchTile: {
    width: "48%",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  launchEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  launchTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  launchSub: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  noInterviews: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
    fontWeight: "600",
  },
  sessionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  sessionCompany: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  sessionRole: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  sessionDate: {
    fontSize: 10,
    color: "#a5b4fc",
    fontWeight: "600",
    marginTop: 2,
  },
  joinBtn: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinBtnText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
