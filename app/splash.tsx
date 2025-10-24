// /app/splash.tsx
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

export default function Splash() {
  const router = useRouter();
  const [progress] = useState(new Animated.Value(0));

  useEffect(() => {
    // Animate progress bar over 3 seconds
    Animated.timing(progress, {
      toValue: 1,
      duration: 3000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(() => {
      router.replace("/signin"); // Navigate to sign-in after 3 seconds
    });
  }, []);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/logo.png")} // ✅ your custom logo
        style={styles.logo}
      />
      <View style={styles.barContainer}>
        <Animated.View style={[styles.progressBar, { width }]} />
      </View>
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff", // White background
  },
  logo: {
    width: 180,
    height: 180,
    resizeMode: "contain",
    marginBottom: 40,
  },
  barContainer: {
    width: "70%",
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#007AFF", // FoundLink blue
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "500",
  },
});
