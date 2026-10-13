import React, {useEffect, useMemo, useRef} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {menuTheme as theme} from '../theme/menuTheme';
import {type as typography} from '../theme/menuTypography';
import {MenuBackdrop} from './MenuBackdrop';
import {ProfileAvatar} from './ProfileAvatar';
import {avatarFor} from '../theme/avatars';
import {AppIcon} from './AppIcon';
import {Button} from './Button';
import type {Climb} from '../game/leaderboard/board';

interface Props {
  visible: boolean;
  climb: Climb;
  onNext: () => void;
  onHome?: () => void;
  primaryLabel?: string;
}

/** Compact standings; scrollable results and immediately available footer actions. */
export function LeaderboardOverlay({
  visible,
  climb,
  onNext,
  onHome,
  primaryLabel = 'Next Level',
}: Props): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const actionTaken = useRef(false);
  useEffect(() => {
    actionTaken.current = false;
  }, [visible, climb]);
  const rows = useMemo(() => {
    const count = Math.min(5, climb.after.rows.length);
    const first = Math.max(
      0,
      Math.min(
        climb.after.playerRank - 1 - Math.floor(count / 2),
        climb.after.rows.length - count,
      ),
    );
    return climb.after.rows.slice(first, first + count);
  }, [climb]);
  if (!visible) {
    return null;
  }
  const player = climb.after.rows.find(row => row.isPlayer);
  const invoke = (action: () => void): void => {
    if (actionTaken.current) {
      return;
    }
    actionTaken.current = true;
    action();
  };
  return (
    <View
      style={[
        styles.root,
        {paddingTop: insets.top, paddingBottom: insets.bottom},
      ]}>
      <MenuBackdrop />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>
          Leaderboard
        </Text>
        <Text style={styles.subtitle}>{climb.after.leagueName} league</Text>
        <View style={styles.summary}>
          <ProfileAvatar kind="player" size={64} />
          <View style={styles.stat}>
            <Text style={styles.label}>Your rank</Text>
            <Text style={styles.value}>#{climb.after.playerRank}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.label}>Your points</Text>
            <Text style={styles.value}>
              {(player?.score ?? 0).toLocaleString()}
            </Text>
          </View>
        </View>
        {climb.gained > 0 && (
          <Text style={styles.gain}>
            +{climb.gained.toLocaleString()} points
            {climb.placesGained > 0
              ? ` · Up ${climb.placesGained} ${
                  climb.placesGained === 1 ? 'place' : 'places'
                }`
              : ''}
          </Text>
        )}
        <View style={styles.table}>
          {rows.map(row => (
            <View
              key={row.id}
              style={[styles.row, row.isPlayer && styles.player]}
              accessibilityLabel={`Rank ${row.rank}, ${
                row.isPlayer ? 'You' : row.name
              }, ${row.score} points`}>
              <View
                style={[
                  styles.rankBadge,
                  {
                    backgroundColor: {
                      player: theme.pastel.sky,
                      cat: theme.pastel.lavender,
                      ibis: theme.pastel.peach,
                      fox: theme.pastel.mint,
                      bird: theme.pastel.sky,
                    }[avatarFor(row)],
                  },
                ]}>
                <Text style={[styles.rank, row.isPlayer && styles.playerName]}>
                  {row.rank}
                </Text>
              </View>
              <ProfileAvatar
                id={row.id}
                name={row.name}
                isPlayer={row.isPlayer}
                highlighted={row.isPlayer}
                size={44}
              />
              <Text
                style={[styles.name, row.isPlayer && styles.playerName]}
                numberOfLines={1}>
                {row.isPlayer ? 'You' : row.name}
              </Text>
              <Text style={styles.points}>{row.score.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer} testID="leaderboard-actions">
        <Button
          label={primaryLabel}
          variant="play"
          trailingIcon={<AppIcon name="chevron" color="#FFFFFF" size={18} />}
          onPress={() => invoke(onNext)}
        />
        {onHome && (
          <Button
            label="Home"
            variant="neutral"
            glow={false}
            onPress={() => invoke(onHome)}
          />
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 45,
    backgroundColor: theme.bg.base,
  },
  scroll: {flex: 1},
  content: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  title: {...typography.ui(24), textAlign: 'center'},
  subtitle: {
    ...typography.body(13),
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.bg.border,
    borderRadius: 24,
    backgroundColor: theme.bg.panel,
    shadowColor: theme.brand.tagline,
    shadowOpacity: 0.06,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 12,
    elevation: 2,
  },
  stat: {flex: 1, minWidth: 76, gap: 6},
  label: {...typography.body(13)},
  value: {...typography.ui(22)},
  gain: {
    ...typography.body(13),
    color: theme.brand.tagline,
    backgroundColor: theme.pastel.mint,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: 'hidden',
    textAlign: 'center',
    marginTop: 12,
  },
  table: {marginTop: 20, gap: 8},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 72,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.bg.border,
    borderRadius: 22,
    backgroundColor: theme.bg.panel,
    shadowColor: theme.brand.tagline,
    shadowOpacity: 0.04,
    shadowOffset: {width: 0, height: 3},
    shadowRadius: 8,
    elevation: 1,
  },
  player: {backgroundColor: '#DFFAFF', borderColor: '#58D9F5'},
  rankBadge: {
    minWidth: 30,
    minHeight: 30,
    borderRadius: 15,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rank: {...typography.ui(13)},
  name: {...typography.body(15), color: theme.text.primary, flex: 1},
  playerName: {...typography.ui(15)},
  points: {...typography.ui(14), flexShrink: 0, textAlign: 'right'},
  footer: {
    flexShrink: 0,
    padding: 16,
    gap: 10,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
});
