import Image from 'next/image';
import { getAvatar } from '@/lib/avatars';
import ember from '@/assets/daifugo/avatars/ember.png';
import juniper from '@/assets/daifugo/avatars/juniper.png';
import cobalt from '@/assets/daifugo/avatars/cobalt.png';
import plum from '@/assets/daifugo/avatars/plum.png';
import marigold from '@/assets/daifugo/avatars/marigold.png';
import rust from '@/assets/daifugo/avatars/rust.png';
import slate from '@/assets/daifugo/avatars/slate.png';
import mint from '@/assets/daifugo/avatars/mint.png';
import s from '@/styles/daifugoAvatar.module.css';

// Original generated portraits; stable IDs preserve identity across game screens.
// Static imports provide intrinsic dimensions and versioned, offline-cached URLs.
const PORTRAITS = { ember, juniper, cobalt, plum, marigold, rust, slate, mint };

/** Decorative identity; the adjacent player name remains the accessible label. */
export function DaifugoAvatar({
  avatarId,
  size = 56,
  className = '',
}: {
  avatarId: string;
  size?: number | string;
  className?: string;
}) {
  const id = getAvatar(avatarId).id;
  const portrait = PORTRAITS[id as keyof typeof PORTRAITS] ?? PORTRAITS.ember;
  return (
    <span
      className={`${s.avatar} ${className}`}
      style={{ width: size, height: size }}
      data-daifugo-avatar={id}
      aria-hidden="true"
    >
      <Image src={portrait} width={1254} height={1254} alt="" loading="eager" draggable={false} />
    </span>
  );
}
