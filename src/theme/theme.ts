/**
 * Design tokens — §10.1. These values are the single source of truth for colour,
 * spacing and radii. Screens must not hard-code hex values.
 */
export const theme = {
  bg: {
    base: '#050A16',
    panel: '#0C1322',
    panelAlt: '#111A2E',
    border: 'rgba(255,255,255,0.08)',
    vignette: 'rgba(0,0,0,0.55)',
  },
  // Dimmer than it looks it should be, on purpose: the dots are a positioning aid
  // under thin arrows, and at the old 0.10 they competed with a 3dp line.
  grid: {dot: 'rgba(255,255,255,0.06)', dotActive: 'rgba(255,255,255,0.12)'},
  text: {
    primary: '#EAF1FF',
    secondary: 'rgba(234,241,255,0.62)',
    dim: 'rgba(234,241,255,0.38)',
  },

  brand: {
    arrowWord: ['#FFD34A', '#FF9A3C'] as const,
    escapeWord: ['#35E7F0', '#B06BFF', '#FF5FA2'] as const,
    tagline: '#35E7F0',
  },

  arrow: {
    cyan: '#22E0E8',
    green: '#38E08B',
    orange: '#FF9A3C',
    pink: '#FF5FA2',
    purple: '#A46BFF',
    yellow: '#FFD54A',
    blue: '#3D8BFF',
    white: '#F2F6FF',
  },

  button: {
    play: ['#3B8CFF', '#1F5FD0'] as const,
    levels: ['#8B5CFF', '#5B2FD6'] as const,
    settings: ['#3ACB63', '#22A046'] as const,
    primary: ['#3ACB63', '#22A046'] as const,
    hint: ['#FFD34A', '#F5A623'] as const,
    neutral: '#16203A',
  },

  state: {
    heart: '#FF3B4E',
    heartEmpty: '#3A1520',
    star: '#FFC53D',
    badge: '#3ACB63',
    danger: '#FF4D5E',
    success: '#3ACB63',
    currentLevel: '#FFD34A',
  },

  /**
   * Ink shared by every arrow whatever its colour (§10.2). Deliberately not inside
   * `arrow`, which is exactly the palette `ArrowColorKey` indexes — a `casing` key in
   * there would typecheck as a legal arrow colour.
   */
  arrowInk: {
    /** A dark hairline under the line, so two paths running close still read as two. */
    casing: 'rgba(3,7,16,0.62)',
    /** The specular sliver along the stroke that keeps a thin line from looking flat. */
    gloss: '#F2F6FF',
  },

  radius: {sm: 10, md: 16, lg: 22, panel: 26, pill: 999},
  space: {xs: 4, sm: 8, md: 16, lg: 24, xl: 32},
  glow: {soft: 6, medium: 12, strong: 20},
  font: {
    display: 'Poppins-Bold',
    ui: 'Poppins-SemiBold',
    body: 'Inter-Regular',
  },
} as const;

export type ArrowColorKey = keyof typeof theme.arrow;
