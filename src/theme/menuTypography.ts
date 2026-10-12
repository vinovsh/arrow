import {type as base} from './typography';
import {menuTheme} from './menuTheme';
export const type = {
  display: (size: number) => ({
    ...base.display(size),
    color: menuTheme.text.primary,
  }),
  ui: (size: number) => ({...base.ui(size), color: menuTheme.text.primary}),
  body: (size: number) => ({
    ...base.body(size),
    color: menuTheme.text.secondary,
  }),
};
