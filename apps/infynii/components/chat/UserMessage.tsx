import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatTimestamp } from "@/utils/chatUtils";

type TUserMessageProps = {
  content: string;
  timestamp: string;
};

export const UserMessage = ({ content, timestamp }: TUserMessageProps) => (
  <View style={[styles.messageContainer, styles.userMessage]}>
    <View style={styles.messageContent}>
      <Text style={[styles.messageText, styles.userMessageText]}>
        {content}
      </Text>
      <Text style={[styles.timestamp, styles.userTimestamp]}>
        {formatTimestamp(timestamp)}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  messageContainer: {
    maxWidth: "80%",
    borderRadius: 16,
    marginBottom: 12,
  },
  messageContent: {
    padding: 12,
  },
  userMessage: {
    backgroundColor: "#007AFF",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "justify",
  },
  userMessageText: {
    color: "#FFFFFF",
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  userTimestamp: {
    color: "rgba(255, 255, 255, 0.7)",
  },
});
