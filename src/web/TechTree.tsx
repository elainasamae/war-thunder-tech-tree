import { ChevronDown, ChevronRight, Folder, Info, Plane, Shield } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildLayout, CARD_HEIGHT, CARD_WIDTH, type CardLayout } from './layout';
import GroupPopover from './GroupPopover';
import { formatNumber, vehicleName } from './data';
import { unlockRequirement } from './planner';
import type { Mode, NameIndex, TreeData, Vehicle } from './types';

interface Props {
  tree: TreeData;
  names: NameIndex | null;
  chinese: boolean;
  mode: Mode;
  selected: Set<string>;
  expanded: Set<string>;
  zoom: number;
  maxRank: number;
  onSelect: (vehicle: Vehicle) => void;
  onDetails: (vehicle: Vehicle) => void;
  onGroup: (id: string) => void;
}
export default function TechTree({
  tree,
  names,
  chinese,
  mode,
  selected,
  expanded,
  zoom,
  maxRank,
  onSelect,
  onDetails,
  onGroup,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const anchors = useRef(new Map<string, HTMLButtonElement>());
  const [viewportWidth, setViewportWidth] = useState(0);
  useLayoutEffect(() => {
    const viewport = container.current?.parentElement;
    if (!viewport) return;
    const measure = () => setViewportWidth(viewport.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  const layout = useMemo(
    () => buildLayout(tree, viewportWidth / zoom),
    [tree, viewportWidth, zoom],
  );
  const openGroup = layout.cards.find((card) => card.groupId && expanded.has(card.groupId));
  const renderCard = (card: CardLayout, floating = false) => {
    const vehicle = card.vehicle;
    const name = vehicleName(vehicle, names, chinese);
    const kind = vehicle.premium_kind || 'researchable';
    const groupedSelected = card.groupId
      ? tree.vehicles.filter((v) => v.group_id === card.groupId && selected.has(v.unit_id)).length
      : 0;
    return (
      <article
        key={vehicle.unit_id}
        data-vehicle-id={vehicle.unit_id}
        className={`vehicle-card ${kind} ${selected.has(vehicle.unit_id) ? 'selected' : ''}`}
        style={
          floating
            ? {
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                position: 'relative',
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }
            : { left: card.x, top: card.y, width: CARD_WIDTH, height: CARD_HEIGHT }
        }
      >
        <button
          className="vehicle-select"
          aria-label={`选择 ${name}`}
          aria-pressed={selected.has(vehicle.unit_id)}
          onClick={() => onSelect(vehicle)}
          onContextMenu={(event) => {
            event.preventDefault();
            onDetails(vehicle);
          }}
        >
          <div className="card-top">
            <span>
              {kind === 'premium'
                ? '★ 金币'
                : kind === 'squadron'
                  ? '联队'
                  : kind === 'special'
                    ? '活动'
                    : vehicle.research_rp === 0
                      ? '预备载具'
                      : '研发载具'}
            </span>
            <b>{vehicle[`battle_rating_${mode}`] ?? '—'}</b>
          </div>
          <div className="vehicle-art">
            {tree.vehicle_type === 'ground' ? (
              <Shield className="vehicle-fallback" />
            ) : (
              <Plane className="vehicle-fallback" />
            )}
            {vehicle.image_url && (
              <img
                src={vehicle.image_url}
                loading="lazy"
                decoding="async"
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
          <strong className="vehicle-name" title={name}>
            {name}
          </strong>
          <div className="card-cost">
            <span>
              {vehicle.research_rp == null
                ? '—'
                : vehicle.research_rp === 0
                  ? '免费'
                  : formatNumber(vehicle.research_rp)}{' '}
              <small>RP</small>
            </span>
            <span>
              {vehicle.purchase_sl == null
                ? vehicle.purchase_display || '—'
                : formatNumber(vehicle.purchase_sl)}{' '}
              <small>SL</small>
            </span>
          </div>
        </button>
        <button
          className="card-info"
          aria-label={`查看 ${name} 详情`}
          title="查看详情（也可右键载具）"
          onClick={() => onDetails(vehicle)}
        >
          <Info size={13} />
        </button>
        {!floating && card.groupCount > 1 && card.groupLead && (
          <button
            className="group-toggle"
            ref={(element) => {
              if (element) anchors.current.set(card.groupId!, element);
              else anchors.current.delete(card.groupId!);
            }}
            aria-expanded={expanded.has(card.groupId!)}
            aria-label={`${expanded.has(card.groupId!) ? '折叠' : '展开'} ${name} 载具组`}
            onClick={() => onGroup(card.groupId!)}
          >
            <Folder size={12} />
            <span>
              {card.groupCount} 辆{groupedSelected > 0 ? ` · 已选 ${groupedSelected}` : ''}
            </span>
            {expanded.has(card.groupId!) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        )}
      </article>
    );
  };
  return (
    <div
      ref={container}
      className="tree-size"
      style={{ width: layout.width * zoom, height: layout.height * zoom }}
    >
      <div
        className="tree-canvas"
        style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}
      >
        <div className="lane-heading" style={{ left: 72 }}>
          常规研发 <span>RESEARCH</span>
        </div>
        <div className="lane-heading special-heading" style={{ left: layout.specialStart }}>
          特殊载具 <span>PREMIUM / EVENT</span>
        </div>
        <div
          className="tree-divider"
          style={{ left: layout.dividerX, height: layout.height - 32 }}
        />
        {layout.ranks.map((rank) => (
          <div
            className="rank-band"
            key={rank.number}
            style={{ top: rank.y, height: rank.height, width: layout.width }}
          >
            <div className="rank-label">
              <span>等级</span>
              <strong>{rank.rank}</strong>
            </div>
            <div className="rank-rule">
              {rank.number === maxRank
                ? '当前最高等级'
                : `解锁下一级需 ${unlockRequirement(tree.vehicle_type, rank.number)} 辆`}
            </div>
          </div>
        ))}
        <svg className="tree-lines" width={layout.width} height={layout.height} aria-hidden="true">
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 6 6"
              refX="3"
              refY="3"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 6 3 L 0 6 z" fill="currentColor" />
            </marker>
          </defs>
          {layout.edges.map((edge) => (
            <path
              key={edge.id}
              d={edge.path}
              className={selected.has(edge.id) ? 'chosen-line' : ''}
              markerEnd="url(#arrow)"
            />
          ))}
        </svg>
        {layout.cards.map((card) => renderCard(card))}
      </div>
      {openGroup && (
        <GroupPopover
          anchor={anchors.current.get(openGroup.groupId!) ?? null}
          label={`${vehicleName(openGroup.vehicle, names, chinese)} 载具组`}
          count={openGroup.groupCount}
          zoom={zoom}
          onClose={() => onGroup(openGroup.groupId!)}
        >
          {openGroup.members.slice(1).map((vehicle) => (
            <div
              key={vehicle.unit_id}
              className="floating-card-slot"
              style={{ width: CARD_WIDTH * zoom, height: CARD_HEIGHT * zoom }}
            >
              {renderCard({ ...openGroup, vehicle }, true)}
            </div>
          ))}
        </GroupPopover>
      )}
    </div>
  );
}
