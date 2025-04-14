import z from "zod";

import {
  type TGraphStatus,
  type TTavilySearchResult,
  type TTavilySearchResultRaw,
} from "@jpvnk/infynii-shared";
import {
  RootGraphState,
  type TSearchState,
} from "@jpvnk/infynii-shared/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AIMessage } from "@langchain/core/messages";
import { GraphStatus } from "@jpvnk/infynii-shared";

import supabaseAdmin from "../../supabase.js";
import { graphLogger } from "../logger.js";
import {
  GEMINI_MODEL_CONFIG,
  MAX_SEARCH_ATTEMPTS,
  MIN_SEARCH_RESULTS,
  THRESHOLD_SCORE,
} from "./constants.js";
import { rawModel, searchTool, createSearchToolMessages } from "./tools.js";
import { randomUUID } from "node:crypto";

const createStartRouter = (searchId: string) => {
  return async (state: TSearchState) => {
    const { currentQuery, searchAttempts } = state;
    const startRouterLogger = graphLogger.child("🚀 [START_ROUTER]");
    startRouterLogger.info("Node execution started");
    startRouterLogger.debug("Input state:", state);
    startRouterLogger.info("Current query:", currentQuery);
    startRouterLogger.info("Search attempts:", searchAttempts);
    startRouterLogger.debug("Search ID:", searchId);

    if (searchAttempts >= MAX_SEARCH_ATTEMPTS) {
      startRouterLogger.warn(
        "Maximum search attempts reached:",
        searchAttempts
      );
      const result = {
        status: GraphStatus.FINISHED,
        messages: [
          new AIMessage({
            content:
              "I've tried to answer your question, but I couldn't find any relevant information.",
          }),
        ],
      };
      startRouterLogger.info(
        "Returning FINISHED status due to max attempts:",
        result
      );
      return result;
    }

    const prompt = ChatPromptTemplate.fromTemplate(`
      You are a query analyzer. Your task is to determine if the user's query is:
      1. A clear, searchable question that can be answered by searching the internet
      2. An unclear or ambiguous query that needs clarification
      3. A non-searchable query (like a command, greeting, or statement)

      User query: {query}

      Respond with one of these exact values:
      - "${GraphStatus.SEARCHABLE}" if the query is clear and searchable
      - "${GraphStatus.UNCLEAR}" if the query is ambiguous or needs clarification
      - "${GraphStatus.NOT_SEARCHABLE}" if the query cannot be answered by searching
    `);

    const schema = z.object({
      status: z.nativeEnum(GraphStatus).describe("The routing decision"),
      explanation: z.string().describe("Brief explanation of the decision"),
    });

    const model = rawModel.withStructuredOutput(schema);
    const chain = prompt.pipe(model);

    startRouterLogger.info("Invoking AI model to analyze query...");
    const result = await chain.invoke({
      query: currentQuery,
    });
    startRouterLogger.debug("AI analysis result:", result);
    const resultStatus = result.status;

    if (
      resultStatus === GraphStatus.UNCLEAR ||
      resultStatus === GraphStatus.NOT_SEARCHABLE
    ) {
      startRouterLogger.warn(
        "Query classified as non-searchable:",
        result.status
      );
      startRouterLogger.info("Updating database to clear query...");

      const { error: updateError } = await supabaseAdmin
        .from("searches")
        .update({
          query: null,
        })
        .eq("id", searchId);

      if (updateError) {
        startRouterLogger.error("Database update error:", updateError);
      } else {
        startRouterLogger.info("Database updated successfully");
      }

      const finalResult = {
        status: result.status,
        searchAttempts: searchAttempts + 1,
        messages: [
          new AIMessage(
            result.status === GraphStatus.UNCLEAR
              ? "I need more information to help you effectively. Could you please clarify your question?"
              : "I understand your message, but I'm designed to help with searchable questions. Could you please ask a question that I can search for?"
          ),
        ],
      };
      startRouterLogger.info("Returning non-searchable result:", finalResult);
      return finalResult;
    }

    startRouterLogger.info("Query is searchable, proceeding to search");
    const searchableResult = {
      status: GraphStatus.SEARCHABLE,
    };
    startRouterLogger.debug("Returning searchable result:", searchableResult);
    return searchableResult;
  };
};

