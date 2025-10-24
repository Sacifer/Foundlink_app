import { Ionicons } from "@expo/vector-icons";
import type { DrawerNavigationOptions } from "@react-navigation/drawer";
import { useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { signOut } from "firebase/auth";
import React from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../firebase/firebaseConfig";

export default function DrawerLayout() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/signin");
    } catch (error: any) {
      Alert.alert("Logout Failed", error.message);
    }
  };

  return (
    <Drawer
      screenOptions={{
        headerShown: true,
        drawerType: "slide",
        drawerPosition: "left",
        swipeEnabled: true,
        drawerActiveTintColor: "#007AFF",
      }}
      drawerContent={() => (
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            {/* Home */}
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => router.push("/(tabs)")}
            >
              <Ionicons name="home-outline" size={22} color="#007AFF" />
              <Text style={styles.drawerLabel}>Home</Text>
            </TouchableOpacity>

            {/* Browse */}
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => router.push("/(tabs)/browse")}
            >
              <Ionicons name="search-outline" size={22} color="#007AFF" />
              <Text style={styles.drawerLabel}>Browse Items</Text>
            </TouchableOpacity>

            {/* Report */}
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => router.push("/(tabs)/report")}
            >
              <Ionicons name="create-outline" size={22} color="#007AFF" />
              <Text style={styles.drawerLabel}>Report Item</Text>
            </TouchableOpacity>
            
            {/* Edit Profile */}
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => router.push("/(tabs)/edit-profile")}
            >
              <Ionicons name="person-outline" size={22} color="#007AFF" />
              <Text style={styles.drawerLabel}>Edit Profile</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Logout */}
            <TouchableOpacity
              onPress={handleLogout}
              style={[styles.drawerItem, { marginTop: 10 }]}
            >
              <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
              <Text style={[styles.drawerLabel, styles.logoutLabel]}>
                Logout
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      )}
    >
      {/* Screens */}
      <Drawer.Screen
        name="index"
        options={{
          drawerLabel: "Home",
          title: "Home",
        } as DrawerNavigationOptions}
      />
      <Drawer.Screen
        name="browse"
        options={{
          drawerLabel: "Browse Items",
          title: "Browse Items",
        } as DrawerNavigationOptions}
      />
      <Drawer.Screen
        name="report"
        options={{
          drawerLabel: "Report Item",
          title: "Report Item",
        } as DrawerNavigationOptions}
      />
      <Drawer.Screen
        name="edit-profile"
        options={{
          drawerLabel: "Edit Profile",
          title: "Edit Profile",
        } as DrawerNavigationOptions}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContainer: {
    paddingTop: 40,
    paddingHorizontal: 10,
  },
  drawerItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  drawerLabel: {
    marginLeft: 12,
    fontSize: 16,
    color: "#000",
  },
  logoutLabel: {
    color: "#FF3B30",
    fontWeight: "bold",
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    marginVertical: 25,
  },
});