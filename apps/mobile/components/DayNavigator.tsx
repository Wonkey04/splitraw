import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/colors";
import { dayLabel } from "@/constants/days";

interface DayNavigatorProps {
  currentDay: number;
  onPrevious: () => void;
  onNext: () => void;
}

export function DayNavigator({ currentDay, onPrevious, onNext }: DayNavigatorProps) {
  return (
    <View style={styles.container}>
      <Pressable style={styles.button} onPress={onPrevious} hitSlop={8}>
        <Text style={styles.buttonText}>{"< Anterior"}</Text>
      </Pressable>

      <Text style={styles.dayLabel}>{dayLabel(currentDay)}</Text>

      <Pressable style={styles.button} onPress={onNext} hitSlop={8}>
        <Text style={styles.buttonText}>{"Próximo >"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingVertical: 12,
  },
  button: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  buttonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  dayLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "bold",
  },
});
