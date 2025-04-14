import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  TouchableOpacity,
} from "react-native";
import { StyleSheet } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useHonoClient } from "@/context/HonoProvider";
import { Database } from "@jpvnk/infynii-shared";

type TSearchResult = Database["public"]["Tables"]["searches_results"]["Row"];

export default function SearchResultScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const client = useHonoClient();
  const [result, setResult] = useState<TSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("resultId", id);
    const fetchSearchResult = async () => {
      if (!id) {
        setError("Missing search ID or result ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Use the client's base URL with the endpoint path
        const response = await client.api.v1["search-results"][":id"].$get({
          param: { id: id },
        });

        if (!response.ok) {
          // Handle error response
          try {
            const errorData = await response.json();
            throw new Error(
              (errorData as any).error || "Failed to fetch search result"
            );
          } catch {
            throw new Error("Failed to fetch search result");
          }
        }

        const data =
          (await response.json()) as Database["public"]["Tables"]["searches_results"]["Row"];
        setResult(data);
      } catch (err) {
        console.error("Error fetching search result:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load search result"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResult();
  }, [id, client]);

  const handleOpenUrl = async () => {
    if (!result?.url) {
      return;
    }

    try {
      const supported = await Linking.canOpenURL(result.url);
      if (supported) {
        await Linking.openURL(result.url);
      } else {
        Alert.alert("Error", "Cannot open this URL");
      }
    } catch (error) {
      console.error("Error opening URL:", error);
      Alert.alert("Error", "Failed to open URL");
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading search result...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Search result not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title:
            result.title?.length && result.title?.length > 30
              ? `${result.title?.substring(0, 30)}...`
              : result.title ?? "",
          headerBackTitle: "Back",
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{result.title ?? ""}</Text>
          <TouchableOpacity style={styles.urlButton} onPress={handleOpenUrl}>
            <Text style={styles.urlText}>{result.url ?? ""}</Text>
          </TouchableOpacity>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Relevance Score:</Text>
            <Text style={styles.scoreValue}>
              {(result.score ?? 0 * 100).toFixed(1)}%
            </Text>
          </View>
        </View>

        <View style={styles.contentSection}>
          <Text style={styles.sectionTitle}>Content</Text>
          <Text style={styles.content}>{result.content ?? ""}</Text>
        </View>

        <TouchableOpacity style={styles.openButton} onPress={handleOpenUrl}>
          <Text style={styles.openButtonText}>Open Full Article</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentContainer: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    fontSize: 16,
    color: "#FF3B30",
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginBottom: 12,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 32,
  },
  urlButton: {
    marginBottom: 8,
  },
  urlText: {
    fontSize: 14,
    color: "#007AFF",
    textDecorationLine: "underline",
    fontFamily: "Inter_400Regular",
  },
  queryText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    marginBottom: 12,
    fontFamily: "Inter_400Regular",
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    padding: 8,
    borderRadius: 8,
  },
  scoreLabel: {
    fontSize: 14,
    color: "#666",
    marginRight: 8,
    fontFamily: "Inter_400Regular",
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
    fontFamily: "Inter_600SemiBold",
  },
  contentSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 12,
    fontFamily: "Inter_600SemiBold",
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    color: "#1A1A1A",
    textAlign: "justify",
    fontFamily: "Inter_400Regular",
  },
  openButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  openButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
