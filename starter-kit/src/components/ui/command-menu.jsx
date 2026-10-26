import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils.js';

// Command menu (⌘K / Ctrl+K): a search box that jumps to pages and runs actions, the way Linear and
// Vercel dashboards work. Type to filter, arrow keys to move, Enter to run, Esc to close.
//
// items: [{ label: 'New deal', group: 'Actions', icon: Plus, shortcut: 'N', keywords: 'add create', onSelect: () => ... }]
// Uncontrolled it opens on ⌘K / Ctrl+K by itself; pass open and onOpenChange to control it.

function matches(item, query) {
  if (!query) return true;
  const text = (item.label + ' ' + (item.group || '') + ' ' + (item.keywords || '')).toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => text.includes(word));
}

export function CommandMenu({ items, open: openProp, onOpenChange, placeholder = 'Search or jump to…', empty = 'No results.' }) {
  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [query, setQuery] = React.useState('');
  const [index, setIndex] = React.useState(0);
  const listRef = React.useRef(null);

  React.useEffect(() => {
    if (openProp !== undefined) return undefined;
    function onKey(e) {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpenState((was) => !was);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openProp]);

  React.useEffect(() => {
    if (open) { setQuery(''); setIndex(0); }
  }, [open]);

  const shown = items.filter((item) => matches(item, query));
  const groups = [...new Set(shown.map((item) => item.group || ''))];

  function run(item) {
    setOpen(false);
    item?.onSelect?.();
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(shown[index]); }
  }

  React.useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[15vh] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-glow animate-fade-in"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              role="combobox"
              aria-expanded="true"
              aria-controls="command-menu-list"
              aria-activedescendant={shown[index] ? 'command-item-' + index : undefined}
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">Esc</kbd>
          </div>
          <div id="command-menu-list" ref={listRef} role="listbox" className="max-h-80 overflow-y-auto p-2">
            {shown.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">{empty}</p>}
            {groups.map((group) => (
              <div key={group || 'items'} role="group" aria-label={group || undefined}>
                {group && <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">{group}</p>}
                {shown.map((item, i) => {
                  if ((item.group || '') !== group) return null;
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label + i}
                      id={'command-item-' + i}
                      role="option"
                      aria-selected={i === index}
                      data-active={i === index}
                      onMouseMove={() => setIndex(i)}
                      onClick={() => run(item)}
                      className={cn('flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm', i === index && 'bg-muted text-foreground')}
                    >
                      {Icon && <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && <kbd className="text-xs text-muted-foreground">{item.shortcut}</kbd>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
