'use client';

import { GameTablePage } from '@/components/table/GameTablePage';
import { daifugoTablePack } from '@/lib/games/tablePacks/daifugo';

export default function DaifugoTablePage() {
  return <GameTablePage pack={daifugoTablePack} />;
}
