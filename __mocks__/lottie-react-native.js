// The real component is a native view, unavailable under Jest. Render nothing —
// tests assert on the readout, not the animation.
const React = require('react')

const LottieView = React.forwardRef(function LottieView(_props, _ref) {
  return null
})

module.exports = LottieView
module.exports.default = LottieView
