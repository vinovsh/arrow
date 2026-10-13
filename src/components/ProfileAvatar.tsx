import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {avatarFor, type AvatarKind} from '../theme/avatars';
const portraits = {
  player: require('../../assets/art/avatars/player.png'),
  cat: require('../../assets/art/avatars/cat.png'),
  ibis: require('../../assets/art/avatars/ibis.png'),
  fox: require('../../assets/art/avatars/fox.png'),
  bird: require('../../assets/art/avatars/bird.png'),
};
export function ProfileAvatar({
  id = 'you',
  name = '',
  isPlayer = false,
  kind,
  size = 44,
  highlighted = false,
}: {
  id?: string;
  name?: string;
  isPlayer?: boolean;
  kind?: AvatarKind;
  size?: number;
  highlighted?: boolean;
}): React.JSX.Element {
  return (
    <View
      accessible={false}
      style={[
        styles.frame,
        {width: size, height: size, borderRadius: size / 2},
        highlighted && styles.highlighted,
      ]}>
      <Image
        source={portraits[kind ?? avatarFor({id, name, isPlayer})]}
        resizeMode="contain"
        resizeMethod="resize"
        style={styles.image}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {padding: 1, flexShrink: 0, overflow: 'hidden'},
  highlighted: {
    borderColor: '#19C5F4',
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    padding: 2,
  },
  image: {width: '100%', height: '100%'},
});
