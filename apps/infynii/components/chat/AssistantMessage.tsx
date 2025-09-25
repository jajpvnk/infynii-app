import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Timer } from "lucide-react-native";
import { formatTimestamp } from "@/utils/chatUtils";

export const MESSAGE_ACTION_SELECT_FREQUENCY = "select-frequency" as const;
export const MESSAGE_ACTIONS = [MESSAGE_ACTION_SELECT_FREQUENCY] as const;
export type TMessageActions = (typeof MESSAGE_ACTIONS)[number][];

type TAssistantMessageProps = {
  content: string;
  timestamp: string;
  actions: TMessageActions;
  onSelectFrequency?: () => void;
};

export const AssistantMessage = ({
  content,
  timestamp,
  actions,
  onSelectFrequency,
}: TAssistantMessageProps) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isAnimating, setIsAnimating] = useState(true);
  const currentWordIndex = useRef(0);

  const words = content.split(" ");

  useEffect(() => {
    if (isAnimating) {
      const interval = setInterval(() => {
        currentWordIndex.current++;
        if (currentWordIndex.current >= words.length) {
          setIsAnimating(false);
          clearInterval(interval);
        }
        setDisplayedText(words.slice(0, currentWordIndex.current).join(" "));
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isAnimating, words.length]);

  const handleActionPress = (action: string) => {
    if (action === MESSAGE_ACTION_SELECT_FREQUENCY) {
      onSelectFrequency?.();
    }
  };

  return (
    <View style={[styles.messageContainer, styles.otherMessage]}>
      <View style={styles.messageContent}>
        <Text style={styles.messageText}>{displayedText}</Text>

        {!isAnimating && !!actions.length && (
          <View style={styles.actionsContainer}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action}
                style={styles.actionButton}
                onPress={() => handleActionPress(action)}
              >
                {action === MESSAGE_ACTION_SELECT_FREQUENCY && (
                  <>
                    <Timer size={16} color="#fff" />
                    <Text style={styles.actionButtonText}>
                      Select frequency
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Text style={styles.timestamp}>
          {formatTimestamp(timestamp)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    color: "#1A1A1A",
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
    color: "#666",
  },
  actionsContainer: {
    flexDirection: "row",
    rowGap: 5,
    marginVertical: 10,
  },
  actionButton: {
    width: "100%",
    flexDirection: "row",
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginLeft: 5,
  },
});
