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
import { RootState, incrementXPAward } from "../store";
import { Post } from "../types";
import { Badge } from "../components/Badge";

export function CommunityScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const dispatch = useDispatch();

  const { dashboardData } = useSelector((state: RootState) => state.student);
  const currentXP = dashboardData?.xpBalance || 450;

  const [filter, setFilter] = useState<"ALL" | "INTERVIEW_EXPERIENCE" | "TIPS">("ALL");
  const [posts, setPosts] = useState<Post[]>([
    {
      id: 1,
      authorName: "Ananya Sharma",
      authorRole: "Placed at Google Cloud (2026 Batch)",
      title: "How I cracked Google Cloud L4: System Design & DSA Frameworks",
      content:
        "Key takeaways: Focus heavily on message queue decoupling (BullMQ/Kafka patterns) and distributed state caching in Redis. In the coding round, explain time complexity before typing any code.",
      tags: ["Placement Story", "Google", "System Design"],
      likesCount: 142,
      commentsCount: 28,
      isLiked: false,
      isUnlocked: true,
      createdAt: "2h ago",
    },
    {
      id: 2,
      authorName: "Rahul Deshmukh",
      authorRole: "Placed at Razorpay (SDE-1)",
      title: "🔒 Razorpay Round 2 Deep-Dive: 15 Live Interview Questions & Code Solutions",
      content:
        "This exclusive question bank covers the exact 15 coding questions and concurrency scenarios asked in the technical rounds for 2026 campus drives.",
      tags: ["Interview Questions", "Razorpay", "Unlocked with XP"],
      likesCount: 98,
      commentsCount: 14,
      isLiked: false,
      isUnlocked: false,
      xpUnlockCost: 50,
      createdAt: "1d ago",
    },
    {
      id: 3,
      authorName: "Pooja Kulkarni",
      authorRole: "Placed at Microsoft IDC",
      title: "Top 10 Dynamic Programming Patterns you MUST know before placement season",
      content:
        "1. 0/1 Knapsack variations\n2. Longest Common Subsequence\n3. Matrix Chain Multiplication\n4. Kadane's Algorithm for max subarray.",
      tags: ["Coding Tips", "DSA", "Microsoft"],
      likesCount: 210,
      commentsCount: 45,
      isLiked: true,
      isUnlocked: true,
      createdAt: "2d ago",
    },
  ]);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleLike = (postId: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1 }
          : p
      )
    );
  };

  const handleUnlockWithXP = (post: Post) => {
    const cost = post.xpUnlockCost || 50;
    if (currentXP < cost) {
      Alert.alert("Insufficient VEGA XP", `You need ${cost} XP to unlock this question bank. Complete more mock tests to earn XP!`);
      return;
    }

    Alert.alert(
      "Unlock with XP 🪙",
      `Deduct ${cost} XP from your wallet to unlock this verified placement guide?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Unlock",
          onPress: () => {
            dispatch(incrementXPAward(-cost));
            setPosts((prev) =>
              prev.map((p) => (p.id === post.id ? { ...p, isUnlocked: true } : p))
            );
            Alert.alert("Unlocked Successfully! 🔓", "Full question breakdown and solutions now visible.");
          },
        },
      ]
    );
  };

  const handleCreatePost = () => {
    if (!newTitle || !newContent) {
      Alert.alert("Incomplete Post", "Please provide a title and content body.");
      return;
    }

    const newPost: Post = {
      id: Date.now(),
      authorName: "You (Verified Student)",
      authorRole: "Computer Engineering (2026 Batch)",
      title: newTitle,
      content: newContent,
      tags: ["Student Post", "Discussion"],
      likesCount: 1,
      commentsCount: 0,
      isLiked: true,
      isUnlocked: true,
      createdAt: "Just now",
    };

    setPosts([newPost, ...posts]);
    setNewTitle("");
    setNewContent("");
    setShowCreateModal(false);
    dispatch(incrementXPAward(25)); // Earn XP for contributing
    Alert.alert("Post Published! 🚀", "Earned +25 XP for contributing to the student network.");
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? "#070b19" : "#f8fafc" }]}>
      <View style={[styles.headerCard, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
        <Text style={styles.subTitle}>KNOWLEDGE VAULT</Text>
        <Text style={[styles.title, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Campus Peer Community</Text>
        <Text style={styles.infoText}>
          Read verified placement debriefs, access company-specific question banks, and exchange interview strategies.
        </Text>

        <TouchableOpacity onPress={() => setShowCreateModal(!showCreateModal)} style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>{showCreateModal ? "CANCEL" : "+ SHARE PLACEMENT EXPERIENCE"}</Text>
        </TouchableOpacity>
      </View>

      {/* Create Post Expandable Form */}
      {showCreateModal && (
        <View style={[styles.createCard, { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
          <Text style={styles.createLabel}>Post Headline</Text>
          <TextInput
            style={[styles.input, { color: isDark ? "#f1f5f9" : "#0f172a", backgroundColor: isDark ? "#070b19" : "#f1f5f9" }]}
            placeholder="e.g. My TCS Digital / Amazon SDE-1 Interview Experience"
            placeholderTextColor="#64748b"
            value={newTitle}
            onChangeText={setNewTitle}
          />

          <Text style={styles.createLabel}>Content & Technical Insights</Text>
          <TextInput
            style={[styles.inputArea, { color: isDark ? "#f1f5f9" : "#0f172a", backgroundColor: isDark ? "#070b19" : "#f1f5f9" }]}
            placeholder="Describe the rounds, specific questions asked, behavioral pointers, and preparation tips..."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={4}
            value={newContent}
            onChangeText={setNewContent}
          />

          <TouchableOpacity onPress={handleCreatePost} style={styles.publishBtn}>
            <Text style={styles.publishBtnText}>PUBLISH TO COMMUNITY (+25 XP)</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Feed Posts */}
      {posts.map((post) => (
        <View
          key={post.id}
          style={[
            styles.postCard,
            { backgroundColor: isDark ? "#0c1224" : "#ffffff", borderColor: isDark ? "#1e293b" : "#e2e8f0" },
          ]}
        >
          <View style={styles.authorRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{post.authorName[0]}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.authorName, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{post.authorName}</Text>
              <Text style={styles.authorRole}>{post.authorRole}</Text>
            </View>
            <Text style={styles.timeText}>{post.createdAt}</Text>
          </View>

          <Text style={[styles.postTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{post.title}</Text>

          {post.isUnlocked ? (
            <Text style={styles.postContent}>{post.content}</Text>
          ) : (
            <View style={styles.lockedContainer}>
              <Text style={styles.lockedText}>🔒 Content locked. Exclusive verified interview questions bank.</Text>
              <TouchableOpacity onPress={() => handleUnlockWithXP(post)} style={styles.unlockBtn}>
                <Text style={styles.unlockBtnText}>UNLOCK WITH {post.xpUnlockCost || 50} VEGA XP</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.tagsRow}>
            {post.tags.map((tag, idx) => (
              <View key={idx} style={{ marginRight: 6 }}>
                <Badge label={tag} variant="neutral" size="sm" />
              </View>
            ))}
          </View>

          <View style={styles.footerRow}>
            <TouchableOpacity onPress={() => handleLike(post.id)} style={styles.interactionBtn}>
              <Text style={styles.interactEmoji}>{post.isLiked ? "❤️" : "🤍"}</Text>
              <Text style={[styles.interactText, post.isLiked && { color: "#ef4444", fontWeight: "800" }]}>
                {post.likesCount} Helpful
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.interactionBtn}>
              <Text style={styles.interactEmoji}>💬</Text>
              <Text style={styles.interactText}>{post.commentsCount} Comments</Text>
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
  shareBtn: {
    backgroundColor: "#6366f1",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  shareBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  createCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  createLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
  },
  inputArea: {
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: "600",
    textAlignVertical: "top",
    minHeight: 90,
    marginBottom: 16,
  },
  publishBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  publishBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  postCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 14,
  },
  authorName: {
    fontSize: 13,
    fontWeight: "800",
  },
  authorRole: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  timeText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  postTitle: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 8,
  },
  postContent: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 20,
    fontWeight: "500",
    marginBottom: 14,
  },
  lockedContainer: {
    backgroundColor: "#1e1b4b",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  lockedText: {
    color: "#c7d2fe",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  unlockBtn: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unlockBtnText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  tagsRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  footerRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingTop: 12,
  },
  interactionBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  interactEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  interactText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
});
