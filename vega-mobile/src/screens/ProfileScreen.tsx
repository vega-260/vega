import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  useColorScheme,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState, logout } from "../store";
import { Badge } from "../components/Badge";

export function ProfileScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const dispatch = useDispatch();

  const { user } = useSelector((state: RootState) => state.auth);
  const { dashboardData } = useSelector((state: RootState) => state.student);

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || "Sai Prasad");
  const [collegeName, setCollegeName] = useState("Vellore Institute of Technology");
  const [branch, setBranch] = useState("Computer Science & Engineering");
  const [cgpa, setCgpa] = useState("9.12");

  // Coding Handles
  const [leetcodeUser, setLeetcodeUser] = useState("saiprasad26");
  const [githubUser, setGithubUser] = useState("saiprasad-2610");
  const [codechefUser, setCodechefUser] = useState("sai_vega");

  const handleSaveProfile = () => {
    setEditing(false);
    Alert.alert("Profile Synchronized! ✅", "Your updated academic and coding credentials have been synced with recruiter search index.");
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? "#070b19" : "#f8fafc" }]}>
      {/* Profile Banner */}
      <View style={[styles.profileCard, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <View style={styles.topRow}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{fullName[0]}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={[styles.nameText, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{fullName}</Text>
            <Text style={styles.emailText}>{user?.email || "saiprasad@example.com"}</Text>
            <View style={styles.badgeRow}>
              <Badge label="VERIFIED TALENT" variant="success" size="sm" />
              <View style={{ marginLeft: 6 }}>
                <Badge label="TOP 5% CODER" variant="primary" size="sm" />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.talentScoreStrip}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreVal}>{dashboardData?.talentScore || 82}%</Text>
            <Text style={styles.scoreLbl}>Talent Score</Text>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreVal, { color: "#c084fc" }]}>{dashboardData?.xpBalance || 450}</Text>
            <Text style={styles.scoreLbl}>VEGA XP</Text>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreVal, { color: "#34d399" }]}>#42</Text>
            <Text style={styles.scoreLbl}>State Rank</Text>
          </View>
        </View>
      </View>

      {/* Academic Credentials */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Academic Credentials</Text>
          <TouchableOpacity onPress={() => (editing ? handleSaveProfile() : setEditing(true))}>
            <Text style={styles.editLink}>{editing ? "Save" : "Edit"}</Text>
          </TouchableOpacity>
        </View>

        {editing ? (
          <View>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={[styles.input, { color: isDark ? "#f1f5f9" : "#0f172a", backgroundColor: isDark ? "#070b19" : "#f1f5f9" }]}
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={styles.inputLabel}>University / College</Text>
            <TextInput
              style={[styles.input, { color: isDark ? "#f1f5f9" : "#0f172a", backgroundColor: isDark ? "#070b19" : "#f1f5f9" }]}
              value={collegeName}
              onChangeText={setCollegeName}
            />

            <Text style={styles.inputLabel}>Branch of Engineering</Text>
            <TextInput
              style={[styles.input, { color: isDark ? "#f1f5f9" : "#0f172a", backgroundColor: isDark ? "#070b19" : "#f1f5f9" }]}
              value={branch}
              onChangeText={setBranch}
            />

            <Text style={styles.inputLabel}>Cumulative CGPA</Text>
            <TextInput
              style={[styles.input, { color: isDark ? "#f1f5f9" : "#0f172a", backgroundColor: isDark ? "#070b19" : "#f1f5f9" }]}
              value={cgpa}
              onChangeText={setCgpa}
              keyboardType="numeric"
            />
          </View>
        ) : (
          <View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>College:</Text>
              <Text style={[styles.infoVal, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{collegeName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Degree & Branch:</Text>
              <Text style={[styles.infoVal, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{branch}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Graduation Year:</Text>
              <Text style={[styles.infoVal, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>2026</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>CGPA Aggregate:</Text>
              <Text style={[styles.infoVal, { color: "#10b981", fontWeight: "900" }]}>{cgpa} / 10.0</Text>
            </View>
          </View>
        )}
      </View>

      {/* Verified Coding Platforms */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? "#f1f5f9" : "#0f172a", marginBottom: 12 }]}>
          Verified Platform Sync
        </Text>

        <View style={styles.platformRow}>
          <View style={styles.platformIcon}>
            <Text style={styles.platformIconText}>⚡</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.platformName, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>LeetCode</Text>
            <Text style={styles.platformSub}>@{leetcodeUser} • 420 Solved • Top 7%</Text>
          </View>
          <Badge label="SYNCED" variant="success" size="sm" />
        </View>

        <View style={styles.platformRow}>
          <View style={[styles.platformIcon, { backgroundColor: "#1e1b4b" }]}>
            <Text style={styles.platformIconText}>🐙</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.platformName, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>GitHub</Text>
            <Text style={styles.platformSub}>@{githubUser} • 18 Repos • 540 Commits</Text>
          </View>
          <Badge label="SYNCED" variant="success" size="sm" />
        </View>

        <View style={styles.platformRow}>
          <View style={[styles.platformIcon, { backgroundColor: "#451a03" }]}>
            <Text style={styles.platformIconText}>⭐</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.platformName, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>CodeChef</Text>
            <Text style={styles.platformSub}>@{codechefUser} • 4-Star (1840 Rating)</Text>
          </View>
          <Badge label="SYNCED" variant="success" size="sm" />
        </View>
      </View>

      {/* Resume Document */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? "#f1f5f9" : "#0f172a", marginBottom: 12 }]}>
          Master Resume Document
        </Text>
        <View style={styles.resumeBox}>
          <Text style={styles.resumeIcon}>📄</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.resumeName, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Sai_Prasad_Resume_2026.pdf</Text>
            <Text style={styles.resumeMeta}>ATS Score: 88% • Verified by AI</Text>
          </View>
          <TouchableOpacity
            style={styles.previewBtn}
            onPress={() => Alert.alert("Resume", "Master resume rendered and verified for 1-Click job applications.")}
          >
            <Text style={styles.previewBtnText}>VIEW</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLargeText: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
  },
  nameText: {
    fontSize: 18,
    fontWeight: "900",
  },
  emailText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  talentScoreStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
  },
  scoreItem: {
    alignItems: "center",
    flex: 1,
  },
  scoreVal: {
    fontSize: 20,
    fontWeight: "900",
    color: "#6366f1",
  },
  scoreLbl: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 2,
  },
  scoreDivider: {
    width: 1,
    backgroundColor: "#1e293b",
  },
  sectionCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  editLink: {
    color: "#6366f1",
    fontWeight: "800",
    fontSize: 13,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  input: {
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  infoVal: {
    fontSize: 12,
    fontWeight: "700",
  },
  platformRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  platformIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#312e81",
    alignItems: "center",
    justifyContent: "center",
  },
  platformIconText: {
    fontSize: 16,
  },
  platformName: {
    fontSize: 14,
    fontWeight: "800",
  },
  platformSub: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  resumeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
  },
  resumeIcon: {
    fontSize: 24,
  },
  resumeName: {
    fontSize: 13,
    fontWeight: "800",
  },
  resumeMeta: {
    fontSize: 11,
    color: "#34d399",
    fontWeight: "700",
    marginTop: 2,
  },
  previewBtn: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  previewBtnText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
