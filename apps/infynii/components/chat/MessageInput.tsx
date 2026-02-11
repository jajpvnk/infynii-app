import React from "react";
import { View, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Send } from "lucide-react-native";

type TMessageInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isLoading: boolean;
};

export const MessageInput = ({ value, onChangeText, onSend, isLoading }: TMessageInputProps) => (
  <View style={styles.inputContainer}>
    <TextInput
      style={[styles.input, isLoading && styles.inputDisabled]}
      value={value}
      onChangeText={onChangeText}
      placeholder="Type a message..."
      multiline={false}
      textAlignVertical="center"
      editable={!isLoading}
    />
    <TouchableOpacity
      style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
      onPress={onSend}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Send size={24} color="#fff" />
      )}
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    borderTopColor: "#E0E0E0",
    backgroundColor: "#fff",
    alignItems: "center",
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: "#F8F8F8",
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 16,
    marginRight: 12,
    fontFamily: "Inter_400Regular",
  },
  inputDisabled: {
    opacity: 0.7,
  },
  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: "#007AFF",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
});
