import { StyleSheet, View } from "react-native";
import { colors } from "@/theme";

export type IconName = "list" | "pin" | "logout" | "check" | "person" | "calendarOff";

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

/**
 * Íconos geométricos dibujados con Views. El proyecto no tiene librería de
 * íconos (ni react-native-svg), y branding.md prohíbe iconografía de
 * fitness, así que estas formas neutras alcanzan y evitan sumar una
 * dependencia. El color se hereda del texto que acompañan.
 */
export function Icon({ name, size = 16, color = colors.textSecondary }: IconProps) {
  if (name === "list") {
    return (
      <View style={{ width: size, height: size, justifyContent: "space-between", paddingVertical: size * 0.15 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.bar, { backgroundColor: color, width: i === 2 ? size * 0.6 : size }]} />
        ))}
      </View>
    );
  }

  if (name === "pin") {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: size * 0.75,
            height: size * 0.75,
            borderRadius: size * 0.375,
            borderWidth: 1.5,
            borderColor: color,
          }}
        />
        <View
          style={{
            position: "absolute",
            width: size * 0.2,
            height: size * 0.2,
            borderRadius: size * 0.1,
            backgroundColor: color,
          }}
        />
      </View>
    );
  }

  if (name === "check") {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: size * 0.5,
            height: size * 0.28,
            borderLeftWidth: 1.5,
            borderBottomWidth: 1.5,
            borderColor: color,
            transform: [{ rotate: "-45deg" }],
            marginTop: -size * 0.1,
          }}
        />
      </View>
    );
  }

  if (name === "person") {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "flex-end" }}>
        <View
          style={{
            width: size * 0.36,
            height: size * 0.36,
            borderRadius: size * 0.18,
            borderWidth: 1.5,
            borderColor: color,
            marginBottom: size * 0.08,
          }}
        />
        <View
          style={{
            width: size * 0.68,
            height: size * 0.34,
            borderTopLeftRadius: size * 0.34,
            borderTopRightRadius: size * 0.34,
            borderWidth: 1.5,
            borderBottomWidth: 0,
            borderColor: color,
          }}
        />
      </View>
    );
  }

  if (name === "calendarOff") {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: size * 0.8,
            height: size * 0.7,
            borderRadius: size * 0.1,
            borderWidth: 1.5,
            borderColor: color,
          }}
        />
        <View
          style={{
            position: "absolute",
            top: size * 0.06,
            width: size * 0.8,
            height: 1.5,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            position: "absolute",
            width: size * 0.9,
            height: 1.5,
            backgroundColor: color,
            transform: [{ rotate: "-40deg" }],
          }}
        />
      </View>
    );
  }

  // logout: barra vertical + punta de flecha saliendo hacia la derecha.
  return (
    <View style={{ width: size, height: size, flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: 1.5, height: size, backgroundColor: color }} />
      <View style={{ flex: 1, alignItems: "center" }}>
        <View
          style={{
            width: size * 0.4,
            height: size * 0.4,
            borderTopWidth: 1.5,
            borderRightWidth: 1.5,
            borderColor: color,
            transform: [{ rotate: "45deg" }],
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 1.5, borderRadius: 1 },
});

export default Icon;
