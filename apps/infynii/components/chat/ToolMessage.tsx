import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import type { TTavilySearchResult } from "@jpvnk/infynii-shared";
import { SearchResultCard } from "./SearchResultCard";

type TToolMessageProps = {
  searchResults: TTavilySearchResult[];
  searchId?: string;
};

export const ToolMessage = ({ searchResults, searchId }: TToolMessageProps) => (
  <View style={styles.searchResultContainer}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      pagingEnabled
      snapToInterval={292} // searchResult width (280) + marginRight (12)
      decelerationRate="fast"
      snapToAlignment="start"
    >
      {searchResults.map((result) => {
        const isLast = result === searchResults[searchResults.length - 1];
        return (
          <SearchResultCard
            key={result.id}
            result={result}
            isLast={isLast}
            searchId={searchId}
          />
        );
      })}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  searchResultContainer: {
    borderRadius: 16,
    marginBottom: 12,
  },
});
