// Set before worker processes fork, not in setupFiles: by the time setupFiles
// runs inside a worker, V8/ICU has already cached the OS default timezone for
// Date/Intl, and reassigning process.env.TZ there no longer takes effect.
process.env.TZ = 'UTC'

module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    // Before the '@/' alias — first match wins, and a .lottie is a zip Jest can't parse.
    '\\.lottie$': '<rootDir>/__mocks__/fileMock.js',
    '^@/(.*)$': '<rootDir>/$1',
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
}
