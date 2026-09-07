import { View, StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'
import { LoadingPhrase } from './LoadingPhrase'

/**
 * Guards the one thing about this component that fails silently: the phrase is
 * absolutely positioned, so it adds nothing to the wrapper's measured width. If
 * the wrapper stops stretching, a parent with `alignItems: 'center'` collapses
 * it to zero wide and `overflow: 'hidden'` clips the text away. No error, no
 * warning, just a blank screen (which is exactly how it shipped).
 */
it('the wrapper stretches, so a centering parent cannot collapse it to zero width', () => {
  const { getByText } = render(
    <View style={{ alignItems: 'center' }}>
      <LoadingPhrase phrases={['Checking what repeats…']} color="#fff" />
    </View>,
  )

  // Walk up to the clipping wrapper (the one with the fixed height) rather than
  // assuming a depth, since the text renders through an Animated wrapper.
  let node = getByText('Checking what repeats…').parent
  while (node && StyleSheet.flatten(node.props.style)?.height !== 22) node = node.parent

  expect(node).not.toBeNull()
  expect(StyleSheet.flatten(node?.props.style)).toMatchObject({ alignSelf: 'stretch' })
})

it('renders the first phrase', () => {
  const { getByText } = render(<LoadingPhrase phrases={['One…', 'Two…']} color="#fff" />)
  expect(getByText('One…')).toBeTruthy()
})
