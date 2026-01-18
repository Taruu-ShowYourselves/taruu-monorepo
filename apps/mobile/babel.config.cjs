module.exports = function (api) {
  api.cache(true);

  const isTest = process.env.NODE_ENV === 'test';

  return {
    presets: [
      isTest
        ? ['@babel/preset-env', { targets: { node: 'current' } }]
        : ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      !isTest && 'nativewind/babel',
      '@babel/preset-typescript',
    ].filter(Boolean),
    plugins: [
      // Only include reanimated plugin in non-test environment
      !isTest && 'react-native-reanimated/plugin',
    ].filter(Boolean),
  };
};
