import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import type { TTavilySearchResult } from "@jpvnk/infynii-shared";
import { Eye } from "lucide-react-native";

type TSearchResultCardProps = {
  result: TTavilySearchResult;
  isLast: boolean;
  searchId?: string;
};

export const SearchResultCard = ({
  result,
  isLast,
  searchId,
}: TSearchResultCardProps) => {
  const router = useRouter();
  console.log("result", result);
  console.log("searchId", searchId);
  return (
    <View style={[styles.searchResult, isLast && styles.lastSearchResult]}>
      <Text style={styles.searchResultTitle} numberOfLines={2}>
        {result.title}
      </Text>
      <Text style={styles.searchResultUrl} numberOfLines={1}>
        {result.url}
      </Text>
      <Text style={styles.searchResultPreview} numberOfLines={3}>
        {result.preview}
      </Text>
      <View style={styles.actionButtonContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (searchId && result.id) {
              router.push(`/searchresult?id=${result.id}`);
            } else {
              console.warn("Missing searchId or result.id for navigation");
            }
          }}
        >
          <Eye size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Show more</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  searchResult: {
    width: 280,
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: "#F8F8F8",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  lastSearchResult: {
    marginRight: 0,
  },
  searchResultTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  searchResultUrl: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#666",
    marginBottom: 8,
  },
  searchResultPreview: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#333",
    lineHeight: 20,
    marginBottom: 8,
  },
  actionButtonContainer: {
    marginTop: 12,
  },
  actionButton: {
    width: "100%",
    flexDirection: "row",
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginLeft: 5,
  },
});
