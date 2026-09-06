'use client';
import { useState } from 'react';
import type { DaifugoRules } from '@parlour/game-daifugo';
import { useDaifugoPresets } from '@/stores/daifugoPresets';

export function DaifugoPresets({
  rules,
  apply,
}: {
  rules: DaifugoRules;
  apply(rules: DaifugoRules): void;
}) {
  const entries = useDaifugoPresets((state) => state.entries);
  const save = useDaifugoPresets((state) => state.save);
  const remove = useDaifugoPresets((state) => state.remove);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  return (
    <section
      className="panel-soft"
      style={{ padding: '1rem', margin: '1rem 0' }}
      aria-label="マイルール"
    >
      <h2 style={{ fontSize: '1rem', marginBottom: '.6rem' }}>マイルール</h2>
      <p style={{ fontSize: '.85rem', marginBottom: '.6rem' }}>
        今のルールに名前を付けて、このブラウザに保存できます（最大20件）。
      </p>
      <form
        style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          save(name, rules);
          setStatus(`「${name.trim()}」を保存しました`);
        }}
      >
        <input
          aria-label="ルールの名前"
          placeholder="例：いつもの仲間ルール"
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
          style={{
            color: '#172c29',
            background: '#fff',
            borderRadius: '.5rem',
            padding: '.7rem',
            flex: '1 1 180px',
            minWidth: 0,
          }}
        />
        <button className="btn-fat" disabled={!name.trim()} type="submit">
          保存
        </button>
      </form>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {entries.map((entry) => (
          <li
            key={entry.name}
            style={{
              display: 'flex',
              gap: '.5rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginTop: '.6rem',
            }}
          >
            <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{entry.name}</span>
            <button
              type="button"
              className="btn-fat btn-fat--ghost"
              onClick={() => {
                apply(entry.rules);
                setStatus(`「${entry.name}」を適用しました`);
              }}
            >
              使う
            </button>
            <button
              type="button"
              className="btn-fat btn-fat--ghost"
              aria-label={`${entry.name}を削除`}
              onClick={() => {
                remove(entry.name);
                setStatus(`「${entry.name}」を削除しました`);
              }}
            >
              削除
            </button>
          </li>
        ))}
      </ul>
      <p role="status" style={{ fontSize: '.85rem' }}>
        {status}
      </p>
    </section>
  );
}
