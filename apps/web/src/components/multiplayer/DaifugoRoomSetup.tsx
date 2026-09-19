'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DAIFUGO_SEAT_OPTIONS } from '@/stores/daifugoSetup';
import visual from '@/styles/daifugoVisual.module.css';

/** Online capacity is explicit and independent of the saved solo/CPU count. */
export function DaifugoRoomSetup({ onCreate }: { onCreate: (seats: number) => void }) {
  const [seats, setSeats] = useState(4);
  return (
    <main className={`${visual.theme} min-h-dvh bg-[#111112] px-5 pb-10 pt-24`} lang="ja">
      <div className="mx-auto max-w-xl">
        <Link href="/daifugo/" className="inline-block py-3 font-bold">
          ← 戻る
        </Link>
        <header className="mb-8 border-l-8 border-[#be1020] pl-4">
          <p className="mb-2 text-sm font-bold tracking-widest">友人とオンライン対戦</p>
          <h1 className="text-3xl font-black sm:text-4xl">何人で遊びますか？</h1>
        </header>
        <fieldset>
          <legend className="mb-4 font-bold">あなたを含めた対戦人数</legend>
          <div className="flex flex-wrap gap-3">
            {DAIFUGO_SEAT_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={seats === count}
                onClick={() => setSeats(count)}
                className={`min-h-16 min-w-16 border-2 px-4 py-3 text-2xl font-black ${seats === count ? 'border-[#fffaf3] bg-[#be1020]' : 'border-[#666163] bg-[#111112]'}`}
              >
                {count}
                <span className="ml-1 text-sm">人</span>
              </button>
            ))}
          </div>
        </fieldset>
        <p className="my-6 text-sm leading-7 text-[#c1bbb7]">
          友だち{seats - 1}人を招待して、合計{seats}人で対戦します。
          <br />
          人数が足りない場合は、部屋でCPUを追加できます。
        </p>
        <button
          type="button"
          onClick={() => onCreate(seats)}
          className="btn-fat w-full text-xl"
          data-testid="confirm-room-capacity"
        >
          {seats}人の部屋を作る
        </button>
      </div>
    </main>
  );
}
