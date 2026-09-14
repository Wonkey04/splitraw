import { StyleSheet, View } from "react-native";
import { colors } from "@/theme";

export type IconName = "list" | "pin" | "logout" | "check";

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
