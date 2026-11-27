import {useEffect, useRef, type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';

export function WidgetContextMenu({x, y, label, actions, close}: {
  x: number;
  y: number;
  label: string;
  actions: Array<{label: string; run: () => void}>;
  close: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    menu.current?.querySelector('button')?.focus();
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) close();
    };
    const reposition = () => close();
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', reposition);
      if (previous?.isConnected && document.activeElement === document.body) previous.focus();
    };
  }, [close]);
  function keyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const items = Array.from(menu.current?.querySelectorAll('button') ?? []);
    const index = items.findIndex(item => item === document.activeElement);
    items[(index + items.length + (event.key === 'ArrowUp' ? -1 : 1)) % items.length]?.focus();
    event.preventDefault();
  }
  return createPortal(
    <div ref={menu} role="menu" aria-label={label} className="add-tool-context-menu"
      style={{left: Math.max(4, Math.min(x, window.innerWidth - 240)), top: Math.max(4, Math.min(y, window.innerHeight - 110))}}
      onKeyDown={keyDown} onContextMenu={event => event.preventDefault()}>
      {actions.map(action => <button key={action.label} type="button" role="menuitem"
        onClick={() => { close(); action.run(); }}>{action.label}</button>)}
    </div>,
    document.body,
  );
}
