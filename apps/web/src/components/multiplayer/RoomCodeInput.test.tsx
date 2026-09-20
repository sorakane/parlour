import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { RoomCodeInput } from './RoomCodeInput';

it('preserves IME text and accepts Enter only after composition has finished', async () => {
  const confirm = vi.fn();
  function Field() {
    const [value, setValue] = useState('');
    return (
      <RoomCodeInput
        value={value}
        onChange={setValue}
        onConfirm={confirm}
        disabled={false}
        autoFocus={false}
        label="部屋コード"
      />
    );
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Field />));
    const input = container.querySelector('input')!;
    const enter = (options: KeyboardEventInit = {}) =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ...options }),
      );
    await act(async () => {
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'e');
      input.dispatchEvent(new InputEvent('input', { data: 'e', isComposing: true, bubbles: true }));
    });
    expect(input.value).toBe('e');
    await act(async () => enter());
    expect(confirm).not.toHaveBeenCalled();
    await act(async () =>
      input.dispatchEvent(new CompositionEvent('compositionend', { data: 'e', bubbles: true })),
    );
    expect(input.value).toBe('e');
    await act(async () => enter({ keyCode: 229 }));
    expect(confirm).not.toHaveBeenCalled();
    // Equal adjacent characters may be a real code; never deduplicate them.
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        'ee46',
      );
      input.dispatchEvent(new InputEvent('input', { data: 'e46', bubbles: true }));
    });
    expect(input.value).toBe('ee46');
    await act(async () => enter());
    expect(confirm).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
