import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  LayoutChangeEvent,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { StyleSheet } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useHonoClient } from "@/context/HonoProvider";
import { Database, type TSummarizeResponse } from "@jpvnk/infynii-shared";
import { processNDJSONResponse } from "@/helpers/ndjson";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown } from "lucide-react-native";

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
  textAnimationRef: React.MutableRefObject<(() => void) | undefined>;
  pauseAnimationRef: React.MutableRefObject<(() => void) | undefined>;
};

type TAnimatedResultTextProps = {
  messages: TSummarizeResponse["messages"] | undefined;
  textAnimationRef: React.MutableRefObject<(() => void) | undefined>;
  pauseAnimationRef: React.MutableRefObject<(() => void) | undefined>;
};

function AnimatedResultText({
  messages,
  textAnimationRef,
  pauseAnimationRef,
}: TAnimatedResultTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const animationIndexRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const allWordsRef = useRef<string[]>([]);

  // Set up pause function
  useEffect(() => {
    pauseAnimationRef.current = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pauseAnimationRef]);

  // Set up resume/start function and process messages
  useEffect(() => {
    if (!messages || messages.length === 0) {
      animationIndexRef.current = 0;
      allWordsRef.current = [];
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

    // Build words array
    const allWords: string[] = [];
    messages.forEach((message) => {
      allWords.push(...message.content.split(" "));
    });
    allWordsRef.current = allWords;

    // Define the animation start/resume function
    textAnimationRef.current = () => {
      // Don't start if already running
      if (intervalRef.current) {
        return;
      }

      intervalRef.current = setInterval(() => {
        const currentIndex = animationIndexRef.current;
        const words = allWordsRef.current;

        if (currentIndex >= words.length) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setDisplayedText(words.join(" "));
          return;
        }

        animationIndexRef.current = currentIndex + 1;
        setDisplayedText(words.slice(0, currentIndex + 1).join(" "));
      }, ANIMATION_INTERVAL);
    };

    // Start animation
    textAnimationRef.current();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [messages, textAnimationRef]);

  return (
    <View style={styles.summaryTextContainer}>
      <Text style={styles.summaryContent}>{displayedText}</Text>
    </View>
  );
}

function SearchResultSummary({
  resultId,
  textAnimationRef,
  pauseAnimationRef,
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

  return (
    <View style={styles.summarySection}>
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
        </View>
      )}

      <AnimatedResultText
        messages={state.summarization?.messages}
        textAnimationRef={textAnimationRef}
        pauseAnimationRef={pauseAnimationRef}
      />
    </View>
  );
}

type TFloatingScrollButtonProps = {
  visible: boolean;
  onPress: () => void;
};

function FloatingScrollButton({ visible, onPress }: TFloatingScrollButtonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, animatedValue]);

  const animatedStyle = {
    opacity: animatedValue,
    transform: [
      {
        translateY: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
      {
        scale: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1],
        }),
      },
    ],
  };

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.floatingButtonContainer, animatedStyle]}>
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <ChevronDown size={24} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>
    </Animated.View>
  );
}

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
  const insets = useSafeAreaInsets();
  const scrollCallbackRef = useRef<(() => void) | null>(null);
  const textAnimationRef = useRef<(() => void) | undefined>(undefined);
  const pauseAnimationRef = useRef<(() => void) | undefined>(undefined);

  // State for floating button visibility
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const contentHeightRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const currentScrollOffsetRef = useRef(0);

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

  // Handle scroll animation end
  const handleMomentumScrollEnd = useCallback(() => {
    if (scrollCallbackRef.current) {
      const callback = scrollCallbackRef.current;
      scrollCallbackRef.current = null;
      callback();
    }
  }, []);

  // Update floating button visibility based on scroll position
  const updateFloatingButtonVisibility = useCallback(() => {
    const contentHeight = contentHeightRef.current;
    const scrollViewHeight = scrollViewHeightRef.current;
    const currentOffset = currentScrollOffsetRef.current;

    // Show button if content is scrollable and not at bottom
    const isScrollable = contentHeight > scrollViewHeight;
    const isAtBottom = currentOffset >= contentHeight - scrollViewHeight - 50; // 50px threshold

    setShowFloatingButton(isScrollable && !isAtBottom);
  }, []);

  // Track scroll position
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      currentScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      updateFloatingButtonVisibility();
    },
    [updateFloatingButtonVisibility]
  );

  // Track content size changes
  const onContentSizeChangeForButton = useCallback(
    (_: number, height: number) => {
      contentHeightRef.current = height;
      updateFloatingButtonVisibility();
    },
    [updateFloatingButtonVisibility]
  );

  // Track scroll view layout
  const onScrollViewLayout = useCallback(
    (event: LayoutChangeEvent) => {
      scrollViewHeightRef.current = event.nativeEvent.layout.height;
      updateFloatingButtonVisibility();
    },
    [updateFloatingButtonVisibility]
  );

  // Handle floating button press - pause animation, scroll to bottom, resume
  const handleFloatingButtonPress = useCallback(() => {
    // Pause the animation
    pauseAnimationRef.current?.();

    // Scroll to bottom
    scrollViewRef.current?.scrollToEnd({ animated: true });

    // Set up callback to resume animation after scroll ends
    scrollCallbackRef.current = () => {
      setTimeout(() => {
        textAnimationRef.current?.();
      }, 100);
    };
  }, []);

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

  const onContentSizeChange = useCallback(
    (_: number, height: number) => {
      onContentSizeChangeForButton(_, height);
    },
    [onContentSizeChangeForButton]
  );

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
      <View style={styles.container}>
        <ScrollView
          ref={scrollViewRef}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onContentSizeChange={onContentSizeChange}
          onScroll={handleScroll}
          onLayout={onScrollViewLayout}
          scrollEventThrottle={16}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          <SearchResultHeader result={state.result} onOpenUrl={handleOpenUrl} />
          <SearchResultSummary
            resultId={state.result?.id ?? ""}
            textAnimationRef={textAnimationRef}
            pauseAnimationRef={pauseAnimationRef}
          />
        </ScrollView>
        <FloatingScrollButton
          visible={showFloatingButton}
          onPress={handleFloatingButtonPress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  floatingButtonContainer: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
  },
  floatingButton: {
    backgroundColor: "#007AFF",
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
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
    padding: 16,
  },
  summaryTextContainer: {
    minHeight: 100,
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
