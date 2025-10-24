import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, UserCredential } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../firebase/firebaseConfig";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ✅ Google Sign-In setup
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: "80849480678-nte2gXXXXXXX.apps.googleusercontent.com",
    androidClientId: "80849480678-47hjsulu1oireqj91g067ehnqm4p2gka.apps.googleusercontent.com",
    webClientId: "80849480678-nte2gXXXXXXX.apps.googleusercontent.com",
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .then(() => {
          console.log("✅ Google sign-in successful!");
          router.replace("/(tabs)");
        })
        .catch((err) => {
          console.error("❌ Google sign-in error:", err);
          Alert.alert("Google sign-in failed", err.message);
        });
    }
  }, [response]);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Missing info", "Please fill out both fields.");
      return;
    }

    try {
      setLoading(true);
      console.log("🔐 Attempting sign in...");
      console.log("📧 Email:", email);

      const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("✅ Sign in successful!");
      console.log("👤 User:", userCredential.user.email ?? "No email");

      router.replace("/(tabs)");
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error("❌ Firebase error:", err);

      let errorMessage = err.message || "Something went wrong";

      if (err.code === "auth/network-request-failed") {
        errorMessage =
          "Network error. Please check:\n• WiFi connection\n• Both devices on same network\n• Firewall settings";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email format";
      } else if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Incorrect password";
      } else if (err.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password";
      }

      Alert.alert("Login failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Google Sign-In handler
  const handleGoogleSignIn = async () => {
    await promptAsync();
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Logo */}
        <Text style={styles.logo}>
          <Text style={styles.logoBlue}>Found</Text>
          <Text style={styles.logoYellow}>Link</Text>
        </Text>

        {/* Title */}
        <Text style={styles.title}>Sign in to your account</Text>

        {/* Inputs */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Password input with toggle */}
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.eyeText}>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
          </TouchableOpacity>
        </View>

        {/* Forgot password */}
        <TouchableOpacity onPress={() => router.push("/forgotpass" as any)}>
          <Text style={styles.forgot}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Sign in button */}
        <TouchableOpacity
          style={[styles.signInBtn, loading && { opacity: 0.6 }]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signInText}>Sign in</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.divider} />
        </View>

        {/* Google sign in */}
        <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn}>
          <Image
            source={{
              uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/1200px-Google_%22G%22_logo.svg.png",
            }}
            style={styles.googleIcon}
          />
          <Text style={styles.googleText}>Sign in with Google</Text>
        </TouchableOpacity>

        {/* Sign up */}
        <Text style={styles.signupText}>
          Don't have an account?{" "}
          <Text style={styles.signupLink} onPress={() => router.push("/signup")}>
            Sign up
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#305CDE",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  logo: { fontSize: 28, fontWeight: "700", marginBottom: 10 },
  logoBlue: { color: "#243D8F" },
  logoYellow: { color: "#EFB810" },
  title: { fontSize: 16, fontWeight: "600", marginBottom: 15, color: "#243D8F" },
  input: {
    width: "100%",
    height: 45,
    borderWidth: 1.5,
    borderColor: "#243D8F",
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  passwordContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#243D8F",
    borderRadius: 10,
    marginBottom: 12,
    height: 45,
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 15,
  },
  eyeIcon: {
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  eyeText: {
    fontSize: 20,
  },
  forgot: {
    alignSelf: "flex-end",
    color: "#243D8F",
    marginBottom: 15,
    fontWeight: "500",
  },
  signInBtn: {
    backgroundColor: "#243D8F",
    paddingVertical: 12,
    borderRadius: 25,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  signInText: { color: "white", fontWeight: "600", fontSize: 16 },
  dividerContainer: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  divider: { flex: 1, height: 1, backgroundColor: "#ccc" },
  orText: { marginHorizontal: 10, color: "#555" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  googleIcon: { width: 20, height: 20, marginRight: 8 },
  googleText: { color: "#333" },
  signupText: { color: "#555" },
  signupLink: { color: "#243D8F", fontWeight: "600" },
});
