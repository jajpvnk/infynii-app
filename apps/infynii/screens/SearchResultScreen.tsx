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
  LayoutChangeEvent,
} from "react-native";
import { StyleSheet } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useHonoClient } from "@/context/HonoProvider";
import { Database, type TSummarizeResponse } from "@jpvnk/infynii-shared";
import { processNDJSONResponse } from "@/helpers/ndjson";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const ANIMATION_INTERVAL = 100;
const HEADER_HEIGHT = 300;

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
  resultId?: string | null;
  scrollViewRef: React.RefObject<ScrollView>;
  scrollWatcherRef: React.MutableRefObject<TScrollWatcher>;
  scrollToEndWithCallback: (callback?: () => void) => void;
};

type TAnimatedResultTextProps = {
  messages: TSummarizeResponse["messages"] | undefined;
  scrollViewRef: React.RefObject<ScrollView>;
  scrollWatcherRef: React.MutableRefObject<TScrollWatcher>;
  onContentHeightOverflown: (callback?: () => void) => void;
  runIntervalRef: React.MutableRefObject<(() => void) | undefined>;
};

function AnimatedResultText({
  messages,
  scrollViewRef,
  scrollWatcherRef,
  onContentHeightOverflown,
  runIntervalRef,
}: TAnimatedResultTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const animationIndexRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update buffer when new messages arrive
  useEffect(() => {
    if (!messages || messages.length === 0) {
      animationIndexRef.current = 0;
      setDisplayedText("");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const allWords: string[] = [];
    messages.forEach((message) => {
      allWords.push(...message.content.split(" "));
    });

    runIntervalRef.current = () => {
      intervalRef.current = setInterval(() => {
        // Check if content is overflowing
        if (scrollWatcherRef.current.isOverflowing) {
          console.log("Content is overflowing!");
          console.log("  - Content height:", scrollWatcherRef.current.contentHeight);
          console.log("  - Container height:", scrollWatcherRef.current.containerHeight);

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          onContentHeightOverflown();
          return;
        }

        const currentIndex = animationIndexRef.current;

        if (currentIndex >= allWords.length) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setDisplayedText(allWords.join(" "));
          scrollViewRef.current?.scrollToEnd({ animated: true });
          return;
        }

        animationIndexRef.current = currentIndex + 1;
        const displayWords = allWords.slice(0, currentIndex + 1);
        setDisplayedText(displayWords.join(" "));
      }, ANIMATION_INTERVAL);
    };

    runIntervalRef.current?.();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [messages]);

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.summaryContent}>{displayedText}</Text>
    </View>
  );
}

function SearchResultSummary({
  resultId,
  scrollViewRef,
  scrollWatcherRef,
  scrollToEndWithCallback,
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

  const [customHeight, setCustomHeight] = useState<undefined | number>(
    undefined
  );
  const runIntervalRef = useRef<(() => void) | undefined>(undefined);

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
    if (!resultId) {
      return;
    }
    summarizeResult(resultId);
  }, [resultId, summarizeResult]);

  const retrySummarization = useCallback(() => {
    if (!resultId) {
      return;
    }
    summarizeResult(resultId);
  }, [summarizeResult, resultId]);

  const onContentHeightOverflown = useCallback(() => {
    if (
      !scrollWatcherRef.current.containerHeight ||
      !scrollWatcherRef.current.contentHeight
    ) {
      return;
    }

    console.log("Content has overflown!");
    console.log("  - Content height:", scrollWatcherRef.current.contentHeight);
    console.log("  - Container height:", scrollWatcherRef.current.containerHeight);

    // TODO: Implement your overflow handling logic here
    // For example: scroll to end, expand container, or pause animation

    // Example: Scroll to end and resume animation after scroll completes
    // scrollToEndWithCallback(() => {
    //   console.log("Scroll animation completed!");
    //   // Reset overflow flag and resume animation
    //   scrollWatcherRef.current.isOverflowing = false;
    //   runIntervalRef.current?.();
    // });
  }, []);

  return (
    <View
      style={[
        styles.summarySection,
        customHeight ? { height: customHeight } : undefined,
      ]}
    >
      <Text style={styles.sectionTitle}>Content Summary {customHeight ? `( ${customHeight}px )` : ""}</Text>

      {/* {state.isSummarizing && !state.summarization?.messages && (
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
      )} */}
      {/* {!state.isSummarizing && state.summarization?.messages && ( */}
      <AnimatedResultText
        messages={state.summarization?.messages}
        scrollViewRef={scrollViewRef}
        scrollWatcherRef={scrollWatcherRef}
        onContentHeightOverflown={onContentHeightOverflown}
        runIntervalRef={runIntervalRef}
      />

      {/* )} */}
    </View>
  );
}

