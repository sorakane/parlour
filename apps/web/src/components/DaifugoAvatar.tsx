import { getAvatar } from '@/lib/avatars';
import s from '@/styles/daifugoAvatar.module.css';

// Original vector portraits. Geometry and silhouettes are deliberately distinct
// at 32px; stable avatar IDs keep the same face through lobbies, play and results.
const PORTRAITS: Record<string, { initial: string; hair: string; eyes: string; detail: string }> = {
  ember: {
    initial: 'E',
    hair: 'M26 40 20 24 35 28 39 9 50 23 66 15 73 37 61 30 53 38 43 27 35 42Z',
    eyes: 'M34 45h9v4h-9ZM54 43h10v4H54Z',
    detail: 'M34 76 47 84 58 69 62 96H29Z',
  },
  juniper: {
    initial: 'J',
    hair: 'M24 43 23 27 13 19 34 17 43 7 58 20 71 23 74 49 63 38 61 29 45 35 35 30 32 43Z',
    eyes: 'M33 46 44 42v5H33ZM55 45h8v4h-8Z',
    detail: 'M17 78 31 72 41 96H25ZM66 71 78 79 69 96H56Z',
  },
  cobalt: {
    initial: 'C',
    hair: 'M24 43V23L36 13H60L71 25V44H62V29H36V43ZM18 36h10v21H18ZM68 35h10v21H68Z',
    eyes: 'M34 44h10v5H34ZM54 44h10v5H54Z',
    detail: 'M30 72 47 79 65 70 73 96H23Z',
  },
  plum: {
    initial: 'P',
    hair: 'M22 54 24 24 44 10 65 18 75 39 63 66 61 31 48 45 33 52 34 34Z',
    eyes: 'M34 46h10v4H34ZM54 44l11-3v5l-11 3Z',
    detail: 'M20 79 37 69 47 89 61 69 77 80 70 96H26Z',
  },
  marigold: {
    initial: 'M',
    hair: 'M25 42 19 29 29 22 26 10 43 20 52 6 59 22 75 16 71 33 76 41 62 36 59 30 39 32 33 43Z',
    eyes: 'M33 44 43 42v5H33ZM54 42l10 2v3H54Z',
    detail: 'M24 75 41 70 47 88 55 70 72 75 64 96H31Z',
  },
  rust: {
    initial: 'R',
    hair: 'M23 42 26 25 38 23 46 9 63 13 60 24 73 26 70 43 58 35 48 29 33 41Z',
    eyes: 'M33 43l11 3v4l-11-3ZM54 46l11-3v4l-11 3Z',
    detail: 'M24 75 37 69 47 82 65 71 74 96H59L47 88 34 96H22Z',
  },
  slate: {
    initial: 'S',
    hair: 'M24 43V27L32 15H62L73 28V44H64L60 30 34 34 33 43Z',
    eyes: 'M30 42h37v12H30ZM25 44h8v5h-8ZM66 44h7v5h-7Z',
    detail: 'M25 72H40L47 83 56 72H70L76 96H20Z',
  },
  mint: {
    initial: 'M',
    hair: 'M24 44 18 32 14 16 28 22 39 14 57 15 70 22 83 15 77 34 70 45 59 32 50 37 41 29 34 43Z',
    eyes: 'M34 44h9v5h-9ZM54 44h9v5h-9Z',
    detail: 'M21 77 35 71 47 84 61 71 74 78 66 96H29Z',
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
        <path fill="#111" d="M0 70 96 31v7L0 77Z" />
        <path fill="#111" d="M12 96 20 78 37 67h22l18 12 9 17Z" />
        <path fill="#f7f3e8" d={portrait.detail} />
        <path fill="#111" d="M25 32 39 20h21l11 16-4 23-12 14H40L27 58Z" />
        <path fill="#f7f3e8" d="M30 35 42 26h16l9 13-4 18-12 12-12-6-8-12Z" />
        <path fill="#111" d={portrait.hair} />
        <path fill="#111" d={portrait.eyes} />
        {id === 'slate' && <path fill="#f7f3e8" d="m33 45 12-1-7 7h-5Zm20 0h10v3H50Z" />}
        <path fill="#e71936" d="m48 47-4 9h7Z" />
        <path fill="#111" d="m43 60 13-2-5 5h-6Z" />
        <text x="5" y="24" className={s.initial}>
          {portrait.initial}
        </text>
        <path fill="#111" d="M5 83h4v8H5Zm7-4h3v12h-3Zm6 7h3v5h-3Z" />
        <path fill="#f7f3e8" d="m77 7 12 0-12 12Z" />
      </svg>
    </span>
  );
}
