module.exports = {
  transform: {
    '.(ts|tsx)': require.resolve('ts-jest/dist'),
  },
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|jsx)$'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  testRegex: '\\.test\\.ts$',
  testURL: 'http://localhost',
  setupFiles: ['<rootDir>/src/__tests__/config/setup.ts'],
};
