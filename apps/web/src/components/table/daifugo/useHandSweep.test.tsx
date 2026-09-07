import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHandSweep } from './useHandSweep';

let container: HTMLDivElement;
let root: Root;
const ids = ['C4', 'H4', 'D4', 'S4'];
function Harness({
  enabled = true,
  epoch = 'one',
  cap = 4,
  initial = [],
}: {
  enabled?: boolean;
  epoch?: string;
  cap?: number;
  initial?: string[];
}) {
  const [selected, setSelected] = useState(initial);
  const sweep = useHandSweep({
    enabled,
    epoch,
    selected,
    onPaint: (cards, adding) => {
      setSelected((old) =>
        adding
          ? [...new Set([...old, ...cards])].slice(0, cap)
          : old.filter((id) => !cards.includes(id)),
      );
    },
  });
  return (
    <div data-sweep {...sweep}>
      {ids.map((id) => (
        <div key={id} data-hand-card data-card-id={id}>
          <button
            disabled={!enabled}
            aria-pressed={selected.includes(id)}
            onClick={() =>
              setSelected((old) => (old.includes(id) ? old.filter((x) => x !== id) : [...old, id]))
            }
          >
            {id}
          </button>
        </div>
      ))}
      <output>{selected.join(',')}</output>
    </div>
  );
}
function pointer(
  target: Element,
  type: string,
  x: number,
  options: { pointerId?: number; isPrimary?: boolean; button?: number } = {},
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: 5,
    button: options.button ?? 0,
  });
  Object.defineProperties(event, {
    pointerId: { value: options.pointerId ?? 1 },
    isPrimary: { value: options.isPrimary ?? true },
    pointerType: { value: 'touch' },
  });
  act(() => target.dispatchEvent(event));
}
const buttons = () => [...container.querySelectorAll('button')];
const rail = () => container.querySelector('[data-sweep]')!;
const chosen = () => container.querySelector('output')!.textContent;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: vi.fn((x: number, y: number) =>
      y < 0 ? null : (buttons()[Math.floor(x / 20)] ?? null),
    ),
  });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'elementFromPoint');
});

describe('Daifugo hand sweep', () => {
  it('samples skipped cards on a fast sweep, visits each once, and suppresses the follow-up click', () => {
    act(() => root.render(<Harness />));
    pointer(buttons()[0]!, 'pointerdown', 5);
    pointer(rail(), 'pointermove', 65);
    pointer(rail(), 'pointermove', 5);
    pointer(rail(), 'pointerup', 5);
    act(() =>
      buttons()[0]!.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }),
      ),
    );
    expect(chosen()).toBe('C4,H4,D4,S4');
  });
  it('erases an entire sweep begun on a selected card without toggling on a return pass', () => {
    act(() => root.render(<Harness initial={['C4', 'H4', 'D4', 'S4']} />));
    pointer(buttons()[3]!, 'pointerdown', 65);
    pointer(rail(), 'pointermove', 5);
    pointer(rail(), 'pointermove', 65);
    pointer(rail(), 'pointerup', 65);
    expect(chosen()).toBe('');
  });
  it('retains keyboard activation and respects the selection cap', () => {
    act(() => root.render(<Harness cap={2} />));
    pointer(buttons()[0]!, 'pointerdown', 5);
    pointer(rail(), 'pointerup', 65);
    expect(chosen()).toBe('C4,H4');
    act(() => buttons()[0]!.click());
    expect(chosen()).toBe('H4');
  });
  it('ignores secondary pointers, right clicks, disabled cards and movement after cancellation', () => {
    act(() => root.render(<Harness />));
    pointer(buttons()[0]!, 'pointerdown', 5, { isPrimary: false });
    pointer(buttons()[0]!, 'pointerdown', 5, { button: 2 });
    expect(chosen()).toBe('');
    pointer(buttons()[0]!, 'pointerdown', 5);
    pointer(rail(), 'pointermove', 65, { pointerId: 2 });
    expect(chosen()).toBe('C4');
    pointer(rail(), 'pointercancel', 5);
    pointer(rail(), 'pointermove', 65);
    expect(chosen()).toBe('C4');
    act(() => root.render(<Harness enabled={false} />));
    pointer(buttons()[1]!, 'pointerdown', 25);
    expect(chosen()).toBe('C4');
  });
  it('ends an in-flight sweep on a new game event or lost pointer capture', () => {
    act(() => root.render(<Harness />));
    pointer(buttons()[0]!, 'pointerdown', 5);
    act(() => root.render(<Harness epoch="two" />));
    pointer(rail(), 'pointermove', 65);
    expect(chosen()).toBe('C4');
    pointer(buttons()[1]!, 'pointerdown', 25);
    pointer(rail(), 'lostpointercapture', 25);
    pointer(rail(), 'pointermove', 65);
    expect(chosen()).toBe('C4,H4');
  });
});
