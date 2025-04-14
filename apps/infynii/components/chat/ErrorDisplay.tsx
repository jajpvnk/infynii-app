import React from "react";
import { View, Text, StyleSheet } from "react-native";

type TErrorDisplayProps = {
  error: string;
};

export const ErrorDisplay = ({ error }: TErrorDisplayProps) => (
  <View style={styles.errorContainer}>
    <Text style={styles.error}>{error}</Text>
  </View>
);

const styles = StyleSheet.create({
  error: {
    color: "red",
    textAlign: "left",
  },
  errorContainer: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#ffebee",
    backgroundColor: "#ffebee",
  },
});
