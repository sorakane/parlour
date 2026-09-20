'use client';
import { useProfileStore } from '@/stores/profile';

export function PlayerNameField({ disabled = false }: { disabled?: boolean }) {
  const name = useProfileStore((state) => state.name);
  const setName = useProfileStore((state) => state.setName);
  return (
    <label className="mb-5 block w-full max-w-xl text-left font-bold">
      あなたの名前（任意）
      <input
        aria-label="あなたの名前"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={16}
        disabled={disabled}
        autoComplete="nickname"
        placeholder="入力しなくても参加できます"
        className="mt-2 block min-h-12 w-full border-2 border-[#666163] bg-[#111112] px-4 py-3 text-base text-[#fffaf3] focus:border-[#e60023] focus:outline-none"
      />
      <span className="mt-2 block text-xs font-normal text-[#c1bbb7]">
        空欄の場合は「プレイヤー」と表示されます。名前は16文字まで入力できます。
      </span>
    </label>
  );
}
