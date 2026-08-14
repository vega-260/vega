import React, { useEffect } from "react";
import { StatusBar, SafeAreaView, StyleSheet, useColorScheme } from "react-native";
import { Provider } from "react-redux";
import { store } from "./src/store";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { syncOfflineQueue } from "./src/services/api";

export default function App() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  useEffect(() => {
    // Attempt background sync of any buffered offline actions on app launch
    syncOfflineQueue();
  }, []);

  return (
    <Provider store={store}>
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? "#070b19" : "#ffffff" }]}>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={isDark ? "#070b19" : "#ffffff"}
        />
        <AppNavigator />
      </SafeAreaView>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
