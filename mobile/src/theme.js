// ============================================================================
// The same room as the website. Paper ground, ink that actually passes
// contrast, blue for what you can touch, gold for what's missing. These are
// the exact values from public/theme.css — if one changes there, change it
// here, or the two halves of Beatfall stop looking like one product.
// ============================================================================

const light = {
  ground:    '#F1EEE7',
  surface:   '#F6F3ED',
  card:      '#FDFBF6',
  ink:       '#2B2620',
  ink2:      '#5C5349',
  ink3:      '#726859',
  ink4:      '#8A8075',
  rule:      '#E0D9CB',
  ruleSoft:  '#EDE7DA',
  blue:      '#2C5C8F',
  blueSoft:  '#EAEFF5',
  blueInk:   '#1E4269',
  onBlue:    '#FFFFFF',
  gold:      '#7B5A13',
  goldSoft:  '#F4EEDF',
  goldHair:  '#D9C08A',
  sage:      '#4A7358',
  sageSoft:  '#E7EEE9',
  red:       '#8C2F2F',
};

const dark = {
  ground:    '#1A1714',
  surface:   '#211D19',
  card:      '#292420',
  ink:       '#EFE9DE',
  ink2:      '#C2B7A8',
  ink3:      '#9A8F82',
  ink4:      '#8C8175',
  rule:      '#3A342C',
  ruleSoft:  '#2E2923',
  blue:      '#8FB6DE',
  blueSoft:  '#20303E',
  blueInk:   '#B9D3F0',
  onBlue:    '#14181C',
  gold:      '#D9BC77',
  goldSoft:  '#2B2517',
  goldHair:  '#7E6C3E',
  sage:      '#8CB79A',
  sageSoft:  '#1E2A22',
  red:       '#D98A8A',
};

// Softened, not rounded away — the card still reads as a card.
export const radius = { card: 4, ctl: 5, panel: 9 };

export const font = {
  serif: 'Newsreader_600SemiBold',
  sans:  'InstrumentSans_400Regular',
  sansMed: 'InstrumentSans_500Medium',
  sansSemi: 'InstrumentSans_600SemiBold',
  mono:  'CourierPrime_400Regular',
};

export const palette = (scheme) => (scheme === 'dark' ? dark : light);
