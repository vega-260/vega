import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  useColorScheme,
} from "react-native";
import { RecruiterCandidate } from "../types";
import { Badge } from "../components/Badge";

export function RecruiterCandidatesScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const [search, setSearch] = useState("");
  const [minTalentScore, setMinTalentScore] = useState<number>(75);

  const [candidates, setCandidates] = useState<RecruiterCandidate[]>([
    {
      id: 1,
      userId: 101,
      name: "Sai Prasad",
      email: "saiprasad@example.com",
      college: "Vellore Institute of Technology",
      branch: "Computer Science & Engineering",
      talentScore: 92,
      codingScore: 96,
      interviewScore: 88,
      skills: ["React", "TypeScript", "Node.js", "Redis", "BullMQ"],
      applicationStage: "TECHNICAL_INTERVIEW",
      jobId: 101,
      jobTitle: "Senior Full Stack Cloud Engineer",
      appliedDate: "2026-08-10",
    },
    {
      id: 2,
      userId: 102,
      name: "Ananya Sharma",
      email: "ananya.s@example.com",
      college: "IIT Bombay",
      branch: "Electrical & Computer Science",
      talentScore: 95,
      codingScore: 98,
      interviewScore: 92,
      skills: ["Python", "PyTorch", "NLP", "FastAPI", "Docker"],
      applicationStage: "TEST",
      jobId: 102,
      jobTitle: "AI / Machine Learning Engineer",
      appliedDate: "2026-08-08",
    },
    {
      id: 3,
      userId: 103,
      name: "Vikram Rathore",
      email: "vikram.r@example.com",
      college: "NIT Trichy",
      branch: "Information Technology",
      talentScore: 84,
      codingScore: 88,
      interviewScore: 80,
      skills: ["Java", "Spring Boot", "Kafka", "PostgreSQL"],
      applicationStage: "APPLIED",
      jobId: 104,
      jobTitle: "Backend Performance Engineer",
      appliedDate: "2026-08-12",
    },
  ]);

  const handleShortlist = (cand: RecruiterCandidate) => {
    Alert.alert(
      "Shortlist Candidate",
      `Advance ${cand.name} to Technical Interview Round?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Advance Candidate",
          onPress: () => {
            setCandidates((prev) =>
              prev.map((c) =>
                c.id === cand.id ? { ...c, applicationStage: "TECHNICAL_INTERVIEW" } : c
              )
            );
            Alert.alert("Stage Updated! 🚀", `${cand.name} moved to Technical Interview.`);
          },
        },
      ]
    );
  };

  const handleScheduleInterview = (cand: RecruiterCandidate) => {
    Alert.alert(
      "Interview Slot",
      `Send automated WebRTC video interview invite to ${cand.email}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Invite",
          onPress: () => {
            Alert.alert("Invite Dispatched! ✉️", "Calendar link and live interview room URL emailed to candidate.");
          },
        },
      ]
    );
  };

  const filteredCandidates = candidates.filter((c) => {
    const matchesQuery =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.college.toLowerCase().includes(search.toLowerCase()) ||
      c.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));

    const matchesScore = c.talentScore >= minTalentScore;
    return matchesQuery && matchesScore;
  });

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? "#070b19" : "#f8fafc" }]}>
      <View style={[styles.headerCard, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={styles.subTitle}>TALENT SOURCING</Text>
        <Text style={[styles.title, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Candidate Discovery</Text>
        <Text style={styles.infoText}>
          Filter student candidates verified by automated AI Mock Interviews and verified LeetCode/GitHub benchmarks.
        </Text>

        <TextInput
          style={[styles.searchInput, { color: isDark ? "#f1f5f9" : "#0f172a", backgroundColor: isDark ? "#070b19" : "#f1f5f9" }]}
          placeholder="Filter by name, skills (e.g. Redis), or university..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Candidate Cards */}
      {filteredCandidates.map((cand) => (
        <View
          key={cand.id}
          style={[
            styles.candCard,
            { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" },
          ]}
        >
          <View style={styles.candTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.candName, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{cand.name}</Text>
              <Text style={styles.candCollege}>{cand.college} • {cand.branch}</Text>
              <Text style={styles.appliedJobText}>Applied for: {cand.jobTitle}</Text>
            </View>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreNum}>{cand.talentScore}%</Text>
              <Text style={styles.scoreLbl}>TALENT</Text>
            </View>
          </View>

          {/* Scores strip */}
          <View style={styles.scoresStrip}>
            <View style={styles.scoreCol}>
              <Text style={styles.colVal}>⚡ {cand.codingScore}%</Text>
              <Text style={styles.colLbl}>Coding</Text>
            </View>
            <View style={styles.scoreCol}>
              <Text style={styles.colVal}>🎙 {cand.interviewScore}%</Text>
              <Text style={styles.colLbl}>AI Mock IV</Text>
            </View>
            <View style={styles.scoreCol}>
              <Badge label={cand.applicationStage.replace("_", " ")} variant="primary" size="sm" />
            </View>
          </View>

          {/* Skills */}
          <View style={styles.skillsRow}>
            {cand.skills.map((skill, idx) => (
              <View key={idx} style={{ marginRight: 6 }}>
                <Badge label={skill} variant="neutral" size="sm" />
              </View>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => handleScheduleInterview(cand)} style={styles.interviewBtn}>
              <Text style={styles.btnText}>SCHEDULE IV</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleShortlist(cand)} style={styles.advanceBtn}>
              <Text style={styles.btnText}>ADVANCE STAGE →</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
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
    marginBottom: 16,
  },
  searchInput: {
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: "600",
  },
  candCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  candTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  candName: {
    fontSize: 16,
    fontWeight: "800",
  },
  candCollege: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  appliedJobText: {
    fontSize: 12,
    color: "#6366f1",
    fontWeight: "700",
    marginTop: 4,
  },
  scoreBadge: {
    backgroundColor: "#064e3b",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
  },
  scoreNum: {
    color: "#34d399",
    fontSize: 14,
    fontWeight: "900",
  },
  scoreLbl: {
    color: "#34d399",
    fontSize: 8,
    fontWeight: "800",
    marginTop: 1,
  },
  scoresStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  scoreCol: {
    alignItems: "center",
  },
  colVal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  colLbl: {
    fontSize: 9,
    color: "#64748b",
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 2,
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingTop: 12,
  },
  interviewBtn: {
    flex: 1,
    backgroundColor: "#1e293b",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 8,
  },
  advanceBtn: {
    flex: 1,
    backgroundColor: "#6366f1",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
