// Manual Jest mock for react-native-reanimated. The real package (v4) drives
// worklets through the react-native-worklets native module, which isn't
// present under Jest and crashes at import time — including reanimated's own
// shipped `react-native-reanimated/mock`, which still pulls in the real
// engine for its frame-advance test helpers. This mock runs every "worklet"
// synchronously on the JS thread instead: animated components render as
// their plain RN element, shared values are plain refs, and style/animation
// hooks just compute their result once per render. Auto-picked up by Jest
// for every test (no explicit jest.mock needed) since it lives in
// `__mocks__` adjacent to `node_modules`.
const React = require('react')
const RN = require('react-native')

function useSharedValue(initial) {
  const ref = React.useRef({ value: initial })
  return ref.current
}

function useAnimatedStyle(fn) {
  return fn()
}

function useAnimatedProps(fn) {
  return fn()
}

function useDerivedValue(fn) {
  return { value: fn() }
}

function useAnimatedRef() {
  return React.useRef(null)
}

function useAnimatedScrollHandler() {
  return () => {}
}

const identity = (toValue) => toValue

const Easing = {
  linear: identity,
  ease: identity,
  quad: identity,
  cubic: identity,
  bezier: () => identity,
  in: (fn) => fn,
  out: (fn) => fn,
  inOut: (fn) => fn,
}

function createAnimatedComponent(Component) {
  return Component
}

const Animated = {
  View: RN.View,
  ScrollView: RN.ScrollView,
  Text: RN.Text,
  Image: RN.Image,
  FlatList: RN.FlatList,
  createAnimatedComponent,
}

module.exports = {
  __esModule: true,
  default: Animated,
  View: RN.View,
  ScrollView: RN.ScrollView,
  Text: RN.Text,
  Image: RN.Image,
  FlatList: RN.FlatList,
  createAnimatedComponent,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  withSpring: identity,
  withTiming: identity,
  withDelay: (_delay, toValue) => toValue,
  withSequence: (...values) => values[values.length - 1],
  withRepeat: (value) => value,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  interpolate: (value) => value,
  interpolateColor: (_value, _input, outputRange) => outputRange[0],
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Easing,
}
