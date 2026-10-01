import { X } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CARD_WIDTH } from './layout';

interface Props {
  anchor: HTMLButtonElement | null;
  label: string;
  count: number;
  zoom: number;
  onClose: () => void;
  children: ReactNode;
}

export default function GroupPopover({ anchor, label, count, zoom, onClose, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const width = CARD_WIDTH * zoom + 28;
  useLayoutEffect(() => {
    if (!anchor || !panel.current) return;
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = anchor.closest('.tree-viewport')?.getBoundingClientRect();
      if (
        viewport &&
        (rect.bottom < viewport.top ||
          rect.top > viewport.bottom ||
          rect.right < viewport.left ||
          rect.left > viewport.right)
      ) {
        onClose();
        return;
      }
      const height = panel.current?.getBoundingClientRect().height ?? 0;
      const below = innerHeight - rect.bottom;
      const top = below < height + 8 && rect.top > below ? rect.top - height - 8 : rect.bottom + 8;
      const next = {
        left: Math.max(8, Math.min(rect.left - 8 * zoom - 10, innerWidth - width - 8)),
        top: Math.max(8, Math.min(top, innerHeight - height - 8)),
      };
      setPosition((previous) =>
        previous.left === next.left && previous.top === next.top ? previous : next,
      );
    };
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !anchor.contains(event.target) &&
        !panel.current?.contains(event.target)
      )
        onClose();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        onClose();
        anchor.focus({ preventScroll: true });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(panel.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', keydown);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', keydown);
    };
  }, [anchor, zoom, width, onClose]);
  if (!anchor) return null;
  return createPortal(
    <div
      ref={panel}
      className="group-popover"
      role="region"
      aria-label={label}
      style={{ ...position, width }}
    >
      <header>
        <span title={label}>载具组 · {count} 辆</span>
        <button aria-label="关闭载具组" onClick={onClose}>
          <X size={14} />
        </button>
      </header>
      <div className="group-popover-cards">{children}</div>
    </div>,
    document.body,
  );
}
