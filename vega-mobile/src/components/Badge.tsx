import React from "react";
import { StyleSheet, View, Text } from "react-native";

interface BadgeProps {
  label: string;
  variant?: "primary" | "success" | "warning" | "danger" | "neutral" | "xp";
  size?: "sm" | "md";
}

export function Badge({ label, variant = "primary", size = "sm" }: BadgeProps) {
  const getBadgeStyle = () => {
    switch (variant) {
      case "success":
        return { bg: "#064e3b", text: "#34d399", border: "#059669" };
      case "warning":
        return { bg: "#451a03", text: "#fbbf24", border: "#d97706" };
      case "danger":
        return { bg: "#450a0a", text: "#f87171", border: "#dc2626" };
      case "neutral":
        return { bg: "#1e293b", text: "#94a3b8", border: "#334155" };
      case "xp":
        return { bg: "#2e1065", text: "#c084fc", border: "#7c3aed" };
      case "primary":
      default:
        return { bg: "#1e1b4b", text: "#818cf8", border: "#4f46e5" };
    }
  };

  const styleConfig = getBadgeStyle();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: styleConfig.bg,
          borderColor: styleConfig.border,
          paddingHorizontal: size === "sm" ? 8 : 12,
          paddingVertical: size === "sm" ? 3 : 5,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: styleConfig.text,
            fontSize: size === "sm" ? 10 : 12,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
