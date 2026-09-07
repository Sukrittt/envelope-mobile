import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";

import { fontFamily } from "@/src/theme/fonts";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  color: string;
  placeholderColor: string;
  fontSize: number;
  fillAvailableWidth?: boolean;
};

/**
 * Keeps long receipt names out of the amount column while still allowing the
 * scanned text to be inspected and corrected in place.
 */
export function ExpandableItemNameInput({
  value,
  onChangeText,
  color,
  placeholderColor,
  fontSize,
  fillAvailableWidth = false,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const nameStyle = fillAvailableWidth ? styles.fillName : styles.name;

  if (isEditing) {
    return (
      <TextInput
        accessibilityLabel="Item name"
        autoFocus
        multiline
        scrollEnabled={false}
        value={value}
        onChangeText={onChangeText}
        onBlur={() => setIsEditing(false)}
        placeholder="Item"
        placeholderTextColor={placeholderColor}
        style={[
          nameStyle,
          styles.input,
          { color, fontFamily: fontFamily.bodyBold, fontSize },
        ]}
      />
    );
  }

  return (
    <Pressable
      accessibilityLabel={`Show full item name: ${value || "Item"}`}
      onPress={() => setIsEditing(true)}
      style={nameStyle}
    >
      <Text
        ellipsizeMode="tail"
        numberOfLines={1}
        style={{ color, fontFamily: fontFamily.bodyBold, fontSize }}
      >
        {value || "Item"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  name: {
    flexBasis: "60%",
    flexGrow: 0,
    flexShrink: 1,
    maxWidth: "60%",
  },
  fillName: {
    flex: 1,
    minWidth: 0,
  },
  input: {
    padding: 0,
    textAlignVertical: "top",
  },
});
