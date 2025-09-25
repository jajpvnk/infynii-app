import type { TSerializedMessage } from "@jpvnk/infynii-shared";
import {
  AIMessage,
  ToolMessage,
  type BaseMessage,
  type MessageContent,
} from "@langchain/core/messages";

const getMessageContent = (content: MessageContent) => {
  if (content instanceof Array) {
    for (const item of content) {
      if (item.type === "text") {
        return item.text;
      }
      if (item.type === "image_url") {
        if (typeof item.image_url === "string") {
          return item.image_url;
        }
        if (typeof item.image_url === "object" && "url" in item.image_url) {
          return item.image_url.url;
        }
      }
    }
  }
  return content;
};

export const serializeMessage = (message: BaseMessage): TSerializedMessage => {
  const baseSerialized = {
    id: crypto.randomUUID(),
    type: message.getType(),
    content: getMessageContent(message.content),
    name: message.name,
    timestamp: new Date().toUTCString(),
    additional_kwargs: message.additional_kwargs,
  };

  if (message instanceof AIMessage) {
    return {
      ...baseSerialized,
      tool_calls:
        message.tool_calls?.map((toolCall) => ({
          id: toolCall.id,
          name: toolCall.name,
          type: "tool_call",
          args: toolCall.args,
        })) ?? [],
    };
  }

  if (message instanceof ToolMessage) {
    return {
      ...baseSerialized,
      tool_call_id: message.tool_call_id,
    };
  }

  return baseSerialized;
};