const createTransformQueryNode = () => {
  return async (state: TSearchState) => {
    const query = state.currentQuery;
    const transformLogger = graphLogger.child("🔄 [TRANSFORM_QUERY]");
    transformLogger.info("Node execution started");
    transformLogger.debug("Input state:", state);
    transformLogger.info("Original query:", query);

    const prompt = ChatPromptTemplate.fromTemplate(`
      You are a query transformer.

      Here is the user query: {query}

      Rewrite the query to be more specific and to the point.
      Make sure to keep the original meaning and intent of the query.

      Provide maximum of three alternative queries.
    `);
    transformLogger.debug("Prompt template created");

    const schema = z.object({
      alternatives: z.array(z.string()).describe("Alternative queries"),
    });
    transformLogger.debug("Schema defined for structured output");

    const model = new ChatGoogleGenerativeAI(
      GEMINI_MODEL_CONFIG
    ).withStructuredOutput(schema);
    transformLogger.debug(
      "Model initialized with config:",
      GEMINI_MODEL_CONFIG
    );

    const chain = prompt.pipe(model);
    transformLogger.info("Chain created, invoking AI...");

    const resp = await chain.invoke({
      query,
    });
    transformLogger.debug("AI transformation result:", resp);
    transformLogger.info("Alternative queries generated:", resp.alternatives);

    const result = {
      status: GraphStatus.NOT_SEARCHABLE,
      alternativeQueries: resp.alternatives ?? [],
      messages: [
        new AIMessage({
          content:
            "I've tried to answer your question, but I couldn't find more relevant information.",
        }),
      ],
    };
    transformLogger.debug("Returning result:", result);
    return result;
  };
};

const createSearchNode = () => {
  return async (state: TSearchState) => {
    const { currentQuery, searchAttempts } = state;
    const searchNodeLogger = graphLogger.child("🔍 [SEARCH_NODE]");
    searchNodeLogger.info("Node execution started");
    searchNodeLogger.debug("Input state:", state);
    searchNodeLogger.info("Current query:", currentQuery);
    searchNodeLogger.info("Search attempts:", searchAttempts);

    searchNodeLogger.info("Invoking search tool...");
    const toolResult = await searchTool.invoke({
      query: currentQuery,
    });
    searchNodeLogger.info("Raw search results count:", toolResult?.length || 0);
    searchNodeLogger.debug("Raw search results:", toolResult);

    searchNodeLogger.info(
      "Filtering results with threshold score:",
      THRESHOLD_SCORE
    );
    const filteredResults: TTavilySearchResult[] = toolResult
      .filter((result: TTavilySearchResult) => result.score >= THRESHOLD_SCORE)
      .sort(
        (a: TTavilySearchResultRaw, b: TTavilySearchResultRaw) =>
          b.score - a.score
      )
      .map((result: TTavilySearchResultRaw) => ({
        id: randomUUID(),
        ...result,
      }));

    searchNodeLogger.info("Filtered results count:", filteredResults.length);
    searchNodeLogger.debug(
      "Filtered results scores:",
      filteredResults.map((r: TTavilySearchResultRaw) => r.score)
    );
    searchNodeLogger.debug("Filtered results:", filteredResults);

    searchNodeLogger.info("Creating search tool messages...");

    const { messages, currentSearchToolId } = createSearchToolMessages(
      currentQuery,
      filteredResults
    );
    searchNodeLogger.debug("Generated search tool ID:", currentSearchToolId);
    searchNodeLogger.info("Generated messages count:", messages?.length || 0);

    const result = {
      currentQuery,
      searchAttempts: searchAttempts + 1,
      messages,
      currentSearch: {
        toolId: currentSearchToolId,
        items: filteredResults,
      },
    };
    searchNodeLogger.debug("Returning result:", result);
    return result;
  };
};

