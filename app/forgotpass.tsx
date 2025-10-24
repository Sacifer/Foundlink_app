import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { auth, db } from "../firebase/firebaseConfig";

export default function ForgotPassScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleResetPassword = async () => {
    setError("");
    setMessage("");
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }

    try {
      setLoading(true);

      // ✅ Check if user exists in Firestore
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", trimmedEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("No user found with this email.");
        setLoading(false);
        return;
      }

      // ✅ Send reset email
      await sendPasswordResetEmail(auth, trimmedEmail);
      setMessage("Reset link sent to your email.");
      setEmail("");
    } catch (err: any) {
      console.error("Forgot password error:", err);
      if (err.code === "auth/user-not-found") {
        setError("No user found with this email.");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email format.");
      } else {
        setError("Failed to send reset email. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Title */}
        <Text style={styles.title}>Forgot Password</Text>

        {/* Input */}
        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        {/* Button */}
        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.6 }]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send reset link</Text>
          )}
        </TouchableOpacity>

        {/* Feedback */}
        {message ? <Text style={styles.successText}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Back to sign in */}
        <Text style={styles.backText}>
          Remember your password?{" "}
          <Text
            style={styles.linkText}
            onPress={() => router.push("/signin")}
          >
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
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#243D8F",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    height: 45,
    borderWidth: 1.5,
    borderColor: "#243D8F",
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#243D8F",
    paddingVertical: 12,
    borderRadius: 25,
    width: "100%",
    alignItems: "center",
    marginBottom: 15,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  successText: {
    color: "green",
    marginTop: 10,
    textAlign: "center",
  },
  errorText: {
    color: "red",
    marginTop: 10,
    textAlign: "center",
  },
  backText: {
    marginTop: 20,
    color: "#555",
    fontSize: 14,
  },
  linkText: {
    color: "#243D8F",
    fontWeight: "600",
  },
});
