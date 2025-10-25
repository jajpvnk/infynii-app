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
  FlatList,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  LayoutChangeEvent,
} from "react-native";
import { StyleSheet } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useHonoClient } from "@/context/HonoProvider";
import { Database, type TSummarizeResponse } from "@jpvnk/infynii-shared";
import { processNDJSONResponse } from "@/helpers/ndjson";
import { SafeAreaView } from "react-native-safe-area-context";

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
};

type TListItem =
  | { type: "header"; data: TSearchResult }
  | { type: "summary"; data: { resultId: string } };

type TSearchResultHeaderProps = {
  result: TSearchResult | null;
  onOpenUrl: () => void;
};

function SearchResultHeader({ result, onOpenUrl }: TSearchResultHeaderProps) {
  return (
    <View style={styles.headerSection}>
      <Text style={styles.title}>{result?.title ?? ""}</Text>
      <TouchableOpacity style={styles.urlButton} onPress={onOpenUrl}>
        <Text style={styles.urlText}>{result?.url ?? ""}</Text>
      </TouchableOpacity>
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreLabel}>Relevance Score:</Text>
        <Text style={styles.scoreValue}>
          {((result?.score ?? 0) * 100).toFixed(1)}%
        </Text>
      </View>

      {/* Open Article Button */}
      <TouchableOpacity style={styles.openButton} onPress={onOpenUrl}>
        <Text style={styles.openButtonText}>Open Full Article</Text>
      </TouchableOpacity>
    </View>
  );
}

type TSearchResultSummaryProps = {
  resultId: string;
  flatListRef: React.RefObject<FlatList>;
};

const CONTENT_HEIGHT = 100;
const SCROLL_TIMEOUT = 100;

function SearchResultSummary({
  resultId,
  flatListRef,
}: TSearchResultSummaryProps) {
  const client = useHonoClient();

  const [state, setState] = useState<{
    summarization: TSummarization | undefined;
    isSummarizing: boolean;
    summarizationError: string | null;
  }>({
    summarization: undefined,
    isSummarizing: false,
    summarizationError: null,
  });

  const [animating, setAnimating] = useState({
    displayedText: "",
    isAnimating: false,
  });
  const summaryWordsAnimationIndex = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const incHeightRef = useRef(1);
  const [contentHeight, setContentHeight] = useState(CONTENT_HEIGHT);

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

  const fullText = useMemo(() => {
    return state.summarization?.messages
      ? state.summarization.messages.reduce(
          (acc, message) => acc + message.content,
          ""
        )
      : "";
  }, [state.summarization?.messages]);

  // Animate the text
  useEffect(() => {
    if (!animating.isAnimating || !fullText) {
      return;
    }

    const words = fullText.split(" ");

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    intervalRef.current = setInterval(() => {
      const nextIndex = summaryWordsAnimationIndex.current + 1;

      if (nextIndex >= words.length) {
        setAnimating((prev) => ({
          ...prev,
          displayedText: fullText,
          isAnimating: false,
        }));
        summaryWordsAnimationIndex.current = words.length;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      summaryWordsAnimationIndex.current = nextIndex;

      const nextText = words.slice(0, nextIndex).join(" ");

      setAnimating((prev) => ({
        ...prev,
        displayedText: nextText,
      }));
    }, ANIMATION_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fullText, animating.isAnimating]);

  // Start animation when new messages arrive or content length changes
  useEffect(() => {
    if (!fullText) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      summaryWordsAnimationIndex.current = 0;
      setAnimating((prev) => ({
        ...prev,
        displayedText: "",
        isAnimating: false,
      }));
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    summaryWordsAnimationIndex.current = 0;
    setAnimating((prev) => ({ ...prev, displayedText: "", isAnimating: true }));
  }, [fullText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Save summary when summarization is complete
  useEffect(() => {
    if (!resultId) {
      return;
    }
    if (state.isSummarizing || !state.summarization?.messages) {
      return;
    }
    const fullText = state.summarization.messages
      .map((message) => message.content)
      .join("\n");

    if (fullText) {
      saveSummary(resultId, fullText);
    }
  }, [
    state.isSummarizing,
    state.summarization?.messages,
    resultId,
    saveSummary,
  ]);

  // Start summarization when component mounts or resultId changes
  useEffect(() => {
    if (resultId) {
      summarizeResult(resultId);
    }
  }, [resultId, summarizeResult]);

  const retrySummarization = useCallback(() => {
    summarizeResult(resultId);
  }, [summarizeResult, resultId]);

  const handleTextLayout = useCallback((event: LayoutChangeEvent) => {
    const { height: currentContentHeight } = event.nativeEvent.layout;
    const d = currentContentHeight / (CONTENT_HEIGHT * incHeightRef.current);
    if (d > 1) {
      incHeightRef.current = incHeightRef.current + 1;
      setContentHeight(CONTENT_HEIGHT * incHeightRef.current);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, SCROLL_TIMEOUT);
    }
  }, []);

  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    const { height: currentContentHeight } = event.nativeEvent.layout;
    console.log("currentContentHeight", currentContentHeight);
  }, []);

  return (
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
        <View
          style={[styles.summaryContainer, { minHeight: contentHeight }]}
          onLayout={handleTextLayout}
        >
          <Text style={styles.summaryContent}>{animating.displayedText}</Text>
        </View>
      )}

      {state.isSummarizing && state.summarization?.messages && (
        <View style={styles.streamingIndicator}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}
    </View>
  );
}

export default function SearchResultScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const client = useHonoClient();
  const flatListRef = useRef<FlatList>(null);
  // State for search result only
  const [state, setState] = useState<TScreenState>({
    result: null,
    isLoadingResult: true,
    resultError: null,
  });

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
      } catch (e) {
        console.error("Failed to fetch search result", e);
        setState((prev) => ({
          ...prev,
          resultError: "Failed to fetch search result",
          isLoadingResult: false,
        }));
      }
    })();
  }, [id, client]);

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

  const listData = useMemo<TListItem[]>(() => {
    if (!state.result) {
      return [];
    }
    return [{ type: "summary", data: { resultId: state.result.id } }];
  }, [state.result]);

  const renderItem = useCallback(({ item }: { item: TListItem }) => {
    if (item.type === "summary") {
      return (
        <SearchResultSummary
          resultId={item.data.resultId}
          flatListRef={flatListRef}
        />
      );
    }
    return null;
  }, []);

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
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title:
            state.result?.title?.length && state.result?.title?.length > 30
              ? `${state.result.title?.substring(0, 30)}...`
              : state.result?.title ?? "",
          headerBackTitle: "Back",
        }}
      />
      <FlatList
        ref={flatListRef}
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item) => item.type}
        contentContainerStyle={{ backgroundColor: "blue" }}
        ListHeaderComponent={
          <SearchResultHeader result={state.result} onOpenUrl={handleOpenUrl} />
        }
        style={{ flex: 1, backgroundColor: "green" }}
        // maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, SCROLL_TIMEOUT);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  summaryContainer: {},
  summaryContent: {
    fontSize: 16,
    lineHeight: 24,
    color: "#1A1A1A",
    textAlign: "justify",
    fontFamily: "Inter_400Regular",
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
