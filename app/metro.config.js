// Configuration Metro : les réseaux de zone (.reseau, du JSON) sont des fichiers à part, pas du
// code : ils ne grossissent pas le bundle et ne sont lus que pour la zone du départ.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("reseau");

module.exports = config;
