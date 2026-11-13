// Expo's Babel preset and nothing else. `babel-preset-expo` resolves through
// `expo`'s own dependency tree (Expo's Metro transformer and jest-expo both
// load it from there), so it is not a declared dependency of this package.
// react-native-reanimated IS declared -- pinned to the SDK version because
// expo-router resolves it as a peer -- but no Adulis code animates with it
// (ADU-MOB-03 D8), so its Babel plugin is deliberately not registered here.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
