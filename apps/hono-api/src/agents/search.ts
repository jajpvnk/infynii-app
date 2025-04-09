import z from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import {
  Annotation,
  END,
  MemorySaver,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { tool } from "@langchain/core/tools";
import type { StreamingApi } from "hono/utils/stream";
import {
  HumanMessage,
  BaseMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { randomUUID } from "crypto";

type TTavilySearchResult = {
  title: string;
  url: string;
  content: string;
  score: number;
};

const MIN_SEARCH_RESULTS = 5;
const MAX_SEARCH_RESULTS = 8;
const REQUERD_SEARCH_RESULTS = 2;

const THRESHOLD_SCORE = 0.5;
const MAX_SEARCH_ATTEMPTS = 3;

enum ERouterResult {
  SEARCH = "search",
  UNCLEAR = "unclear",
  NOT_SEARCHABLE = "not_searchable",
  TRANSFORM = "transform",
}

const RootGraphState = Annotation.Root({
  route: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "",
    default: () => "",
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  currentQuery: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "",
    default: () => "",
  }),
  searchAttempts: Annotation<number>({
    reducer: (x, y) => y ?? x ?? 0,
    default: () => 0,
  }),
});

const rawModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0,
  maxRetries: 0,
});

// const rawModel = new ChatOpenAI({
//   model: "gpt-4o-mini",
//   temperature: 0,
//   maxRetries: 0,
// });

const searchTool = tool(
  async ({ query }: { query: string }) => {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        max_results: MAX_SEARCH_RESULTS,
      }),
    });

    if (!resp.ok) {
      throw new Error("Failed to search");
    }

    const data = await resp.json();
    const results: TTavilySearchResult[] = data?.results ?? [];

    return results;
  },
  {
    name: "searchTool",
    description:
      "Use Tavily to search the web for relevant results according to the user's query.",
    schema: z.object({
      query: z.string(),
    }),
  }
);

const routerNode = async (state: typeof RootGraphState.State) => {
  const query = state.currentQuery;

  const prompt = ChatPromptTemplate.fromTemplate(`
    You are a query analyzer. Your task is to determine if the user's query is:
    1. A clear, searchable question that can be answered by searching the internet
    2. An unclear or ambiguous query that needs clarification
    3. A non-searchable query (like a command, greeting, or statement)

    User query: {query}

    Respond with one of these exact values:
    - "${ERouterResult.SEARCH}" if the query is clear and searchable
    - "${ERouterResult.UNCLEAR}" if the query is ambiguous or needs clarification
    - "${ERouterResult.NOT_SEARCHABLE}" if the query cannot be answered by searching
  `);

  const schema = z.object({
    decision: z.nativeEnum(ERouterResult).describe("The routing decision"),
    explanation: z.string().describe("Brief explanation of the decision"),
  });

  const model = rawModel.withStructuredOutput(schema);
  const chain = prompt.pipe(model);

  const result = await chain.invoke({
    query,
  });

  if (
    [ERouterResult.UNCLEAR, ERouterResult.NOT_SEARCHABLE].includes(
      result.decision
    )
  ) {
    return {
      route: result.decision,
      messages: [
        new AIMessage(
          result.decision === ERouterResult.UNCLEAR
            ? "I need more information to help you effectively. Could you please clarify your question?"
            : "I understand your message, but I'm designed to help with searchable questions. Could you please ask a question that I can search for?"
        ),
      ],
    };
  }

  return {
    route: ERouterResult.SEARCH,
  };
};

const createSearchMessages = (
  query: string,
  results: TTavilySearchResult[]
) => {
  const messageId = randomUUID();

  return [
    new AIMessage({
      content: "",
      tool_calls: [
        {
          id: messageId,
          name: "searchTool",
          type: "tool_call",
          args: { query },
        },
      ],
    }),
    new ToolMessage({
      name: "searchTool",
      tool_call_id: messageId,
      content: JSON.stringify(results),
    }),
  ];
};

const searchNode = async (state: typeof RootGraphState.State) => {
  const transformQuery = async (query: string) => {
    const prompt = ChatPromptTemplate.fromTemplate(`
        You are a query transformer.

        Here is the user query: {query}

        Rewrite the query to be more specific and to the point.
        Make sure to keep the original meaning and intent of the query.
      `);

    const schema = z.object({
      query: z.string().describe("The transformed query"),
    });

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      temperature: 0,
      maxRetries: 0,
    }).withStructuredOutput(schema);

    const chain = prompt.pipe(model);

    const resp = await chain.invoke({
      query,
    });

    return resp.query;
  };

  const getSearchResults = async (query: string) => {
    const toolResult: TTavilySearchResult[] = await searchTool.invoke({
      query,
    });

    const filteredResults = toolResult
      .filter((result) => result.score >= THRESHOLD_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, MIN_SEARCH_RESULTS);

    return filteredResults;
  };

  let currentQuery = state.currentQuery;
  let filteredResults: TTavilySearchResult[] = [];

  for (let i = 0; i < MAX_SEARCH_ATTEMPTS; i++) {
    if (filteredResults.length >= REQUERD_SEARCH_RESULTS) {
      break;
    }
    if (i > 0) {
      currentQuery = await transformQuery(currentQuery);
    }
    filteredResults = await getSearchResults(currentQuery);
  }

  return {
    currentQuery,
    messages: createSearchMessages(currentQuery, filteredResults),
  };
};

const afterSearchNode = async (state: typeof RootGraphState.State) => {
  return {
    route: "",
    messages: [
      new AIMessage({
        content:
          "Please select one or more search results. If you'd like to start a new search, simply ask a new question.",
      }),
    ],
  };
};

export default async function agent({
  query,
  stream,
}: {
  query: string;
  stream: StreamingApi;
}) {
  const graph = new StateGraph(RootGraphState)
    .addNode("router", routerNode)
    .addNode("search", searchNode)
    .addNode("afterSearch", afterSearchNode)
    .addEdge(START, "router")
    .addConditionalEdges(
      "router",
      (state: typeof RootGraphState.State) => state.route,
      {
        [ERouterResult.SEARCH]: "search",
        [ERouterResult.UNCLEAR]: END,
        [ERouterResult.NOT_SEARCHABLE]: END,
      }
    )
    .addEdge("search", "afterSearch")
    .addEdge("afterSearch", END);

  // Setup memory
  const memory = new MemorySaver();

  // Setup config
  const config = {
    configurable: { thread_id: "1" },
    streamMode: "values" as const,
  };

  const runner = graph.compile({
    checkpointer: memory,
  });

  const inputs = {
    messages: [new HumanMessage(query)],
    currentQuery: query,
  };

  for await (const event of await runner.stream(inputs, config)) {
    console.log("event", event);
    console.log("--------------------------------");
    await stream.write(JSON.stringify(event));
  }
}
