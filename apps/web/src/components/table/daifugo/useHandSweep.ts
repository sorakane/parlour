import { useLayoutEffect, useRef, type PointerEvent, type MouseEvent } from 'react';

type Stroke = {
  pointerId: number;
  root: HTMLElement;
  selected: boolean;
  visited: Set<string>;
  x: number;
  y: number;
};

/** Paint selection only; confirming a move remains a separate button action. */
export function useHandSweep({
  enabled,
  epoch,
  selected,
  onPaint,
}: {
  enabled: boolean;
  epoch: string | number;
  selected: readonly string[];
  onPaint: (cards: readonly string[], selected: boolean) => void;
}) {
  const stroke = useRef<Stroke | null>(null);
  const suppressClick = useRef(false);

  const end = () => {
    const active = stroke.current;
    stroke.current = null;
    if (active?.root.hasPointerCapture?.(active.pointerId)) {
      active.root.releasePointerCapture(active.pointerId);
    }
  };

  useLayoutEffect(() => {
    end();
    return end;
  }, [enabled, epoch]);

  const cardAt = (root: HTMLElement, target: Element | null) => {
    const card = target?.closest<HTMLElement>('[data-hand-card]');
    const button = card?.querySelector<HTMLButtonElement>('button');
    return card &&
      root.contains(card) &&
      button &&
      !button.disabled &&
      !card.closest('[aria-hidden="true"]')
      ? card.dataset.cardId
      : undefined;
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const active = stroke.current;
    if (!active || active.pointerId !== event.pointerId || !enabled) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    // Sample the whole segment so a fast swipe does not skip narrow fan slices.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
    const touched: string[] = [];
    for (let step = 1; step <= steps; step++) {
      const id = cardAt(
        active.root,
        document.elementFromPoint(active.x + (dx * step) / steps, active.y + (dy * step) / steps),
      );
      if (id && !active.visited.has(id)) {
        active.visited.add(id);
        touched.push(id);
      }
    }
    active.x = event.clientX;
    active.y = event.clientY;
    if (touched.length) onPaint(touched, active.selected);
  };

  return {
    onPointerDownCapture(event: PointerEvent<HTMLDivElement>) {
      if (!enabled || !event.isPrimary || event.button !== 0 || stroke.current) return;
      const id = cardAt(event.currentTarget, event.target as Element);
      if (!id) return;
      const adding = !selected.includes(id);
      suppressClick.current = true;
      stroke.current = {
        pointerId: event.pointerId,
        root: event.currentTarget,
        selected: adding,
        visited: new Set([id]),
        x: event.clientX,
        y: event.clientY,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      onPaint([id], adding);
    },
    onPointerMove: move,
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      if (stroke.current?.pointerId !== event.pointerId) return;
      move(event);
      end();
    },
    onPointerCancel(event: PointerEvent<HTMLDivElement>) {
      if (stroke.current?.pointerId === event.pointerId) end();
    },
    onLostPointerCapture(event: PointerEvent<HTMLDivElement>) {
      if (stroke.current?.pointerId === event.pointerId) stroke.current = null;
    },
    onClickCapture(event: MouseEvent<HTMLDivElement>) {
      // Pointer selection already happened on down. Keep keyboard/AT clicks intact.
      if (event.detail > 0 && suppressClick.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }
    },
  };
}
