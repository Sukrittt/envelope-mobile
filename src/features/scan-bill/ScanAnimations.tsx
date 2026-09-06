import {
  FILL_DELAY
} from "@/src/components/envelope/ProgressBar";
import { AmountText } from "@/src/components/ui/AmountText";
import { useProgressWidth } from '@/src/components/ui/useProgressWidth';
import { useEffect, useState } from "react";
import {
  Animated,
  View
} from "react-native";


import { styles } from "./styles";
export function RevealBar({
  pct,
  color,
  trackColor,
  height,
}: {
  pct: number;
  color: string;
  trackColor: string;
  height: number;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const width = useProgressWidth(trackWidth, Math.max(0, Math.min(100, pct)));

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[styles.barTrack, { height, backgroundColor: trackColor }]}
    >
      <Animated.View
        style={[styles.barFill, { width, backgroundColor: color }]}
      />
    </View>
  );
}

/** A hero amount that rolls up from ₹0 on mount instead of just appearing —
 * for the confirm phase's total, which (unlike the review phase's live
 * "your share") never changes again once you're on this screen. */
export function RevealAmount({
  value,
  size,
  color,
}: {
  value: number;
  size: number;
  color: string;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDisplay(value), FILL_DELAY);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <AmountText
      value={display}
      size={size}
      color={color}
      weight="displaySemiBold"
      animate
      ignoreHide
    />
  );
}

