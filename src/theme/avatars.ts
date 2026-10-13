export type AvatarKind = 'player' | 'cat' | 'ibis' | 'fox' | 'bird';
const rivals: AvatarKind[] = ['cat', 'ibis', 'fox', 'bird'];
/** Portrait identity depends on the rival, never on their changing rank. */
export function avatarFor({
  id,
  name,
  isPlayer,
}: {
  id: string;
  name: string;
  isPlayer: boolean;
}): AvatarKind {
  if (isPlayer) {
    return 'player';
  }
  if (/cat/i.test(name)) {
    return 'cat';
  }
  if (/fox/i.test(name)) {
    return 'fox';
  }
  if (/ibis/i.test(name)) {
    return 'ibis';
  }
  if (/raven|bird/i.test(name)) {
    return 'bird';
  }
  let hash = 0;
  for (const letter of id) {
    hash = (hash * 31 + letter.charCodeAt(0)) % 4294967296;
  }
  return rivals[hash % rivals.length];
}
