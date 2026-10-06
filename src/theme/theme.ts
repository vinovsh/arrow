/**
 * Design tokens — §10.1. These values are the single source of truth for colour,
 * spacing and radii. Screens must not hard-code hex values.
 */
export const theme = {
  bg: {
    base: '#F7F2FF',
    panel: '#FFFFFF',
    panelAlt: '#EEE5FA',
    border: '#E4D9F2',
    vignette: 'rgba(44,30,69,0.40)',
  },
  // Dimmer than it looks it should be, on purpose: the dots are a positioning aid
  // under thin arrows, and at the old 0.10 they competed with a 3dp line.
  grid: {dot: 'rgba(117,84,161,0.10)', dotActive: 'rgba(117,84,161,0.20)'},
  text: {
    primary: '#382650',
    secondary: '#756286',
    dim: '#887796',
  },

  brand: {
    arrowWord: ['#EA7797', '#F8B18C'] as const,
    escapeWord: ['#8961CB', '#B490E6', '#EA92B7'] as const,
    tagline: '#8961CB',
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
    reward: ['#54A5FF', '#2875D6'] as const,
    play: ['#A180DA', '#7953B9'] as const,
    levels: ['#F5B9C9', '#E79AB4'] as const,
    settings: ['#B9E2D8', '#89C6B9'] as const,
    primary: ['#B9E2D8', '#89C6B9'] as const,
    hint: ['#FFE2AB', '#F4C77D'] as const,
    neutral: '#EEE5FA',
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
    currentLevel: '#8961CB',
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
    ink: '#18234B',
    escaping: '#31B8F0',
    escapeGlow: '#7CEEE9',
    /** §9.3 — the arrow the player tapped and could not free. */
    blocked: '#FF3B2D',
    /** §9.3 — the arrow standing in its way, muted so the two read as a pair. */
    blocker: '#A8342B',
    dot: '#DED4EA',
    title: '#382650',
    chip: '#EEE5FA',
    chipText: '#756286',
    chrome: '#8961CB',
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
    bg: ['#FCE8EF', '#F7F2FF', '#EEE5FA'] as const,
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
    bg: ['#F7F2FF', '#FCE8EF', '#FFF5E9'] as const,
    hills: ['#E8DDF7', '#F5DCE8'] as const,
    card: 'rgba(255,255,255,0.92)',
    cardBorder: '#E4D9F2',
    divider: '#E4D9F2',
    title: '#382650',
    subtitle: '#756286',
    label: '#756286',
    gold: '#FFC53D',
    goldDeep: '#F59E0B',
    goldLight: '#FFE58A',
    green: '#4ADE80',
    newBadge: '#22C55E',
    clock: '#3B82F6',
    bolt: '#F8FAFC',
    laurel: '#3B82F6',
    next: ['#AD8CE1', '#8961CB', '#7953B9'] as const,
    homeBorder: '#CEBCE6',
    icon: '#60A5FA',
  },

  celebration: {
    colours: [
      '#F075A5',
      '#A17CE0',
      '#40BBD6',
      '#57BD9F',
      '#F4BE4F',
      '#F39B68',
    ] as const,
  },
  radius: {sm: 14, md: 20, lg: 26, panel: 32, pill: 999},
  space: {xs: 4, sm: 8, md: 16, lg: 24, xl: 32},
  glow: {soft: 6, medium: 12, strong: 20},
  font: {
    display: 'Poppins-Bold',
    ui: 'Poppins-SemiBold',
    body: 'Inter-Regular',
  },
} as const;

export type ArrowColorKey = keyof typeof theme.arrow;
