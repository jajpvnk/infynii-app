import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Send } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  text: string;
  sender: "user" | "other";
  timestamp: Date;
};

const messagesData: Message[] = [
  {
    id: "12",
    text: "Hey there 12! 👋",
    sender: "other",
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: "11",
    text: "Hi! How are you 11?",
    sender: "user",
    timestamp: new Date(Date.now() - 3000000),
  },
  {
    id: "10",
    text: "Hey there 10! 👋",
    sender: "other",
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: "9",
    text: "Hi! How are you 9?",
    sender: "user",
    timestamp: new Date(Date.now() - 3000000),
  },
  {
    id: "8",
    text: "Hey there 8! 👋",
    sender: "other",
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: "7",
    text: "Hi! How are you 7?",
    sender: "user",
    timestamp: new Date(Date.now() - 3000000),
  },
  {
    id: "6",
    text: "Hey there 6! 👋",
    sender: "other",
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: "5",
    text: "Hi! How are you 5?",
    sender: "user",
    timestamp: new Date(Date.now() - 3000000),
  },
  {
    id: "4",
    text: "Hey there 4! 👋",
    sender: "other",
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: "3",
    text: "Hi! How are you 3?",
    sender: "user",
    timestamp: new Date(Date.now() - 3000000),
  },
  {
    id: "2",
    text: "Hey there 2! 👋",
    sender: "other",
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: "1",
    text: "Hi! How are you 1?",
    sender: "user",
    timestamp: new Date(Date.now() - 3000000),
  },
];

const renderMessage = ({ item }: { item: Message }) => (
  <View
    style={[
      styles.messageContainer,
      item.sender === "user" ? styles.userMessage : styles.otherMessage,
    ]}
  >
    <Text
      style={[
        styles.messageText,
        item.sender === "user"
          ? styles.userMessageText
          : styles.otherMessageText,
      ]}
    >
      {item.text}
    </Text>
    <Text
      style={[
        styles.timestamp,
        item.sender === "user" ? styles.userTimestamp : styles.otherTimestamp,
      ]}
    >
      {item.timestamp.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </Text>
  </View>
);

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>(messagesData);
  const [newMessage, setNewMessage] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = () => {
    if (newMessage.trim()) {
      setMessages([
        {
          id: Date.now().toString(),
          text: newMessage,
          sender: "user",
          timestamp: new Date(),
        },
        ...messages,
      ]);
      setNewMessage("");
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        inverted={true}
        ref={flatListRef}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={(text) => {
            setNewMessage(text);
          }}
          placeholder="Type a message..."
          multiline={false}
          textAlignVertical="center"
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Send size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
  },
  messagesList: {
    padding: 20,
  },
  messageContainer: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userMessage: {
    backgroundColor: "#007AFF",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: "#F0F0F0",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  userMessageText: {
    color: "#FFFFFF",
  },
  otherMessageText: {
    color: "#1A1A1A",
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  userTimestamp: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  otherTimestamp: {
    color: "#666",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    backgroundColor: "#fff",
    alignItems: "center",
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
  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: "#007AFF",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});