const createAfterSearchRouter = (searchId: string) => {
  return async (state: TSearchState) => {
    const { currentSearch, currentQuery } = state;
    const afterSearchLogger = graphLogger.child("🔀 [AFTER_SEARCH_ROUTER]");
    afterSearchLogger.debug("Search ID:", searchId);
    afterSearchLogger.info("Node execution started");
    afterSearchLogger.debug("Input state:", state);
    afterSearchLogger.info("Current query:", currentQuery);
    afterSearchLogger.debug("Current search:", currentSearch);
    afterSearchLogger.info(
      "Search results length:",
      currentSearch.items?.length ?? 0
    );
    afterSearchLogger.info("Minimum required results:", MIN_SEARCH_RESULTS);

    if ((currentSearch.items?.length ?? 0) < MIN_SEARCH_RESULTS) {
      afterSearchLogger.warn("Insufficient search results, transforming query");
      const transformResult = {
        status: GraphStatus.TRANSFORMING,
      };
      afterSearchLogger.info("Returning TRANSFORMING status:", transformResult);
      return transformResult;
    }

    afterSearchLogger.info("Sufficient results found, updating database...");
    const { error: updateError } = await supabaseAdmin
      .from("searches")
      .update({
        query: currentQuery,
      })
      .eq("id", searchId);

    if (updateError) {
      afterSearchLogger.error("Database update error:", updateError);
    } else {
      afterSearchLogger.info("Database updated successfully");
    }

    if (currentSearch?.items?.length) {
      afterSearchLogger.info("Inserting search results into database...");
      console.log("currentSearch.items", currentSearch.items);
      const { error: insertItemsError } = await supabaseAdmin
        .from("searches_results")
        .insert(currentSearch.items.map((item) => ({
          id: item.id,
          search_id: searchId,
          title: item.title,
          url: item.url,
          content: item.content,
          score: item.score,
        })));

      if (insertItemsError) {
        afterSearchLogger.error(
          "Database search results insert error:",
          insertItemsError
        );
      } else {
        afterSearchLogger.info("Database search results inserted successfully");
      }
    }

    const finishedResult = {
      status: GraphStatus.FINISHED,
      messages: [
        new AIMessage({
          content:
            "Select frequency to how often you want me to search for more information about the topic. If you want me to search again, just ask new question.",
          additional_kwargs: {
            selectFrequency: true,
          },
        }),
      ],
      currentSearch,
    };
    afterSearchLogger.info("Returning FINISHED status:", finishedResult);
    return finishedResult;
  };
};

export const setupGraph = (searchId: string) => {
  const startRouter = createStartRouter(searchId);
  const transformQueryNode = createTransformQueryNode();
  const searchNode = createSearchNode();
  const afterSearchRouter = createAfterSearchRouter(searchId);

  return new StateGraph(RootGraphState)
    .addNode("start", startRouter)
    .addNode("search", searchNode)
    .addNode("transform_query", transformQueryNode)
    .addNode("after_search", afterSearchRouter)
    .addEdge(START, "start")
    .addConditionalEdges("start", (state: TSearchState) => state.status, {
      [GraphStatus.SEARCHABLE]: "search",
      [GraphStatus.TRANSFORMING]: "transform_query",
      [GraphStatus.UNCLEAR]: END,
      [GraphStatus.NOT_SEARCHABLE]: END,
      [GraphStatus.FINISHED]: END,
    })
    .addEdge("search", "after_search")
    .addConditionalEdges(
      "after_search",
      (state: TSearchState) => state.status,
      {
        [GraphStatus.SEARCHABLE]: "search",
        [GraphStatus.TRANSFORMING]: "transform_query",
        [GraphStatus.FINISHED]: END,
      }
    )
    .addEdge("transform_query", END);
};
