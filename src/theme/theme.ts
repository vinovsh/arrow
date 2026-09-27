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
    // Light: `Hearts` is drawn only on the game screen, which is now a white page
    // (§10.2), and a dark-maroon empty slot there is an invisible one.
    heartEmpty: '#DFE3EB',
    star: '#FFC53D',
    badge: '#3ACB63',
    danger: '#FF4D5E',
    success: '#3ACB63',
    currentLevel: '#FFD34A',
  },

  /**
   * The board, and only the board (§10.2).
   *
   * One ink for every arrow on it. The palette in `arrow` above is still what the
   * level data carries and what `ArrowColorKey` indexes, but nothing on the board
   * reads it any more: a maze of interlocking paths is read by *shape*, and eight
   * hues fighting for the same silhouette is what stopped it being readable. Two
   * paths running side by side are separated by the white gap between them, which is
   * why the stroke is a fraction of the cell rather than the whole of it.
   *
   * These values are measured off the reference screenshots in `ref/Arrow`, not
   * picked: ink is the exact navy those boards draw, `dot` the exact grey of the
   * positioning dots against white.
   */
  board: {
    bg: '#FFFFFF',
    ink: '#061242',
    /** §9.3 — the arrow the player tapped and could not free. */
    blocked: '#FF3B2D',
    /** §9.3 — the arrow standing in its way, muted so the two read as a pair. */
    blocker: '#A8342B',
    dot: '#CBD2E0',
    title: '#0B0B0C',
    chip: '#EFF1F6',
    chipText: '#5D6676',
    chrome: '#2F9BFF',
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

  /** The light launch screen — ref/screens (2).png, panel 6 ("Sharpen your mind"). */
  splash: {
    bg: ['#E6F7FB', '#F3FAFF', '#EEF1FF'] as const,
    title: '#0B1F4D',
    body: '#4A5A80',
    brainTop: '#9FE3FF',
    brainBottom: '#2F86F6',
    brainFold: 'rgba(255,255,255,0.45)',
    glow: 'rgba(80,170,255,0.28)',
    sparkle: ['#4FB6FF', '#7C8CFF', '#38D0E8', '#A58BFF'] as const,
    arrow: '#FFFFFF',
    dot: '#C9D6EC',
    dotActive: '#2F86F6',
  },

  /** The level-complete overlay — ref/reward model.png, frame 4. */
  reward: {
    bg: ['#0B1640', '#08102E', '#050A1E'] as const,
    hills: ['#101D4E', '#0A1438'] as const,
    card: 'rgba(16,30,78,0.72)',
    cardBorder: 'rgba(90,140,255,0.35)',
    divider: 'rgba(120,160,255,0.16)',
    title: '#FFFFFF',
    subtitle: 'rgba(230,238,255,0.86)',
    label: 'rgba(226,234,255,0.82)',
    gold: '#FFC53D',
    goldDeep: '#F59E0B',
    goldLight: '#FFE58A',
    green: '#4ADE80',
    newBadge: '#22C55E',
    clock: '#3B82F6',
    bolt: '#F8FAFC',
    laurel: '#3B82F6',
    next: ['#22D3EE', '#3B82F6', '#6D4BFF'] as const,
    homeBorder: 'rgba(120,160,255,0.45)',
    icon: '#60A5FA',
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
