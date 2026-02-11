import React, { forwardRef, useCallback, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { Picker } from "@react-native-picker/picker";

type TFrequency = {
  created_at: string;
  id: number;
  name: string;
};

type TFrequencyBottomSheetProps = {
  frequencies: TFrequency[];
  selectedFrequency: string;
  onFrequencySelect: (frequencyId: string) => void;
};

const colors = {
  white: "#FFFFFF",
  black: "#000",
  primaryText: "#1A1A1A",
  secondaryText: "#666666",
};

const FrequencyBottomSheet = forwardRef<BottomSheet, TFrequencyBottomSheetProps>(
  ({ frequencies, selectedFrequency, onFrequencySelect }, ref) => {
    const snapPoints = useMemo(() => ['42%'], []);

    const handleFrequencySelect = useCallback((itemValue: string) => {
      if (!itemValue) {
        return;
      }
      onFrequencySelect(itemValue);
    }, [onFrequencySelect]);

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          <Text style={styles.bottomSheetTitle}>Select Frequency</Text>
          <Text style={styles.bottomSheetSubtitle}>Choose how often you'd like to receive updates</Text>
          <Picker
            selectedValue={selectedFrequency}
            onValueChange={handleFrequencySelect}
            style={styles.picker}
          >
            <Picker.Item label="Choose a frequency..." value="" />
            {frequencies.map((frequency) => (
              <Picker.Item
                key={frequency.id}
                label={frequency.name}
                value={frequency.id.toString()}
              />
            ))}
          </Picker>
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

FrequencyBottomSheet.displayName = "FrequencyBottomSheet";

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  bottomSheetContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 84,
    flex: 1,
    overflow: "hidden",
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: colors.primaryText,
    marginBottom: 6,
    textAlign: "center",
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: colors.secondaryText,
    textAlign: "center",
    marginBottom: 12,
  },
  picker: {
    width: "100%",
    height: 120,
    marginTop: 5,
  },
});

export default FrequencyBottomSheet;