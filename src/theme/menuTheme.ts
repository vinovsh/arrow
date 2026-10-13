import {theme} from './theme';

/** Approved menu storyboard. The gameplay palette remains in theme.ts. */
export const menuTheme = {
  ...theme,
  bg: {
    base: '#EFFAFF',
    panel: '#FFFFFF',
    panelAlt: '#E7F2FF',
    border: '#DCEBFA',
    vignette: '#EFFAFF',
  },
  pastel: {
    mint: '#DDFBF0',
    lavender: '#EEE5FF',
    peach: '#FFE9D9',
    yellow: '#FFF0B5',
    sky: '#DDF5FF',
  },
  text: {primary: '#102451', secondary: '#516A90', dim: '#7D98B8'},
  brand: {
    arrowWord: ['#149DFB', '#087BEA'],
    escapeWord: ['#102451', '#087BEA', '#149DFB'],
    tagline: '#087BEA',
  },
  button: {
    play: ['#22AEFF', '#0785F5'],
    reward: ['#22AEFF', '#0785F5'],
    primary: ['#22AEFF', '#0785F5'],
    hint: ['#22AEFF', '#0785F5'],
    levels: ['#F6F0FF', '#EDE2FF'],
    settings: ['#EEFFF8', '#DDF8EE'],
    neutral: '#FFFFFF',
  },
  state: {...theme.state, currentLevel: '#0785F5', badge: '#0785F5'},
  radius: {sm: 10, md: 16, lg: 22, panel: 24, pill: 999},
  reward: {
    ...theme.reward,
    bg: ['#FFFFFF', '#F8FCFF', '#EDF7FF'],
    hills: ['#EDF7FF', '#EDF7FF'],
    card: '#FFFFFF',
    cardBorder: '#DCEBFA',
    divider: '#E7F2FF',
    title: '#102451',
    subtitle: '#516A90',
    label: '#516A90',
    next: ['#22AEFF', '#0785F5', '#0785F5'],
    homeBorder: '#DCEBFA',
    green: '#087BEA',
  },
} as const;
