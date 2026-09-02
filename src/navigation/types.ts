/** §5 — ten screens, no bottom navigation, no store. */
export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  LevelSelection: undefined;
  Game: {levelId: number};
  Settings: undefined;
  HowToPlay: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
