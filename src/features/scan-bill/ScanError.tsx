import { fontFamily } from "@/src/theme/fonts";
import {
  Pressable,
  Text,
  View
} from "react-native";


import { styles } from "./styles";
import type { useScanBillController } from "./useScanBillController";
type Props = Pick<ReturnType<typeof useScanBillController>, "tokens" | "space" | "radius" | "type" | "router" | "errorMsg">;
export function ScanError({ tokens, space, radius, type, router, errorMsg }: Props) {
  return (<View
    style={[
      styles.centerFill,
      { paddingHorizontal: space.lg, gap: space.lg },
    ]}
  >
    <Text
      style={{
        color: tokens.text2,
        fontFamily: fontFamily.bodyMedium,
        fontSize: type.body,
        textAlign: "center",
      }}
    >
      {errorMsg}
    </Text>
    <Pressable
      onPress={() => router.replace("/modals/log-expense")}
      style={[
        styles.confirm,
        {
          backgroundColor: tokens.accent,
          borderRadius: radius.full,
          paddingVertical: space.md,
          paddingHorizontal: space.xl,
        },
      ]}
    >
      <Text
        style={{
          color: tokens.onAccent,
          fontFamily: fontFamily.bodyBold,
          fontSize: type.bodyLg,
        }}
      >
        Enter manually
      </Text>
    </Pressable>
  </View>);
}
