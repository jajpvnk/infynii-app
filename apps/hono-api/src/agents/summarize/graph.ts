import { StateGraph, END, START } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { contentFetchTool } from "./tools.js";
import { graphLogger } from "../logger.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GEMINI_MODEL_CONFIG } from "./constants.js";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  type TSummarizeState,
  SummarizeGraphStatus,
  SummarizeGraphState,
} from "@jpvnk/infynii-shared/server";


export const rawModel = new ChatGoogleGenerativeAI(GEMINI_MODEL_CONFIG);

// Create the summarize node
const createSummarizeNode = () => {
  return async (state: TSummarizeState) => {
    const summarizeLogger = graphLogger.child("📝 [SUMMARIZE_NODE]");
    summarizeLogger.info("Node execution started");
    summarizeLogger.debug("Input state:", state);

    try {
      // Fetch content using Tavily
      summarizeLogger.info("Fetching content from URL:", state.url);
      const contentResult = await contentFetchTool.invoke({
        url: state.url,
      });

      type TSummaryOutput = {
        summary: string;
      };

      const schema = {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Well-structured summary capturing main points in 20-30% length",
          },
        },
        required: ["summary"],
      } as const;

      const prompt = ChatPromptTemplate.fromTemplate(`
        You are a professional summarizer.

        Summarize the content below. The summary should:
        1) Capture main points and key information
        2) Be clear, concise, and readable
        3) Preserve original meaning and context
        4) Be approximately 20-30% of the original length

        Content:
        {content}
      `);

      const model = rawModel.withStructuredOutput<TSummaryOutput>(schema);
      const chain = prompt.pipe(model);

      const result = await chain.invoke({
        content: contentResult.content,
      });

      summarizeLogger.info("Result:", result);

      const summaryMessage = new AIMessage({
        content: result.summary,
      });

      return {
        status: SummarizeGraphStatus.FINISHED,
        messages: [summaryMessage],
        content: contentResult.content,
        summary: result.summary,
      };
    } catch (error) {
      summarizeLogger.error("Error in summarize node:", error);

      const errorMessage = new AIMessage(
        `\n\n**Error:** ${
          error instanceof Error ? error.message : "Failed to generate summary"
        }`
      );

      return {
        status: SummarizeGraphStatus.ERROR,
        messages: [errorMessage],
      };
    }
  };
};

// Setup the graph
export const setupSummarizeGraph = () => {
  const summarizeNode = createSummarizeNode();

  const workflow = new StateGraph(SummarizeGraphState)
    .addNode("summarize", summarizeNode)
    .addEdge(START, "summarize")
    .addEdge("summarize", END);

  return workflow.compile();
};
