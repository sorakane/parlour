import Image from 'next/image';
import { getAvatar } from '@/lib/avatars';
import characterSheet from '@/assets/daifugo/avatars/character-sheet.jpg';
import s from '@/styles/daifugoAvatar.module.css';

// Display windows in the unchanged user-supplied 1280 × 853 character sheet.
// One versioned image is shared across all seats, the lobby and the results.
const PORTRAITS: Record<string, { x: number; y: number; size: number }> = {
  ember: { x: 94, y: 29, size: 218 },
  juniper: { x: 392, y: 29, size: 229 },
  cobalt: { x: 722, y: 40, size: 225 },
  plum: { x: 1036, y: 20, size: 228 },
  marigold: { x: 72, y: 449, size: 236 },
  rust: { x: 409, y: 491, size: 225 },
  slate: { x: 1054, y: 434, size: 210 },
  mint: { x: 718, y: 470, size: 226 },
};

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
  const portrait = PORTRAITS[id] ?? PORTRAITS.ember!;
  return (
    <span
      className={`${s.avatar} ${className}`}
      style={{ width: size, height: size }}
      data-daifugo-avatar={id}
      aria-hidden="true"
    >
      <Image
        src={characterSheet}
        width={1280}
        height={853}
        alt=""
        loading="eager"
        draggable={false}
        style={{
          width: `${(1280 / portrait.size) * 100}%`,
          left: `${(-portrait.x / portrait.size) * 100}%`,
          top: `${(-portrait.y / portrait.size) * 100}%`,
        }}
      />
    </span>
  );
}
