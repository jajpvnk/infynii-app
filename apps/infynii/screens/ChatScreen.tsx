import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, FlatList, Text, StyleSheet, Alert } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import { useHonoClient } from "@/context/HonoProvider";
import {
  GraphStatus,
  type Database,
  type TSerializedMessage,
  type TTavilySearchResult,
} from "@jpvnk/infynii-shared";
import FrequencyBottomSheet from "@/components/FrequencyBottomSheet";
import { useStreamResponse } from "@/hooks/useStreamResponse";
import { useChat } from "@/hooks/useChat";
import { formatTimestamp } from "@/utils/chatUtils";
import { ToolMessage } from "@/components/chat/ToolMessage";
import { UserMessage } from "@/components/chat/UserMessage";
import {
  AssistantMessage,
  MESSAGE_ACTION_SELECT_FREQUENCY,
  type TMessageActions,
} from "@/components/chat/AssistantMessage";
import { ErrorDisplay } from "@/components/chat/ErrorDisplay";
import { MessageInput } from "@/components/chat/MessageInput";

type TFrequency = Database["public"]["Tables"]["search_frequencies"]["Row"];

const ChatScreen = () => {
  const client = useHonoClient();
  const [newMessage, setNewMessage] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const [frequencies, setFrequencies] = useState<TFrequency[]>([]);
  const { processStreamResponse } = useStreamResponse();
  const {
    search,
    error,
    isLoading,
    setError,
    setIsLoading,
    updateSearchState,
    addUserMessage,
  } = useChat();

  // Bottom sheet state
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [selectedFrequency, setSelectedFrequency] = useState<string>("");

  const handleOpenBottomSheet = useCallback(() => {
    bottomSheetRef.current?.expand();
  }, []);

  const handleCloseBottomSheet = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);

  const handleFrequencySelect = useCallback(
    async (frequencyId: string) => {
      setSelectedFrequency(frequencyId);
      setIsLoading(true);
      setError(null);

      const res = await client.api.v1.stream.$post({
        query: {
          q: "",
          selectedFrequencyId: frequencyId,
          searchId: search?.searchId,
        },
      });

      await processStreamResponse({
        response: res,
        onData: updateSearchState,
        onError: (errorMessage) => {
          setError(errorMessage);
          setIsLoading(false);
        },
        onComplete: () => {
          setIsLoading(false);
          handleCloseBottomSheet();
        },
      });
    },
    [
      handleCloseBottomSheet,
      search,
      processStreamResponse,
      updateSearchState,
      setError,
      setIsLoading,
      client,
    ]
  );

  const handleTrashSearch = useCallback(async (searchId: string) => {
    try {
      const response = await client.api.v1.search[":id"].trash.$patch({
        param: { id: searchId },
      });

      if (!response.ok) {
        throw new Error("Failed to trash search");
      }

      return true;
    } catch (error) {
      console.error("Error trashing search:", error);
      setError("Failed to trash search. Please try again.");
      return false;
    }
  }, [client, setError]);

  useEffect(() => {
    const fetchFrequencies = async () => {
      const resp = await client.api.v1.frequencies.$get();
      if (!resp.ok) {
        setError("Failed to fetch frequencies, please try again.");
        return;
      }
      const res = await resp.json();
      setFrequencies(res.data ?? []);
    };
    fetchFrequencies();
  }, [client, setError]);

  const renderMessage = ({ item }: { item: TSerializedMessage }) => {
    const { type, content, timestamp, name, additional_kwargs } = item;

    const isToolMessage = type === "tool";
    const isUserMessage = type === "human";
    const isAssistantMessage = type === "ai";

    if (isToolMessage && name === "search_tool") {
      const searchResults = JSON.parse(content) as TTavilySearchResult[];
      return <ToolMessage searchResults={searchResults} searchId={search?.searchId} />;
    }

    if (!content) {
      return null;
    }

    if (isAssistantMessage) {
      let actions: TMessageActions = [];
      if (additional_kwargs?.selectFrequency) {
        actions.push(MESSAGE_ACTION_SELECT_FREQUENCY);
      }
      return (
        <AssistantMessage
          content={content}
          timestamp={timestamp}
          actions={actions}
          onSelectFrequency={handleOpenBottomSheet}
        />
      );
    }

    if (isUserMessage) {
      return <UserMessage content={content} timestamp={timestamp} />;
    }

    // Fallback for other message types
    return (
      <View style={[styles.messageContainer, styles.otherMessage]}>
        <View style={styles.messageContent}>
          <Text style={[styles.messageText, styles.otherMessageText]}>
            {content}
          </Text>
          <Text style={[styles.timestamp, styles.otherTimestamp]}>
            {formatTimestamp(timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const sendMessageWithSearch = useCallback(async (message: string, searchId?: string) => {
    setError(null);
    setIsLoading(true);
    setNewMessage("");

    // Add user message immediately
    addUserMessage(message);

    const res = await client.api.v1.stream.$post({
      query: {
        q: message,
        searchId: searchId,
      },
    });

    await processStreamResponse({
      response: res,
      onData: updateSearchState,
      onError: (errorMessage) => {
        setError(errorMessage);
        setIsLoading(false);
      },
      onComplete: () => {
        setIsLoading(false);
      },
    });
  }, [
    search,
    addUserMessage,
    processStreamResponse,
    updateSearchState,
    setError,
    setIsLoading,
    client,
  ]);

  const handleTrashConfirmation = useCallback(async () => {
    if (!search?.searchId) {
      return;
    }

    const trashSuccess = await handleTrashSearch(search.searchId);
    if (!trashSuccess) {
      return;
    }

    // Continue with original flow after successful trash
    await sendMessageWithSearch(newMessage, undefined);
  }, [search?.searchId, handleTrashSearch, newMessage, sendMessageWithSearch]);

  const sendMessage = useCallback(async () => {
    // Guard clause: early return for empty messages
    if (!newMessage.trim()) {
      return;
    }

    // Guard clause: handle finished search with frequency
    if (search?.status === GraphStatus.FINISHED) {
      Alert.alert(
        "Start New Search",
        "This will archive your current search and start a new one. Do you want to continue?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Continue",
            style: "default",
            onPress: handleTrashConfirmation,
          },
        ]
      );
      return;
    }

    // Default flow: send message with current search
    await sendMessageWithSearch(newMessage, search?.searchId);
  }, [
    newMessage,
    search,
    handleTrashConfirmation,
    sendMessageWithSearch,
  ]);

  return (
    <View style={styles.container}>
      <FlatList
        data={search?.messages ?? []}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        inverted={true}
        ref={flatListRef}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {error && <ErrorDisplay error={error} />}

      <MessageInput
        value={newMessage}
        onChangeText={setNewMessage}
        onSend={sendMessage}
        isLoading={isLoading}
      />

      <FrequencyBottomSheet
        ref={bottomSheetRef}
        frequencies={frequencies}
        selectedFrequency={selectedFrequency}
        onFrequencySelect={handleFrequencySelect}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flex: 1,
    backgroundColor: "#fff",
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  // Fallback message styles for other message types
  messageContainer: {
    maxWidth: "80%",
    borderRadius: 16,
    marginBottom: 12,
  },
  messageContent: {
    padding: 12,
  },
  otherMessage: {
    backgroundColor: "#F0F0F0",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "justify",
  },
  otherMessageText: {
    color: "#1A1A1A",
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  otherTimestamp: {
    color: "#666",
  },
});

export default ChatScreen;
