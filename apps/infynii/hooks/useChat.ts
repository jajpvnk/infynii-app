import { useState, useCallback } from "react";
import type { TSearchChatResponse } from "@jpvnk/infynii-hono-api/dist/agents/search";
import { createUserMessage } from "@/utils/chatUtils";

export type TSearchState = {
  status?: TSearchChatResponse["status"];
  searchId?: TSearchChatResponse["searchId"];
  messages?: TSearchChatResponse["messages"];
  currentQuery?: TSearchChatResponse["currentQuery"];
  alternativeQueries?: TSearchChatResponse["alternativeQueries"];
  searchAttempts?: TSearchChatResponse["searchAttempts"];
  currentSearch?: TSearchChatResponse["currentSearch"];
};

// Custom hook for chat state management
export const useChat = () => {
  const [search, setSearch] = useState<TSearchState>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const updateSearchState = useCallback((response: TSearchChatResponse) => {
    setSearch((prev) => {
      const newMessages = [...response.messages, ...(prev?.messages ?? [])];
      return {
        status: response.status,
        currentQuery: response.currentQuery,
        alternativeQueries: response.alternativeQueries,
        searchAttempts: response.searchAttempts,
        currentSearch: response.currentSearch,
        searchId: response.searchId,
        messages: newMessages,
      };
    });
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setSearch((prev) => ({
      messages: [
        createUserMessage(content, prev?.messages?.length ?? 0),
        ...(prev?.messages ?? []),
      ],
    }));
  }, []);

  return {
    search,
    error,
    isLoading,
    setError,
    setIsLoading,
    updateSearchState,
    addUserMessage,
  };
};
