import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { ExpandableItemNameInput } from "./ExpandableItemNameInput";

const LONG_NAME = "Aashirvaad Svasti 90% Lower Cholesterol Cow Ghee";

describe("ExpandableItemNameInput", () => {
  it("truncates the resting name and reveals the full editable value when pressed", () => {
    const onChangeText = jest.fn();
    const view = render(
      <ExpandableItemNameInput
        value={LONG_NAME}
        onChangeText={onChangeText}
        color="#fff"
        placeholderColor="#777"
        fontSize={16}
      />,
    );

    const collapsedName = view.getByText(LONG_NAME);
    expect(collapsedName.props.numberOfLines).toBe(1);
    expect(collapsedName.props.ellipsizeMode).toBe("tail");
    expect(
      StyleSheet.flatten(
        view.getByLabelText(`Show full item name: ${LONG_NAME}`).props.style,
      ).maxWidth,
    ).toBe("60%");

    fireEvent.press(view.getByLabelText(`Show full item name: ${LONG_NAME}`));

    const expandedName = view.getByLabelText("Item name");
    expect(expandedName.props.multiline).toBe(true);
    expect(expandedName.props.scrollEnabled).toBe(false);
    expect(expandedName.props.value).toBe(LONG_NAME);

    fireEvent.changeText(expandedName, "Cow Ghee");
    expect(onChangeText).toHaveBeenCalledWith("Cow Ghee");

    fireEvent(expandedName, "blur");
    expect(view.getByText(LONG_NAME)).toBeTruthy();
  });

  it("can fill the available row width", () => {
    const view = render(
      <ExpandableItemNameInput
        value="Delivery Fee"
        onChangeText={jest.fn()}
        color="#fff"
        placeholderColor="#777"
        fontSize={14}
        fillAvailableWidth
      />,
    );

    expect(
      StyleSheet.flatten(
        view.getByLabelText("Show full item name: Delivery Fee").props.style,
      ).flex,
    ).toBe(1);
  });
});
