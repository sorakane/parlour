import { getAvatar } from '@/lib/avatars';
import s from '@/styles/daifugoAvatar.module.css';

// Original vector portraits. Geometry and silhouettes are deliberately distinct
// at 32px; stable avatar IDs keep the same face through lobbies, play and results.
// Fade-away: the coat and field share opaque red; isolated collars imply the torso.
// The open left cheek shares the paper ground, while eyes/hair/right jaw anchor the face.
const PORTRAITS: Record<string, { initial: string; hair: string; eyes: string; detail: string }> = {
  ember: {
    initial: 'E',
    hair: 'M26 40 20 24 35 28 39 9 50 23 66 15 73 37 61 30 53 38 43 27 35 42Z',
    eyes: 'M34 45h9v4h-9ZM54 43h10v4H54Z',
    detail: 'M34 70 46 77 42 84 32 75ZM58 69 49 78 55 83 64 73Z',
  },
  juniper: {
    initial: 'J',
    hair: 'M24 43 23 27 13 19 34 17 43 7 58 20 71 23 74 49 63 38 61 29 45 35 35 30 32 43Z',
    eyes: 'M33 46 44 42v5H33ZM55 45h8v4h-8Z',
    detail: 'M31 70 42 79 39 84 29 77ZM61 70 53 79 57 84 67 76Z',
  },
  cobalt: {
    initial: 'C',
    hair: 'M24 43V23L36 13H60L71 25V44H62V29H36V43ZM18 36h10v21H18ZM68 35h10v21H68Z',
    eyes: 'M34 44h10v5H34ZM54 44h10v5H54Z',
    detail: 'M33 70 47 76 61 69 59 78 47 84 36 78Z',
  },
  plum: {
    initial: 'P',
    hair: 'M22 54 24 24 44 10 65 18 75 39 63 66 61 31 48 45 33 52 34 34Z',
    eyes: 'M34 46h10v4H34ZM54 44l11-3v5l-11 3Z',
    detail: 'M37 69 46 82 40 79 32 74ZM61 69 51 83 57 79 67 74Z',
  },
  marigold: {
    initial: 'M',
    hair: 'M25 42 19 29 29 22 26 10 43 20 52 6 59 22 75 16 71 33 76 41 62 36 59 30 39 32 33 43Z',
    eyes: 'M33 44 43 42v5H33ZM54 42l10 2v3H54Z',
    detail: 'M37 69 45 80 40 82 31 73ZM57 69 49 80 55 82 64 73Z',
  },
  rust: {
    initial: 'R',
    hair: 'M23 42 26 25 38 23 46 9 63 13 60 24 73 26 70 43 58 35 48 29 33 41Z',
    eyes: 'M33 43l11 3v4l-11-3ZM54 46l11-3v4l-11 3Z',
    detail: 'M37 69 47 79 42 85 32 75ZM60 70 49 80 55 84 66 74Z',
  },
  slate: {
    initial: 'S',
    hair: 'M24 43V27L32 15H62L73 28V44H64L60 30 34 34 33 43Z',
    eyes: 'M30 42h37v12H30ZM25 44h8v5h-8ZM66 44h7v5h-7Z',
    detail: 'M34 70H40L47 81 56 70H62L56 82 47 87 39 82Z',
  },
  mint: {
    initial: 'M',
    hair: 'M24 44 18 32 14 16 28 22 39 14 57 15 70 22 83 15 77 34 70 45 59 32 50 37 41 29 34 43Z',
    eyes: 'M34 44h9v5h-9ZM54 44h9v5h-9Z',
    detail: 'M35 70 47 79 41 85 30 75ZM61 70 49 80 55 85 67 75Z',
  },
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
      <svg viewBox="0 0 96 96" focusable="false">
        <path fill="#f7f3e8" d="M0 0h96v96H0Z" />
        <path fill="#e71936" d="M60 0h36v96H6Z" />
        {/* This opaque coat meets the same red field; no mask or alpha erasure. */}
        <path fill="#e71936" d="M12 96 20 78 37 67h22l18 12 9 17Z" />
        <path fill="#f7f3e8" d={portrait.detail} />
        <path fill="#111" d="M61 33 71 36 67 59 55 73 44 68 54 64 62 55Z" />
        <path fill="#f7f3e8" d="M30 35 42 26h16l9 13-4 18-12 12-12-6-8-12Z" />
        <path fill="#111" d={portrait.hair} />
        <path fill="#111" d={portrait.eyes} />
        {id === 'slate' && <path fill="#f7f3e8" d="m33 45 12-1-7 7h-5Zm20 0h10v3H50Z" />}
        <path fill="#e71936" d="m48 47-4 9h7Z" />
        <path fill="#111" d="m43 60 13-2-5 5h-6Z" />
        <text x="5" y="24" className={s.initial}>
          {portrait.initial}
        </text>
        {/* A single pocket fold suggests the jacket below its missing outline. */}
        <path fill="#f7f3e8" d="M58 88h10l-3 3h-8Z" />
      </svg>
    </span>
  );
}
