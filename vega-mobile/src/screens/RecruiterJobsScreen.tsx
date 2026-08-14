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
import { Badge } from "../components/Badge";

export function RecruiterJobsScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [salary, setSalary] = useState("");
  const [skills, setSkills] = useState("");
  const [description, setDescription] = useState("");

  const [postings, setPostings] = useState([
    {
      id: 1,
      title: "Senior Full Stack Cloud Engineer",
      salary: "₹24 - ₹32 LPA",
      type: "Full-time",
      applicants: 142,
      shortlisted: 32,
      status: "ACTIVE",
    },
    {
      id: 2,
      title: "AI / Machine Learning Engineer",
      salary: "₹28 - ₹38 LPA",
      type: "Full-time",
      applicants: 89,
      shortlisted: 14,
      status: "ACTIVE",
    },
  ]);

  const handleCreateJob = () => {
    if (!title || !salary) {
      Alert.alert("Missing Fields", "Please provide a job title and salary bracket.");
      return;
    }

    const newJob = {
      id: Date.now(),
      title,
      salary,
      type: "Full-time",
      applicants: 0,
      shortlisted: 0,
      status: "ACTIVE",
    };

    setPostings([newJob, ...postings]);
    setTitle("");
    setSalary("");
    setSkills("");
    setDescription("");
    setShowCreate(false);
    Alert.alert("Job Published! 🚀", "Opportunity is now live for all eligible university talent.");
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? "#070b19" : "#f8fafc" }]}>
      <View style={[styles.headerCard, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={styles.subTitle}>REQUISITIONS & CRITERIA</Text>
        <Text style={[styles.title, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Job Openings Manager</Text>
        <Text style={styles.infoText}>Create openings and set automated screening benchmarks for incoming applications.</Text>

        <TouchableOpacity onPress={() => setShowCreate(!showCreate)} style={styles.createBtn}>
          <Text style={styles.createBtnText}>{showCreate ? "CANCEL" : "+ CREATE NEW JOB REQUISITION"}</Text>
        </TouchableOpacity>
      </View>

      {/* Create Form */}
      {showCreate && (
        <View style={[styles.formCard, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
          <Text style={styles.formHeading}>New Job Posting</Text>

          <Text style={styles.inputLbl}>Position Title</Text>
          <TextInput
            style={[styles.input, { color: isDark ? "#f1f5f9" : "#0f172a", backgroundColor: isDark ? "#070b19" : "#f1f5f9" }]}
            placeholder="e.g. Distributed Systems Engineer"
            placeholderTextColor="#64748b"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.inputLbl}>Annual Compensation (CTC)</Text>
          <TextInput
            style={[styles.input, { color: isDark ? "#f1f5f9" : "#0f172a", backgroundColor: isDark ? "#070b19" : "#f1f5f9" }]}
            placeholder="e.g. ₹20 - ₹28 LPA"
            placeholderTextColor="#64748b"
            value={salary}
            onChangeText={setSalary}
          />

          <Text style={styles.inputLbl}>Required Skills (Comma separated)</Text>
          <TextInput
            style={[styles.input, { color: isDark ? "#f1f5f9" : "#0f172a", backgroundColor: isDark ? "#070b19" : "#f1f5f9" }]}
            placeholder="e.g. TypeScript, React, BullMQ, Redis"
            placeholderTextColor="#64748b"
            value={skills}
            onChangeText={setSkills}
          />

          <Text style={styles.inputLbl}>Role Responsibilities</Text>
          <TextInput
            style={[styles.inputArea, { color: isDark ? "#f1f5f9" : "#0f172a", backgroundColor: isDark ? "#070b19" : "#f1f5f9" }]}
            placeholder="Describe candidate expectations and tech stack..."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />

          <TouchableOpacity onPress={handleCreateJob} style={styles.publishBtn}>
            <Text style={styles.publishText}>PUBLISH JOB OPPORTUNITY</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active Postings */}
      {postings.map((p) => (
        <View
          key={p.id}
          style={[
            styles.jobCard,
            { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" },
          ]}
        >
          <View style={styles.jobTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.jobTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{p.title}</Text>
              <Text style={styles.jobSalary}>💰 {p.salary} • {p.type}</Text>
            </View>
            <Badge label={p.status} variant="success" size="sm" />
          </View>

          <View style={styles.statsStrip}>
            <View style={styles.stripCol}>
              <Text style={styles.stripVal}>{p.applicants}</Text>
              <Text style={styles.stripLbl}>Applicants</Text>
            </View>
            <View style={styles.stripCol}>
              <Text style={[styles.stripVal, { color: "#818cf8" }]}>{p.shortlisted}</Text>
              <Text style={styles.stripLbl}>In Review</Text>
            </View>
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
  createBtn: {
    backgroundColor: "#6366f1",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  createBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  formCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  formHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: "#6366f1",
    marginBottom: 12,
  },
  inputLbl: {
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
  inputArea: {
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    fontWeight: "600",
    textAlignVertical: "top",
    minHeight: 80,
    marginBottom: 16,
  },
  publishBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  publishText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  jobCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
  },
  jobTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  jobSalary: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
    marginTop: 4,
  },
  statsStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 12,
  },
  stripCol: {
    alignItems: "center",
    flex: 1,
  },
  stripVal: {
    fontSize: 18,
    fontWeight: "900",
    color: "#6366f1",
  },
  stripLbl: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 2,
  },
});
