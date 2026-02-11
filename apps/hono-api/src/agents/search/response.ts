import type { StreamingApi } from "hono/utils/stream";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { serializeMessage } from "../helpers.js";
import supabaseAdmin from "../../supabase.js";
import { setupGraph } from "./graph.js";
import { type TSearchChatResponse, GraphStatus } from "@jpvnk/infynii-shared";
import type { TSearchState } from "@jpvnk/infynii-shared/server";

import { DATABASE_CONNECTION_STRING, TEMP_USER_ID } from "./constants.js";

const checkpointer = PostgresSaver.fromConnString(DATABASE_CONNECTION_STRING);

const createSearchThread = async () => {
  const { data: newThreadData, error } = await supabaseAdmin
    .from("searches")
    .insert({
      user_id: TEMP_USER_ID,
    })
    .select()
    .single();

  if (error || !newThreadData) {
    console.log("error", error);
    throw new Error("Failed to create thread");
  }

  return newThreadData;
};

const createQueryProcessingResponse = (
  update: TSearchState,
  searchIdToUse: string
): TSearchChatResponse => {
  const messages: BaseMessage[] = update?.messages ?? [];
  const serializedMessages = messages.map((message) =>
    serializeMessage(message)
  );

  return {
    ...update,
    messages: serializedMessages,
    searchId: searchIdToUse,
  };
};

// Frequency selection handler
const handleFrequencySelection = async ({
  selectedFrequencyId,
  searchIdToUse,
  stream,
  config,
}: {
  selectedFrequencyId: string;
  searchIdToUse: string;
  stream: StreamingApi;
  config: any;
}) => {
  const frequencyId = parseInt(selectedFrequencyId);

  // Get frequency data
  const { data: frequencyData, error: frequencyError } = await supabaseAdmin
    .from("search_frequencies")
    .select()
    .eq("id", frequencyId)
    .single();

  if (frequencyError || !frequencyData) {
    console.log("frequencyError", frequencyError);
    throw new Error("Failed to get frequency");
  }

  // Update search with frequency
  const { error: updateError } = await supabaseAdmin
    .from("searches")
    .update({
      frequency: frequencyId,
    })
    .eq("id", searchIdToUse);

  if (updateError) {
    console.log("updateError", updateError);
    throw new Error("Failed to update search");
  }

  // Create frequency message
  const frequencyMessage = new AIMessage({
    content: `You selected frequency "${
      frequencyData.name || "selected option"
    }". I will try to notify you when new information becomes available about this topic.`,
  });

  const graph = setupGraph(searchIdToUse);
  const runner = graph.compile({
    checkpointer,
  });

  await runner.updateState(config, {
    messages: [frequencyMessage],
    status: GraphStatus.FINISHED,
  });

  const checkpoint = await checkpointer.get(config);
  const currentValues = checkpoint?.channel_values as TSearchState;

  // Create an update containing only the new frequency message (like normal query processing)
  const update: TSearchState = {
    messages: [frequencyMessage],
    status: currentValues?.status ?? GraphStatus.FINISHED,
    currentQuery: currentValues.currentQuery ?? "",
    alternativeQueries: currentValues?.alternativeQueries ?? [],
    searchAttempts: currentValues?.searchAttempts ?? 0,
    currentSearch: {
      ...currentValues?.currentSearch,
      frequencyId: frequencyData.id,
    },
  };

  const response = createQueryProcessingResponse(update, searchIdToUse);
  await stream.write(JSON.stringify(response) + "\n");
};

// Query processing handler
const handleQueryProcessing = async ({
  query,
  searchIdToUse,
  stream,
  config,
}: {
  query: string;
  searchIdToUse: string;
  stream: StreamingApi;
  config: any;
}) => {
  const initialMessage = new HumanMessage(query);

  const graph = setupGraph(searchIdToUse);
  const runner = graph.compile({
    checkpointer,
  });

  const inputs = {
    messages: [initialMessage],
    currentQuery: query,
  };

  // Stream query processing responses
  for await (const event of await runner.stream(inputs, config)) {
    const updates = Object.values(event) as TSearchState[];

    for (const update of updates) {
      const response = createQueryProcessingResponse(update, searchIdToUse);
      await stream.write(JSON.stringify(response) + "\n");
    }
  }
};

// Main handler function
type TAgentParams = {
  stream: StreamingApi;
  searchId?: string;
  query?: string;
  selectedFrequencyId?: string;
};

export const handleSearchAgent = async ({
  query,
  searchId,
  stream,
  selectedFrequencyId,
}: TAgentParams) => {
  const validInput = !!query || !!selectedFrequencyId;
  if (!validInput) {
    throw new Error("Empty input");
  }

  let searchIdToUse = searchId;
  console.log("searchIdToUse", searchIdToUse);
  if (!searchIdToUse) {
    const newSearchData = await createSearchThread();
    searchIdToUse = newSearchData.id;
  } else {
    const { data: searchData, error: searchError } = await supabaseAdmin
      .from("searches")
      .select()
      .eq("id", searchIdToUse)
      .single();

    console.log("searchData", searchData);

    if (searchError || !searchData) {
      console.log("searchError", searchError);
      throw new Error("Failed to get search");
    }

    if (!!searchData.trashed_at) {
      console.log("search is trashed, creating new search");
      const newSearchData = await createSearchThread();
      searchIdToUse = newSearchData.id;
    }

    searchIdToUse = searchData.id;
  }

  const config = {
    configurable: { thread_id: searchIdToUse },
    streamMode: "updates" as const,
  } as const;

  const checkpoint = await checkpointer.get(config);

  let channelValues: TSearchState | undefined;

  if (checkpoint) {
    channelValues = checkpoint?.channel_values as TSearchState;
    console.log("channelValues", channelValues);
  }

  if (selectedFrequencyId) {
    console.log("selectedFrequencyId", selectedFrequencyId);
    return await handleFrequencySelection({
      selectedFrequencyId,
      searchIdToUse,
      stream,
      config,
    });
  }

  if (!query) {
    throw new Error("Query is required");
  }

  console.log("query", query);
  await handleQueryProcessing({
    query,
    searchIdToUse,
    stream,
    config,
  });
};
