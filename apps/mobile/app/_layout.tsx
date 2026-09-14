import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <>
      {/* Light-first: la barra de estado va en oscuro sobre fondo claro. */}
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgPrimary },
        }}
      />
    </>
  );
}
