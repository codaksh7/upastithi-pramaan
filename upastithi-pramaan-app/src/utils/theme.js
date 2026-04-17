// src/utils/theme.js
export const Colors = {
  void:        '#020408',
  deep:        '#040c14',
  cardBg:      '#0a1a2e',
  cardHover:   '#0d2040',
  border:      'rgba(0,200,255,0.12)',
  borderHot:   'rgba(0,200,255,0.40)',
  cyan:        '#00c8ff',
  cyanDim:     'rgba(0,200,255,0.6)',
  cyanGlow:    'rgba(0,200,255,0.10)',
  cyanBorder:  'rgba(0,200,255,0.25)',
  green:       '#00ff9d',
  greenDim:    'rgba(0,255,157,0.6)',
  greenGlow:   'rgba(0,255,157,0.10)',
  greenBorder: 'rgba(0,255,157,0.25)',
  amber:       '#ffb800',
  amberDim:    'rgba(255,184,0,0.6)',
  amberGlow:   'rgba(255,184,0,0.10)',
  amberBorder: 'rgba(255,184,0,0.25)',
  red:         '#ff3366',
  redDim:      'rgba(255,51,102,0.6)',
  redGlow:     'rgba(255,51,102,0.10)',
  redBorder:   'rgba(255,51,102,0.25)',
  textPrimary:   'rgba(220,240,255,0.95)',
  textSecondary: 'rgba(140,180,210,0.75)',
  textMuted:     'rgba(80,120,160,0.60)',
  textDim:       'rgba(50,90,130,0.45)',
};

export const Spacing = { xs:4, sm:8, md:16, lg:24, xl:32, xxl:48 };
export const Radius  = { sm:3, md:8, lg:16, full:9999 };

export const accentColor = (c) =>
  c==='green'?Colors.green:c==='amber'?Colors.amber:c==='red'?Colors.red:Colors.cyan;

export const accentGlow = (c) =>
  c==='green'?Colors.greenGlow:c==='amber'?Colors.amberGlow:c==='red'?Colors.redGlow:Colors.cyanGlow;

export const accentBorder = (c) =>
  c==='green'?Colors.greenBorder:c==='amber'?Colors.amberBorder:c==='red'?Colors.redBorder:Colors.cyanBorder;
