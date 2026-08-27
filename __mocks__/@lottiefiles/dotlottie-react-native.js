// The real component is a native view (requireNativeComponent), unavailable
// under Jest. Render nothing — tests assert on the readout, not the animation.
const React = require('react')

const DotLottie = React.forwardRef(function DotLottie(_props, _ref) {
  return null
})

const Mode = { FORWARD: 0, REVERSE: 1, BOUNCE: 2, REVERSE_BOUNCE: 3 }

module.exports = { DotLottie, Mode }
