import React from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { cn } from '../../lib/utils.js';

// Kanban board: cards in columns that people drag between (mouse, touch, or keyboard: focus a
// card, press Space, move with the arrow keys, Space again to drop). Built on dnd-kit (MIT); the
// approach follows next-shadcn-dashboard-starter by Kiranism (MIT).
//
// columns: [{ id: 'lead', title: 'Lead' }, { id: 'won', title: 'Won' }]
// items: [{ id: 'd1', column: 'lead', ...your fields }]
// renderCard(item) draws a card; onMove(itemId, toColumnId) saves the move (update your data there).
// columnFooter(column) adds something under a column (an "Add" button), columnTotal(items) a
// number beside its title (for example the deal value).

// Keyboard moves: left and right jump a whole column (the default would move a few pixels).
function columnJump(columns) {
  return (event, { context: { active, collisionRect, droppableRects } }) => {
    if (event.code !== KeyboardCode.Right && event.code !== KeyboardCode.Left) return undefined;
    event.preventDefault();
    if (!active || !collisionRect) return undefined;
    const centre = collisionRect.left + collisionRect.width / 2;
    const rects = columns.map((c) => droppableRects.get(c.id)).filter(Boolean).sort((a, b) => a.left - b.left);
    const here = rects.findIndex((r) => centre >= r.left && centre <= r.left + r.width);
    const next = rects[Math.max(0, Math.min(rects.length - 1, (here < 0 ? 0 : here) + (event.code === KeyboardCode.Right ? 1 : -1)))];
    if (!next) return undefined;
    return { x: next.left + next.width / 2 - collisionRect.width / 2, y: Math.max(next.top + 8, collisionRect.top) };
  };
}

function Card({ item, renderCard }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id, data: { column: item.column } });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab touch-none rounded-lg border bg-card p-3 text-card-foreground shadow-soft outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
    >
      {renderCard(item)}
    </div>
  );
}

function Column({ column, items, renderCard, columnFooter, columnTotal }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section
      aria-label={column.title}
      className={cn('flex w-72 shrink-0 flex-col gap-3 rounded-xl border bg-muted/40 p-3 transition-colors sm:w-80', isOver && 'border-primary/60 bg-primary/5')}
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <h3 className="font-display text-sm font-semibold">{column.title}</h3>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
          {columnTotal ? columnTotal(items) : items.length}
        </span>
      </header>
      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2">
        {items.map((item) => (
          <Card key={item.id} item={item} renderCard={renderCard} />
        ))}
        {items.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Drop a card here</p>
        )}
      </div>
      {columnFooter && columnFooter(column)}
    </section>
  );
}

export function Kanban({ columns, items, onMove, renderCard, columnFooter, columnTotal, className }) {
  const [activeId, setActiveId] = React.useState(null);
  const sensors = useSensors(
    // A small drag distance keeps clicks on buttons inside a card working.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnJump(columns) })
  );
  const active = items.find((item) => item.id === activeId);

  function handleDragEnd({ active: dragged, over }) {
    setActiveId(null);
    if (!over) return;
    const from = dragged.data.current?.column;
    const to = columns.some((c) => c.id === over.id) ? over.id : items.find((i) => i.id === over.id)?.column;
    if (to && to !== from) onMove?.(dragged.id, to);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active: dragged }) => setActiveId(dragged.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active: a }) => 'Picked up card ' + a.id + '.',
          onDragOver: ({ over }) => (over ? 'Over ' + (columns.find((c) => c.id === over.id)?.title || 'a card') + '.' : ''),
          onDragEnd: ({ over }) => (over ? 'Dropped in ' + (columns.find((c) => c.id === over.id)?.title || 'the column') + '.' : 'Dropped.'),
          onDragCancel: () => 'Move cancelled.',
        },
      }}
    >
      <div className={cn('flex gap-4 overflow-x-auto pb-2', className)}>
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            items={items.filter((item) => item.column === column.id)}
            renderCard={renderCard}
            columnFooter={columnFooter}
            columnTotal={columnTotal}
          />
        ))}
      </div>
      <DragOverlay>
        {active ? (
          <div className="rotate-2 rounded-lg border bg-card p-3 text-card-foreground shadow-glow">{renderCard(active)}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
