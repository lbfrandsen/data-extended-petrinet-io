import CustomContextPadProvider from './ContextPadProvider.js';
import CustomPaletteProvider from './PaletteProvider.js';
import CustomRuleProvider from './RuleProvider.js';
import PlaceTokenHoverProvider from './PlaceTokenHoverProvider.js';
// import ArcInscriptionProvider from './ArcInscriptionProvider.js';
// import GuardProvider from './GuardProvider.js';
import PlaceTypingProvider from './PlaceTypingProvider.js';
import LegendProvider from './LegendProvider.js';
import SqlDialogProvider from './SqlDialogProvider.js';

export default {
  __init__: [
    'contextPadProvider',
    'paletteProvider',
    'ruleProvider',
    'placeTokenHoverProvider', // register hover provider
    // 'arcInscriptionProvider',
    // 'guardProvider',
    'placeTypingProvider',
    'legendProvider',
    'sqlDialogProvider'
  ],
  contextPadProvider: ['type', CustomContextPadProvider],
  paletteProvider: ['type', CustomPaletteProvider],
  ruleProvider: ['type', CustomRuleProvider],
  placeTokenHoverProvider: ['type', PlaceTokenHoverProvider], // register hover provider
  // arcInscriptionProvider: ['type', ArcInscriptionProvider],
  // guardProvider: ['type', GuardProvider],
  placeTypingProvider: ['type', PlaceTypingProvider],
  legendProvider: ['type', LegendProvider],
  sqlDialogProvider: ['type', SqlDialogProvider]
};
