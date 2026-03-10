import CustomContextPadProvider from './ContextPadProvider.js';
import CustomPaletteProvider from './PaletteProvider.js';
import CustomRuleProvider from './RuleProvider.js';
import PlaceTokenHoverProvider from './PlaceTokenHoverProvider.js';

export default {
  __init__: [
    'contextPadProvider',
    'paletteProvider',
    'ruleProvider',
    'placeTokenHoverProvider' // register hover provider
  ],
  contextPadProvider: ['type', CustomContextPadProvider],
  paletteProvider: ['type', CustomPaletteProvider],
  ruleProvider: ['type', CustomRuleProvider],
  placeTokenHoverProvider: ['type', PlaceTokenHoverProvider] // register hover provider
};