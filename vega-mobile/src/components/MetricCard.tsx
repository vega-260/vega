import React from "react";
import { StyleSheet, View, Text, useColorScheme } from "react-native";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  accentColor?: string;
  icon?: string;
}

export function MetricCard({ label, value, subtitle, accentColor = "#6366f1", icon }: MetricCardProps) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? "#0c1224" : "#ffffff",
          borderColor: isDark ? "#1e293b" : "#e2e8f0",
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: isDark ? "#94a3b8" : "#64748b" }]}>{label}</Text>
        {icon && <Text style={styles.icon}>{icon}</Text>}
      </View>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: isDark ? "#64748b" : "#94a3b8" }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  icon: {
    fontSize: 14,
  },
  value: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
});
