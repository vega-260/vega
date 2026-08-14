import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from "react-native";
import { api, queueOfflineRequest } from "../services/api";
import { Job } from "../types";
import { Badge } from "../components/Badge";

export function JobsScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [applying, setApplying] = useState(false);

  // Load jobs from API with fallback sample jobs
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await api.get("/jobs");
      if (response.data && Array.isArray(response.data)) {
        setJobs(response.data);
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        setJobs(response.data.data);
      } else {
        throw new Error("Invalid jobs response format");
      }
    } catch (err) {
      console.warn("Falling back to pre-seeded enterprise job postings", err);
      setJobs([
        {
          id: 101,
          title: "Senior Full Stack Cloud Engineer",
          companyName: "Google Cloud",
          location: "Bengaluru (Hybrid)",
          type: "Full-time",
          salary: "₹24 - ₹32 LPA",
          description: "Architect and deliver high-throughput, microservice-based backend systems and web applications leveraging GCP, Redis, and React.",
          skillsRequired: ["TypeScript", "React", "Node.js", "Redis", "Docker", "GCP"],
          matchScore: 94,
          openings: 3,
          deadline: "2026-09-15",
        },
        {
          id: 102,
          title: "AI / Machine Learning Engineer",
          companyName: "Microsoft Research",
          location: "Hyderabad (Remote)",
          type: "Full-time",
          salary: "₹28 - ₹38 LPA",
          description: "Design real-time speech evaluation models and large language model inference pipelines with high accuracy and low latency.",
          skillsRequired: ["Python", "PyTorch", "NLP", "FastAPI", "Gemini / OpenAI APIs"],
          matchScore: 89,
          openings: 2,
          deadline: "2026-09-20",
        },
        {
          id: 103,
          title: "Frontend Platform Architect",
          companyName: "CRED",
          location: "Bengaluru",
          type: "Full-time",
          salary: "₹22 - ₹30 LPA",
          description: "Build micro-frontends with high animation fidelity, 60fps gesture handling, and offline-first data caching.",
          skillsRequired: ["React Native", "TypeScript", "Tailwind CSS", "Reanimated"],
          matchScore: 85,
          openings: 4,
          deadline: "2026-09-30",
        },
        {
          id: 104,
          title: "Backend Performance Engineer",
          companyName: "Razorpay",
          location: "Mumbai / Hybrid",
          type: "Full-time",
          salary: "₹20 - ₹28 LPA",
          description: "Optimize transactional throughput, database indexing, distributed queuing with BullMQ, and event logging.",
          skillsRequired: ["Node.js", "PostgreSQL", "BullMQ", "Redis", "Kafka"],
          matchScore: 92,
          openings: 5,
          deadline: "2026-10-05",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.skillsRequired.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = selectedType === "ALL" || job.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleApply = async (job: Job) => {
    setApplying(true);
    try {
      await api.post(`/jobs/${job.id}/apply`, {
        studentId: 1,
        coverLetter: "Excited to apply via Vega Talent Platform verified profile.",
      });

      // Update local state
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, applied: true } : j))
      );

      Alert.alert(
        "Application Dispatched! 🚀",
        `Your verified talent credentials have been submitted to ${job.companyName} for the ${job.title} role. You can track progress in the Application Tracker.`
      );
      setSelectedJob(null);
    } catch (err: any) {
      console.warn("Application dispatch offline or error:", err);
      await queueOfflineRequest(`/jobs/${job.id}/apply`, "POST", { studentId: 1 });
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, applied: true } : j))
      );
      Alert.alert(
        "Application Queued Offline 📡",
        "Network connection is unstable. Your application has been secured in the offline buffer and will sync automatically upon reconnection."
      );
      setSelectedJob(null);
    } finally {
      setApplying(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#070b19" : "#f8fafc" }]}>
      {/* Search and Filters Header */}
      <View style={[styles.searchBox, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <TextInput
          style={[styles.searchInput, { color: isDark ? "#f1f5f9" : "#0f172a" }]}
          placeholder="Search by role, company, or tech stack..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {["ALL", "Full-time", "Internship"].map((type) => (
          <TouchableOpacity
            key={type}
            onPress={() => setSelectedType(type)}
            style={[
              styles.filterPill,
              selectedType === type
                ? { backgroundColor: "#6366f1", borderColor: "#6366f1" }
                : { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                selectedType === type ? { color: "#ffffff" } : { color: isDark ? "#94a3b8" : "#64748b" },
              ]}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Job Cards Stream */}
      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Fetching AI-matched opportunities...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.jobsList}>
          {filteredJobs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No jobs found matching your filters.</Text>
            </View>
          ) : (
            filteredJobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={[
                  styles.jobCard,
                  { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" },
                ]}
                onPress={() => setSelectedJob(job)}
              >
                <View style={styles.jobTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.jobTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{job.title}</Text>
                    <Text style={styles.companyName}>{job.companyName}</Text>
                  </View>
                  {job.matchScore && (
                    <View style={styles.matchBadge}>
                      <Text style={styles.matchScoreText}>{job.matchScore}% Match</Text>
                    </View>
                  )}
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>📍 {job.location}</Text>
                  <Text style={styles.metaText}>💰 {job.salary}</Text>
                </View>

                <View style={styles.skillsRow}>
                  {job.skillsRequired.slice(0, 3).map((skill, idx) => (
                    <View key={idx} style={{ marginRight: 6 }}>
                      <Badge label={skill} variant="neutral" size="sm" />
                    </View>
                  ))}
                  {job.skillsRequired.length > 3 && (
                    <Badge label={`+${job.skillsRequired.length - 3}`} variant="primary" size="sm" />
                  )}
                </View>

                <View style={styles.actionRow}>
                  <Text style={styles.deadlineText}>Deadline: {job.deadline || "Open"}</Text>
                  <TouchableOpacity
                    style={[
                      styles.applySmallBtn,
                      job.applied ? { backgroundColor: "#1e293b" } : { backgroundColor: "#6366f1" },
                    ]}
                    disabled={job.applied}
                    onPress={() => handleApply(job)}
                  >
                    <Text style={styles.applySmallText}>{job.applied ? "APPLIED ✓" : "1-CLICK APPLY"}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Detailed Job Modal */}
      <Modal visible={!!selectedJob} transparent animationType="slide" onRequestClose={() => setSelectedJob(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: isDark ? "#0c1224" : "#ffffff" }]}>
            {selectedJob && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalJobTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>
                      {selectedJob.title}
                    </Text>
                    <Text style={styles.modalCompany}>{selectedJob.companyName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedJob(null)} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalMetaBox}>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>Compensation</Text>
                    <Text style={styles.metaVal}>{selectedJob.salary}</Text>
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>Location</Text>
                    <Text style={styles.metaVal}>{selectedJob.location}</Text>
                  </View>
                </View>

                <Text style={styles.sectionHeading}>Job Description</Text>
                <Text style={styles.descriptionText}>{selectedJob.description}</Text>

                <Text style={styles.sectionHeading}>Required Technical Competencies</Text>
                <View style={styles.skillsWrap}>
                  {selectedJob.skillsRequired.map((skill, index) => (
                    <View key={index} style={{ margin: 4 }}>
                      <Badge label={skill} variant="primary" size="md" />
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.modalApplyBtn,
                    selectedJob.applied ? { backgroundColor: "#1e293b" } : { backgroundColor: "#6366f1" },
                  ]}
                  disabled={selectedJob.applied || applying}
                  onPress={() => handleApply(selectedJob)}
                >
                  {applying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalApplyText}>
                      {selectedJob.applied ? "APPLICATION SUBMITTED" : "SUBMIT VERIFIED APPLICATION"}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchBox: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    fontSize: 14,
    fontWeight: "600",
  },
  filterRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterText: {
    fontSize: 12,
    fontWeight: "700",
  },
  jobsList: {
    paddingBottom: 24,
  },
  jobCard: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  jobTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  companyName: {
    fontSize: 13,
    color: "#6366f1",
    fontWeight: "700",
    marginTop: 2,
  },
  matchBadge: {
    backgroundColor: "#064e3b",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  matchScoreText: {
    color: "#34d399",
    fontSize: 11,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  skillsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingTop: 12,
  },
  deadlineText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  applySmallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applySmallText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  loadingCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
  },
  emptyCard: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalJobTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  modalCompany: {
    fontSize: 14,
    color: "#6366f1",
    fontWeight: "700",
    marginTop: 4,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: "#94a3b8",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalMetaBox: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metaVal: {
    fontSize: 14,
    color: "#f1f5f9",
    fontWeight: "800",
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6366f1",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 20,
    fontWeight: "500",
    marginBottom: 20,
  },
  skillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 24,
  },
  modalApplyBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  modalApplyText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
