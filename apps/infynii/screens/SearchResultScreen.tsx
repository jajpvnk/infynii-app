import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  useLayoutEffect,
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
  textAnimationRef: React.MutableRefObject<(() => void) | undefined>;
};

type TAnimatedResultTextProps = {
  messages: TSummarizeResponse["messages"] | undefined;
  scrollViewRef: React.RefObject<ScrollView>;
  scrollWatcherRef: React.MutableRefObject<TScrollWatcher>;
  onContentHeightOverflown: (callback?: () => void) => void;
  textAnimationRef: React.MutableRefObject<(() => void) | undefined>;
};

function AnimatedResultText({
  messages,
  scrollViewRef,
  scrollWatcherRef,
  onContentHeightOverflown,
  textAnimationRef,
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

    textAnimationRef.current = () => {
      intervalRef.current = setInterval(() => {
        const currentIndex = animationIndexRef.current;

        const containerHeight = scrollWatcherRef.current.container.height;
        const currentTextHeight = scrollWatcherRef.current.text.height;
        const totalTextHeight = (currentTextHeight ?? 0) + HEADER_HEIGHT;
        // console.log("total text height: ", totalTextHeight);
        // console.log("container height: ", containerHeight);
        // console.log("--------------------------------");
        if (
          containerHeight &&
          totalTextHeight &&
          totalTextHeight >= containerHeight
        ) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onContentHeightOverflown();
          return;
        }

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

    textAnimationRef.current?.();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [messages]);

  const onTextLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    scrollWatcherRef.current.text.height = height;
  }, []);

  return (
    <View onLayout={onTextLayout} style={{ backgroundColor: "yellow" }}>
      <Text style={styles.summaryContent}>{displayedText}</Text>
    </View>
  );
}

function SearchResultSummary({
  resultId,
  scrollViewRef,
  scrollWatcherRef,
  scrollToEndWithCallback,
  textAnimationRef,
}: TSearchResultSummaryProps) {
  const client = useHonoClient();
  const wrapperRef = useRef<View>(null);
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
    const currentTextHeight = scrollWatcherRef.current.text.height ?? 0;
    const newCustomHeight = currentTextHeight + 100;

    setCustomHeight(newCustomHeight);
    scrollWatcherRef.current.container.height = newCustomHeight + HEADER_HEIGHT;

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
      scrollToEndWithCallback(() => {
        console.log("scroll to end with callback");
        setTimeout(() => {
          textAnimationRef.current?.();
        }, 1000)
      });
    }, 10);
  }, []);

  console.log("custom height: ", customHeight);

  return (
    <View
      style={[
        { backgroundColor: "green" },
        customHeight ? { height: customHeight } : { height: 'auto' },
      ]}
    >
      <Text style={{ color: "white" }}>custom height: {customHeight}</Text>
      {/* <Text style={styles.sectionTitle}>
        Content Summary {customHeight ? `( ${customHeight}px )` : ""}
      </Text> */}

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
        textAnimationRef={textAnimationRef}
      />

      {/* )} */}
    </View>
  );
}

type TScrollWatcher = {
  container: {
    height: number | null;
    lastSeenHeight: number | null;
    sameHeightCount: number;
  };
  text: {
    height: number | null;
  };
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
    container: {
      height: null,
      lastSeenHeight: null,
      sameHeightCount: 0,
    },
    text: {
      height: null,
    },
  });
  const insets = useSafeAreaInsets();
  const scrollCallbackRef = useRef<(() => void) | null>(null);
  const textAnimationRef = useRef<(() => void) | undefined>(undefined);

  const wrapperRef = useRef<View>(null);

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

  useLayoutEffect(() => {
    const measureInterval = setInterval(() => {
      wrapperRef.current?.measure((x, y, width, height, pageX, pageY) => {
        if (scrollWatcherRef.current.container?.lastSeenHeight === height) {
          scrollWatcherRef.current.container.sameHeightCount += 1;
          if (scrollWatcherRef.current.container.sameHeightCount >= 2) {
            clearInterval(measureInterval);
            return;
          }
        } else {
          scrollWatcherRef.current.container.sameHeightCount = 1;
        }
        scrollWatcherRef.current.container.height = height;
        scrollWatcherRef.current.container.lastSeenHeight = height;
      });
    }, 100);
    return () => clearInterval(measureInterval);
  }, []);

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

  // const onWrapperLayout = useCallback((event: LayoutChangeEvent) => {
  //   const { height } = event.nativeEvent.layout;
  //   console.log("wrapper layout", height);

  //   // Check if height is same as last time
  //   if (scrollWatcherRef.current.lastSeenHeight === height) {
  //     scrollWatcherRef.current.sameHeightCount += 1;

  //     // Stop updating if we've seen the same height 2 times in a row
  //     if (scrollWatcherRef.current.sameHeightCount >= 2) {
  //       return;
  //     }
  //   } else {
  //     // Height changed, reset counter
  //     scrollWatcherRef.current.sameHeightCount = 1;
  //   }

  //   // Update last seen height
  //   scrollWatcherRef.current.lastSeenHeight = height;

  //   // Update container height
  //   if (scrollWatcherRef.current.containerHeight === null) {
  //     scrollWatcherRef.current.containerHeight = height;
  //   } else {
  //     scrollWatcherRef.current.containerHeight = Math.min(
  //       scrollWatcherRef.current.containerHeight,
  //       height
  //     );
  //   }
  // }, []);

  // const onContentSizeChange = useCallback((_: number, height: number) => {
  //   scrollWatcherRef.current.scrollHeight = height;
  //   // console.log("scroll height", scrollWatcherRef.current.scrollHeight);
  // }, []);

  // Custom scroll to end with callback
  const scrollToEndWithCallback = useCallback((callback?: () => void) => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
    if (callback) {
      scrollCallbackRef.current = callback;
    }
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

  const onContentSizeChange = useCallback((_: number, height: number) => {
    // const containerHeight = scrollWatcherRef.current.container.height;
    // const contentHeight = height;
    // if (containerHeight && contentHeight && contentHeight >= containerHeight) {
    //   console.log("content height is greater than container height: ", contentHeight, " container height: ", containerHeight);
    //   scrollWatcherRef.current.container.height = height + 200;
    //   console.log("new container height: ", scrollWatcherRef.current.container.height);
    // }
  }, []);

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom }}>
      <Stack.Screen
        options={{
          title:
            state.result?.title?.length && state.result?.title?.length > 30
              ? `${state.result.title?.substring(0, 30)}...`
              : state.result?.title ?? "",
          headerBackTitle: "Back",
        }}
      />
      <View style={{ flex: 1, backgroundColor: "blue" }} ref={wrapperRef}>
        <ScrollView
          ref={scrollViewRef}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onContentSizeChange={onContentSizeChange}
          style={{ flex: 1 }}
          contentContainerStyle={{ flex: 0, flexGrow: 0, flexShrink: 0, paddingVertical: 0, paddingHorizontal: 0 }}
          showsVerticalScrollIndicator={false}
        >
          <SearchResultHeader result={state.result} onOpenUrl={handleOpenUrl} />
          <SearchResultSummary
            resultId={state.result?.id ?? ""}
            scrollViewRef={scrollViewRef}
            scrollWatcherRef={scrollWatcherRef}
            scrollToEndWithCallback={scrollToEndWithCallback}
            textAnimationRef={textAnimationRef}
          />
        </ScrollView>
      </View>
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
    // padding: 16,
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
