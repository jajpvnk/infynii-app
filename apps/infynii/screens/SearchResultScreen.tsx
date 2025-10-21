import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { StyleSheet } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useHonoClient } from "@/context/HonoProvider";
import { Database, type TSummarizeResponse } from "@jpvnk/infynii-shared";
import { processNDJSONResponse } from "@/helpers/ndjson";
import { makeid } from "@/helpers";

const ANIMATION_INTERVAL = 100;

type TSearchResult = Database["public"]["Tables"]["searches_results"]["Row"];

type TSummarization = {
  status?: TSummarizeResponse["status"];
  resultId?: TSummarizeResponse["resultId"];
  messages?: TSummarizeResponse["messages"];
};

type TScreenState = {
  result: TSearchResult | null;
  isLoadingResult: boolean;
  resultError: string | null;
  summarization: TSummarization | undefined;
  isSummarizing: boolean;
  summarizationError: string | null;
};

export default function SearchResultScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const client = useHonoClient();

  // Streaming functionality uses shared NDJSON helper

  // Combined state for search result and summarization
  const [state, setState] = useState<TScreenState>({
    result: null,
    isLoadingResult: true,
    resultError: null,
    summarization: undefined,
    isSummarizing: false,
    summarizationError: null,
  });

  const [animating, setAnimating] = useState({
    displayedText: "",
    isAnimating: false,
  });
  const currentWordIndex = useRef(0);
  const previousTextLengthRef = useRef(0);
  const fullText = useMemo(() => {
    return state.summarization?.messages
      ? state.summarization.messages
          .map((message) => message.content)
          .join("\n")
      : "";
  }, [state.summarization?.messages]);

  const words = useMemo(() => fullText.split(" "), [fullText]);

  const updateSummarization = useCallback((response: TSummarizeResponse) => {
    setState((prev) => {
      return {
        ...prev,
        summarization: {
          status: response.status,
          resultId: response.resultId,
          messages: response.messages,
        },
      };
    });
  }, []);

  const summarizeResult = useCallback(
    async (idToUse: string) => {
      setState((prev) => ({
        ...prev,
        isSummarizing: true,
        summarizationError: null,
      }));

      const response = await client.api.v1["search-results"][
        ":id"
      ].summarize.$post({
        param: { id: idToUse },
      });

      await processNDJSONResponse<TSummarizeResponse>(
        response,
        updateSummarization,
        (errorMessage) => {
          setState((prev) => ({
            ...prev,
            summarizationError: errorMessage,
            isSummarizing: false,
          }));
        },
        () => {
          setState((prev) => ({
            ...prev,
            isSummarizing: false,
          }));
        }
      );
    },
    [client, updateSummarization]
  );

  const saveSummary = useCallback(
    async (id: string, fullText: string) => {
      try {
        const resp = await client.api.v1["search-results"][
          ":id"
        ].summary.$patch({
          param: { id: id },
          json: { summary: fullText },
        });
        if (!resp.ok) {
          console.error("Failed to save summary");
          return;
        }
      } catch (error) {
        console.error("Failed to save summary", error);
      }
    },
    [client]
  );

  // Animate the text
  useEffect(() => {
    if (!animating.isAnimating) {
      return;
    }
    const interval = setInterval(() => {
      currentWordIndex.current++;
      if (currentWordIndex.current >= words.length) {
        setAnimating((prev) => ({ ...prev, isAnimating: false }));
        clearInterval(interval);
      }
      setAnimating((prev) => ({
        ...prev,
        displayedText: words.slice(0, currentWordIndex.current).join(" "),
      }));
    }, ANIMATION_INTERVAL);
    return () => clearInterval(interval);
  }, [animating.isAnimating, words]);

  // Start animation when new messages arrive or content length changes
  useEffect(() => {
    if (!fullText) {
      setAnimating({ displayedText: "", isAnimating: false });
      currentWordIndex.current = 0;
      previousTextLengthRef.current = 0;
      return;
    }

    const currentLength = fullText.length;
    const previousLength = previousTextLengthRef.current;

    // If text is completely new (previousLength was 0 or text shrunk), restart from beginning
    if (previousLength === 0 || currentLength < previousLength) {
      // New summarization or text was cleared - restart animation
      currentWordIndex.current = 0;
      setAnimating({ displayedText: "", isAnimating: true });
    }

    // If text grew (streaming), animation will automatically continue with updated words array
    // We don't need to do anything here - the animation effect handles the new words
    previousTextLengthRef.current = currentLength;
  }, [fullText]);

  // Save summary when summarization is complete
  useEffect(() => {
    if (!id) {
      return;
    }
    if (state.isSummarizing || !state.summarization?.messages) {
      return;
    }
    const fullText = state.summarization.messages
      .map((message) => message.content)
      .join("\n");

    if (fullText) {
      saveSummary(id, fullText);
    }
  }, [state.isSummarizing, state.summarization?.messages, id, saveSummary]);

  // Fetch search result
  useEffect(() => {
    (async () => {
      setState((prev) => ({
        ...prev,
        isLoadingResult: true,
        resultError: null,
      }));

      try {
        const resp = await client.api.v1["search-results"][":id"].$get({
          param: { id: id },
        });

        if (!resp.ok) {
          setState((prev) => ({
            ...prev,
            resultError: "Failed to fetch search result",
            isLoadingResult: false,
          }));
          return;
        }

        const searchResult = (await resp.json()) as TSearchResult;
        if (!searchResult) {
          setState((prev) => ({
            ...prev,
            resultError: "Failed to fetch search result",
            isLoadingResult: false,
          }));
          return;
        }

        setState((prev) => ({
          ...prev,
          result: searchResult,
          isLoadingResult: false,
        }));

        // Check if summary already exists
        if (searchResult.summary) {
          const summaryText = searchResult.summary ?? "";
          const summaryWords = summaryText.split(" ");

          // Set current word index to the end so animation doesn't restart
          currentWordIndex.current = summaryWords.length;
          previousTextLengthRef.current = summaryText.length;

          // Display full text immediately without animation
          setAnimating({
            isAnimating: false,
            displayedText: summaryText,
          });

          setState((prev) => ({
            ...prev,
            summarization: {
              status: "finished",
              resultId: searchResult.id,
              messages: [
                {
                  id: makeid(6),
                  type: "ai",
                  content: summaryText,
                  timestamp: new Date().toUTCString(),
                },
              ],
            },
          }));
        } else {
          // Start new summarization if no summary exists
          summarizeResult(searchResult.id);
        }
      } catch (e) {
        console.error("Failed to fetch search result", e);
        setState((prev) => ({
          ...prev,
          resultError: "Failed to fetch search result",
          isLoadingResult: false,
        }));
      }
    })();
  }, [id, client, summarizeResult]);

  const retrySummarization = useCallback(() => {
    summarizeResult(id);
  }, [summarizeResult, id]);

  const handleOpenUrl = async () => {
    if (!state.result?.url) {
      return;
    }

    const url = state.result.url;
    if (!url) {
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(url, {
        enableDefaultShareMenuItem: true,
        dismissButtonStyle: "close",
        presentationStyle:
          WebBrowser.WebBrowserPresentationStyle?.PAGE_SHEET ?? 0,
        showTitle: true,
      });
    } catch (error) {
      console.error("Error opening URL:", error);
      Alert.alert("Error", "Failed to open URL");
    }
  };


  if (state.isLoadingResult) {
    return (
      <>
        <Stack.Screen
          options={{
            headerBackTitle: "Back",
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </>
    );
  }

  if (state.resultError) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Error",
            headerBackTitle: "Back",
          }}
        />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{state.resultError}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title:
            state.result?.title?.length && state.result?.title?.length > 30
              ? `${state.result.title?.substring(0, 30)}...`
              : state.result?.title ?? "",
          headerBackTitle: "Back",
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>{state.result?.title ?? ""}</Text>
          <TouchableOpacity style={styles.urlButton} onPress={handleOpenUrl}>
            <Text style={styles.urlText}>{state.result?.url ?? ""}</Text>
          </TouchableOpacity>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Relevance Score:</Text>
            <Text style={styles.scoreValue}>
              {((state.result?.score ?? 0) * 100).toFixed(1)}%
            </Text>
          </View>

          {/* Open Article Button */}
          <TouchableOpacity style={styles.openButton} onPress={handleOpenUrl}>
            <Text style={styles.openButtonText}>Open Full Article</Text>
          </TouchableOpacity>
        </View>

        {/* Content Summary Section */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Content Summary</Text>

          {state.isSummarizing && !state.summarization?.messages && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingText}>Generating summary...</Text>
            </View>
          )}

          {state.summarizationError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                Failed to generate summary: {state.summarizationError}
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={retrySummarization}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {state.summarization?.messages && (
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryContent}>
                {animating.displayedText}
              </Text>
            </View>
          )}

          {state.isSummarizing && state.summarization?.messages && (
            <View style={styles.streamingIndicator}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          )}
        </View>
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
    paddingBottom: 20,
  },
  headerSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  loadingText: {
    paddingLeft: 10,
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
  openButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  openButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  summarySection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 12,
    fontFamily: "Inter_600SemiBold",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryContainer: {
    marginBottom: 16,
  },
  summaryContent: {
    fontSize: 16,
    lineHeight: 24,
    color: "#1A1A1A",
    textAlign: "justify",
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  streamingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  streamingText: {
    fontSize: 14,
    color: "#007AFF",
    fontFamily: "Inter_400Regular",
    marginLeft: 8,
  },
  errorContainer: {
    paddingVertical: 20,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
