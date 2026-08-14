import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  useColorScheme,
} from "react-native";
import { useDispatch } from "react-redux";
import { incrementXPAward } from "../store";
import { AssessmentTest, Question } from "../types";
import { Badge } from "../components/Badge";

export function AssessmentCenterScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const dispatch = useDispatch();

  const [activeTest, setActiveTest] = useState<AssessmentTest | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [qId: number]: number }>({});
  const [testResult, setTestResult] = useState<{ score: number; xp: number } | null>(null);

  const tests: AssessmentTest[] = [
    {
      id: 1,
      title: "Data Structures & Algorithmic Complexity",
      category: "CODING",
      durationMinutes: 20,
      questionCount: 5,
      difficulty: "INTERMEDIATE",
      xpReward: 150,
    },
    {
      id: 2,
      title: "Full-Stack System Concurrency & BullMQ",
      category: "TECHNICAL_CORE",
      durationMinutes: 15,
      questionCount: 4,
      difficulty: "ADVANCED",
      xpReward: 200,
    },
    {
      id: 3,
      title: "Analytical Reasoning & Quantitative Aptitude",
      category: "APTITUDE",
      durationMinutes: 15,
      questionCount: 5,
      difficulty: "BEGINNER",
      xpReward: 100,
    },
    {
      id: 4,
      title: "Workplace Situation Judgement & Resilience",
      category: "PSYCHOMETRIC",
      durationMinutes: 10,
      questionCount: 4,
      difficulty: "INTERMEDIATE",
      xpReward: 120,
    },
  ];

  const sampleQuestions: Question[] = [
    {
      id: 1,
      prompt: "What is the average time complexity of searching an element in a balanced Binary Search Tree (AVL / Red-Black)?",
      options: ["O(1)", "O(log N)", "O(N)", "O(N log N)"],
      correctOptionIndex: 1,
      explanation: "A balanced BST guarantees log(N) height, making search, insertion, and deletion O(log N).",
    },
    {
      id: 2,
      prompt: "Which message queue design principle ensures high throughput without locking the main thread in Node.js?",
      options: [
        "Synchronous in-memory array push",
        "Redis-backed asynchronous producer-consumer outbox pattern (BullMQ)",
        "Blocking while(true) event loop iteration",
        "Single-threaded thread suspension",
      ],
      correctOptionIndex: 1,
      explanation: "Redis-backed BullMQ offloads long-running background tasks away from the Node.js event loop.",
    },
    {
      id: 3,
      prompt: "In React Native, which mechanism should be favored to achieve 60fps UI thread animations?",
      options: [
        "setInterval() with direct state updates",
        "React Native Reanimated with worklets executed on UI thread",
        "Pure CSS @keyframes injected in WebView",
        "Repeated synchronous Redux store dispatches",
      ],
      correctOptionIndex: 1,
      explanation: "Reanimated worklets run directly on the native thread, avoiding bridge serialization overhead.",
    },
    {
      id: 4,
      prompt: "What is the primary benefit of JWT refresh tokens stored in secure encrypted storage?",
      options: [
        "They allow limitless access without authentication",
        "Short-lived access tokens limit vulnerability windows while refresh tokens allow seamless regenerative handshakes",
        "They encrypt server database tables",
        "They replace HTTPS certificates",
      ],
      correctOptionIndex: 1,
      explanation: "Short-lived tokens prevent token replay attacks; refresh tokens re-authenticate without user friction.",
    },
  ];

  const startTest = (test: AssessmentTest) => {
    setActiveTest(test);
    setCurrentQIndex(0);
    setSelectedAnswers({});
    setTestResult(null);
  };

  const handleSelectOption = (optionIdx: number) => {
    const qId = sampleQuestions[currentQIndex].id;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optionIdx }));
  };

  const handleNextOrSubmit = () => {
    if (currentQIndex < sampleQuestions.length - 1) {
      setCurrentQIndex((prev) => prev + 1);
    } else {
      // Calculate score
      let correct = 0;
      sampleQuestions.forEach((q) => {
        if (selectedAnswers[q.id] === q.correctOptionIndex) {
          correct++;
        }
      });
      const pct = Math.round((correct / sampleQuestions.length) * 100);
      const earnedXP = activeTest?.xpReward || 150;

      setTestResult({ score: pct, xp: earnedXP });
      dispatch(incrementXPAward(earnedXP));
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? "#070b19" : "#f8fafc" }]}>
      <View style={[styles.headerCard, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={styles.subTitle}>STANDARDIZED BENCHMARKS</Text>
        <Text style={[styles.title, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Skill Assessment Center</Text>
        <Text style={styles.infoText}>
          Complete proctored tests to verify your technical ratings and earn VEGA XP for recruiter discovery.
        </Text>
      </View>

      {/* Tests Grid */}
      {tests.map((test) => (
        <View
          key={test.id}
          style={[
            styles.testCard,
            { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" },
          ]}
        >
          <View style={styles.testTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.testTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{test.title}</Text>
              <View style={styles.badgeRow}>
                <Badge label={test.category} variant="primary" size="sm" />
                <View style={{ marginLeft: 6 }}>
                  <Badge label={`+${test.xpReward} XP`} variant="xp" size="sm" />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.testMeta}>
            <Text style={styles.metaItem}>⏱ {test.durationMinutes} mins</Text>
            <Text style={styles.metaItem}>📝 {test.questionCount} Questions</Text>
            <Text style={styles.metaItem}>🎯 {test.difficulty}</Text>
          </View>

          <TouchableOpacity onPress={() => startTest(test)} style={styles.startBtn}>
            <Text style={styles.startBtnText}>BEGIN PROCTORED TEST</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Test Modal Session */}
      <Modal visible={!!activeTest} transparent animationType="slide" onRequestClose={() => setActiveTest(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? "#0c1224" : "#ffffff" }]}>
            {testResult ? (
              <View style={styles.resultContainer}>
                <Text style={styles.resultEmoji}>{testResult.score >= 70 ? "🎉" : "💪"}</Text>
                <Text style={[styles.resultTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>
                  {testResult.score >= 70 ? "Assessment Cleared!" : "Keep Practicing!"}
                </Text>
                <Text style={styles.scoreText}>{testResult.score}% Accuracy</Text>
                <Text style={styles.xpText}>+{testResult.xp} VEGA XP Credited to Wallet</Text>
                <TouchableOpacity onPress={() => setActiveTest(null)} style={styles.finishBtn}>
                  <Text style={styles.finishBtnText}>RETURN TO DASHBOARD</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.testHeader}>
                  <View>
                    <Text style={styles.testCatLabel}>{activeTest?.category}</Text>
                    <Text style={[styles.testName, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>
                      Question {currentQIndex + 1} of {sampleQuestions.length}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setActiveTest(null)}>
                    <Text style={styles.cancelText}>Quit</Text>
                  </TouchableOpacity>
                </View>

                {/* Question Prompt */}
                <View style={styles.questionBox}>
                  <Text style={styles.questionText}>{sampleQuestions[currentQIndex]?.prompt}</Text>
                </View>

                {/* Options List */}
                {sampleQuestions[currentQIndex]?.options.map((opt, idx) => {
                  const qId = sampleQuestions[currentQIndex].id;
                  const isSelected = selectedAnswers[qId] === idx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.optionBtn,
                        isSelected
                          ? { backgroundColor: "#312e81", borderColor: "#6366f1" }
                          : { backgroundColor: isDark ? "#111827" : "#f1f5f9", borderColor: isDark ? "#1e293b" : "#e2e8f0" },
                      ]}
                      onPress={() => handleSelectOption(idx)}
                    >
                      <Text style={[styles.optionIndex, isSelected ? { color: "#818cf8" } : { color: "#64748b" }]}>
                        {String.fromCharCode(65 + idx)}
                      </Text>
                      <Text style={[styles.optionText, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={styles.nextBtn}
                  onPress={handleNextOrSubmit}
                  disabled={selectedAnswers[sampleQuestions[currentQIndex]?.id] === undefined}
                >
                  <Text style={styles.nextBtnText}>
                    {currentQIndex === sampleQuestions.length - 1 ? "FINALIZE & SUBMIT TEST" : "NEXT QUESTION →"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  },
  testCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  testTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  testMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  metaItem: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "700",
  },
  startBtn: {
    backgroundColor: "#6366f1",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  startBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    maxHeight: "90%",
  },
  testHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  testCatLabel: {
    fontSize: 10,
    color: "#6366f1",
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  testName: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  cancelText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "800",
  },
  questionBox: {
    backgroundColor: "#1e293b",
    padding: 18,
    borderRadius: 14,
    marginBottom: 16,
  },
  questionText: {
    color: "#f1f5f9",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  optionIndex: {
    fontSize: 14,
    fontWeight: "900",
    marginRight: 12,
    width: 16,
  },
  optionText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  nextBtn: {
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  nextBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  resultContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  resultEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 36,
    fontWeight: "900",
    color: "#10b981",
    marginBottom: 6,
  },
  xpText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#c084fc",
    marginBottom: 24,
  },
  finishBtn: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  finishBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
