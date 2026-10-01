import { useEffect, useId, useState, type RefObject } from 'react';

interface Connection {
  from: string;
  to: string;
  label: string;
}
interface Props {
  grid: RefObject<HTMLDivElement | null>;
  connections: Connection[];
}
export default function ModConnections({ grid, connections }: Props) {
  const marker = useId();
  const [drawing, setDrawing] = useState({
    width: 0,
    height: 0,
    paths: [] as (Connection & { d: string })[],
  });
  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    const update = () => {
      const buttons = new Map(
        [...element.querySelectorAll<HTMLButtonElement>('button[data-mod-id]')].map((button) => [
          button.dataset.modId!,
          button,
        ]),
      );
      const paths = connections.flatMap((connection) => {
        const from = buttons.get(connection.from);
        const to = buttons.get(connection.to);
        if (!from || !to) return [];
        const x1 = from.offsetLeft + from.offsetWidth / 2;
        const y1 = from.offsetTop + from.offsetHeight;
        const x2 = to.offsetLeft + to.offsetWidth / 2;
        const y2 = to.offsetTop;
        const adjacent = y2 - y1 <= 24;
        // Route skipped tiers around the cards rather than through their text.
        const lane = from.offsetLeft + from.offsetWidth + 4.5;
        const sameRow = Math.abs(from.offsetTop - to.offsetTop) < 1;
        const right = x2 > x1;
        const fromSide = from.offsetLeft + (right ? from.offsetWidth : 0);
        const toSide = to.offsetLeft + (right ? 0 : to.offsetWidth);
        const gap = Math.abs(fromSide - toSide);
        const middle = from.offsetTop + from.offsetHeight / 2;
        const d = sameRow
          ? gap < 24
            ? `M ${fromSide} ${middle} H ${toSide}`
            : `M ${fromSide} ${middle} H ${fromSide + (right ? 4.5 : -4.5)} V ${y1 + 10} H ${toSide + (right ? -4.5 : 4.5)} V ${middle} H ${toSide}`
          : to.offsetTop < from.offsetTop
            ? `M ${x1} ${from.offsetTop} V ${from.offsetTop - 10} H ${lane} V ${to.offsetTop + to.offsetHeight + 10} H ${x2} V ${to.offsetTop + to.offsetHeight}`
            : Math.abs(x1 - x2) < 1 && adjacent
              ? `M ${x1} ${y1} V ${y2}`
              : adjacent
                ? `M ${x1} ${y1} V ${y1 + 9} H ${x2} V ${y2}`
                : `M ${x1} ${y1} V ${y1 + 9} H ${lane} V ${y2 - 9} H ${x2} V ${y2}`;
        return [{ ...connection, d }];
      });
      setDrawing({ width: element.clientWidth, height: element.clientHeight, paths });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [grid, connections]);
  return (
    <svg
      className="mod-connections"
      width={drawing.width}
      height={drawing.height}
      aria-hidden="true"
    >
      <defs>
        <marker
          id={marker}
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="currentColor" />
        </marker>
      </defs>
      {drawing.paths.map((path) => (
        <path
          key={`${path.from}-${path.to}`}
          className="mod-connection"
          data-from={path.from}
          data-to={path.to}
          d={path.d}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd={`url(#${marker})`}
        >
          <title>{path.label}</title>
        </path>
      ))}
    </svg>
  );
}
