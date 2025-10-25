import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
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
import { auth, db } from "../firebase/firebaseConfig";

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ✅ Google Sign-Up setup
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "80849480678-o0o9fat05oll6ldhnspcj5ki0htjlo8a.apps.googleusercontent.com",
    webClientId: "80849480678-nte2gc605npivdtmg70nh3piqu6vhrfp.apps.googleusercontent.com",
  });

  useEffect(() => {
    console.log("📱 Google Auth Response:", response);
    
    if (response?.type === "success") {
      console.log("✅ Response params:", response.params);
      const { id_token } = response.params;
      // ... rest of code
    } else if (response?.type === "error") {
      console.error("❌ Google Auth Error:", response.error);
      Alert.alert("Google Sign-In Error", response.error?.message || "Unknown error");
    } else if (response?.type === "cancel") {
      console.log("⚠️ User cancelled Google sign-in");
    }
  }, [response]);

  // ✅ Email/Password sign-up
  const handleSignUp = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Missing info", "Please fill out all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });

      // Save user to Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name,
        email,
        createdAt: serverTimestamp(),
        role: "user",
      });

      await signOut(auth);
      Alert.alert("Account created!", "Please sign in to continue.", [
        { text: "OK", onPress: () => router.replace("/signin") },
      ]);
    } catch (error: any) {
      Alert.alert("Sign up failed", error.message);
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.title}>Create your account</Text>

        {/* Inputs */}
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#888"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
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
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.eyeText}>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
          </TouchableOpacity>
        </View>

        {/* Confirm Password input with toggle */}
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Confirm Password"
            placeholderTextColor="#888"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Text style={styles.eyeText}>{showConfirmPassword ? "👁️" : "👁️‍🗨️"}</Text>
          </TouchableOpacity>
        </View>

        {/* Sign up button */}
        <TouchableOpacity
          style={[styles.signUpBtn, loading && { opacity: 0.6 }]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signUpText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.divider} />
        </View>

        {/* Google sign up */}
        <TouchableOpacity style={styles.googleBtn} onPress={() => promptAsync()}>
          <Image
            source={{
              uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/1200px-Google_%22G%22_logo.svg.png",
            }}
            style={styles.googleIcon}
          />
          <Text style={styles.googleText}>Sign up with Google</Text>
        </TouchableOpacity>

        {/* Already have account */}
        <Text style={styles.loginText}>
          Already have an account?{" "}
          <Text style={styles.loginLink} onPress={() => router.push("/signin")}>
            Sign in
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
  eyeText: { fontSize: 20 },
  signUpBtn: {
    backgroundColor: "#243D8F",
    paddingVertical: 12,
    borderRadius: 25,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  signUpText: { color: "white", fontWeight: "600", fontSize: 16 },
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
  loginText: { color: "#555" },
  loginLink: { color: "#243D8F", fontWeight: "600" },
});