type TScrollWatcher = {
  containerHeight: number | null;
  contentHeight: number | null;
  isOverflowing: boolean;
};

export default function SearchResultScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const client = useHonoClient();
  const scrollViewRef = useRef<ScrollView>(null);
  // State for search result only
  const [state, setState] = useState<TScreenState>({
    result: null,
    isLoadingResult: true,
    resultError: null,
  });
  const scrollWatcherRef = useRef<TScrollWatcher>({
    containerHeight: null,
    contentHeight: null,
    isOverflowing: false,
  });
  const insets = useSafeAreaInsets();
  const scrollCallbackRef = useRef<(() => void) | null>(null);

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
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    if (scrollWatcherRef.current.containerHeight !== null) {
      return;
    }

    const { height } = event.nativeEvent.layout;
    scrollWatcherRef.current.containerHeight = height;
    console.log("Container height set to:", height);
  }, []);

  const onContentSizeChange = useCallback((width: number, height: number) => {
    scrollWatcherRef.current.contentHeight = height;

    if (scrollWatcherRef.current.containerHeight !== null) {
      const isOverflowing = height > scrollWatcherRef.current.containerHeight;
      scrollWatcherRef.current.isOverflowing = isOverflowing;

      console.log("Content size changed:");
      console.log("  - Content height:", height);
      console.log("  - Container height:", scrollWatcherRef.current.containerHeight);
      console.log("  - Is overflowing:", isOverflowing);
    }
  }, []);


  // Custom scroll to end with callback
  const scrollToEndWithCallback = useCallback((callback?: () => void) => {
    if (callback) {
      scrollCallbackRef.current = callback;
    }
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  // Handle scroll animation end
  const handleMomentumScrollEnd = useCallback(() => {
    if (scrollCallbackRef.current) {
      const callback = scrollCallbackRef.current;
      scrollCallbackRef.current = null;
      callback();
    }
  }, []);

  // const onContentHeightChange = useCallback((height: number) => {
  //   const fullHeight = HEADER_HEIGHT + height + insets.bottom;
  //   if (fullHeight > watchedHeightRef.current) {
  //     scrollViewRef.current?.scrollToEnd({ animated: true });
  //     watchedHeightRef.current = fullHeight;
  //   }
  // }, []);

  // if (state.isLoadingResult) {
  //   return (
  //     <>
  //       <Stack.Screen
  //         options={{
  //           headerBackTitle: "Back",
  //         }}
  //       />
  //       <View style={styles.centerContainer}>
  //         <ActivityIndicator size="small" color="#007AFF" />
  //         <Text style={styles.loadingText}>Loading...</Text>
  //       </View>
  //     </>
  //   );
  // }

  // if (state.resultError) {
  //   return (
  //     <>
  //       <Stack.Screen
  //         options={{
  //           title: "Error",
  //           headerBackTitle: "Back",
  //         }}
  //       />
  //       <View style={styles.centerContainer}>
  //         <Text style={styles.errorText}>{state.resultError}</Text>
  //       </View>
  //     </>
  //   );
  // }

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom }} onLayout={onLayout}>
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
        ref={scrollViewRef}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onContentSizeChange={onContentSizeChange}
      >
        <SearchResultHeader result={state.result} onOpenUrl={handleOpenUrl} />
        <SearchResultSummary
          resultId={state.result?.id ?? ""}
          scrollViewRef={scrollViewRef}
          scrollWatcherRef={scrollWatcherRef}
          scrollToEndWithCallback={scrollToEndWithCallback}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    height: HEADER_HEIGHT,
    justifyContent: "center",
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
    flex: 1,
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
  summaryContent: {
    fontSize: 16,
    lineHeight: 24,
    color: "#1A1A1A",
    textAlign: "justify",
    fontFamily: "Inter_400Regular",
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
