import React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Input } from './input.jsx';
import { Button } from './button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select.jsx';

// Data table for lists of records: sort by any column, search across all of them, page through
// long lists. Built on TanStack Table 8 (MIT).
//
// columns: [{ key: 'name', header: 'Name', cell: (row) => <b>{row.name}</b>, sortable: true, align: 'right' }]
// (full TanStack column definitions with accessorKey or accessorFn work too)
// data: an array of plain objects. onRowClick(row) makes rows clickable.
// filters: [{ key: 'status', label: 'Status', options: ['Lead', 'Won'] }] adds a dropdown per field
// (options default to the values found in the data, each with how many rows have it).

function toColumnDef(column) {
  if (column.accessorKey || column.accessorFn || column.columns) return column;
  return {
    id: column.key,
    accessorKey: column.key,
    header: column.header ?? column.key,
    enableSorting: column.sortable !== false,
    filterFn: 'equalsString',
    meta: { align: column.align, className: column.className },
    ...(column.cell ? { cell: (info) => column.cell(info.row.original, info) } : {}),
  };
}

const ALL = '__all';

// One dropdown that keeps only the rows whose field equals the chosen value.
function ColumnFilter({ table, filter, data }) {
  const column = table.getColumn(filter.key);
  if (!column) return null;
  const counts = new Map();
  for (const row of data) counts.set(String(row[filter.key] ?? ''), (counts.get(String(row[filter.key] ?? '')) || 0) + 1);
  const options = (filter.options || [...counts.keys()].filter(Boolean).sort()).map(String);
  const value = column.getFilterValue() ?? ALL;
  return (
    <Select value={value} onValueChange={(next) => column.setFilterValue(next === ALL ? undefined : next)}>
      <SelectTrigger className="h-10 w-full sm:w-44" aria-label={'Filter by ' + (filter.label || filter.key)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {String(filter.label || filter.key).toLowerCase()}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option} ({counts.get(option) || 0})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SortIcon({ direction }) {
  if (direction === 'asc') return <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />;
  if (direction === 'desc') return <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />;
  return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />;
}

export function DataTable({
  columns,
  data,
  searchable = true,
  searchPlaceholder = 'Search…',
  filters = [],
  pageSize = 10,
  onRowClick,
  empty = 'Nothing here yet.',
  toolbar,
  className,
}) {
  const [sorting, setSorting] = React.useState([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [columnFilters, setColumnFilters] = React.useState([]);
  const columnDefs = React.useMemo(() => columns.map(toColumnDef), [columns]);

  const table = useReactTable({
    data: data || [],
    columns: columnDefs,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {(searchable || toolbar || filters.length > 0) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {searchable && (
            <label className="relative w-full sm:max-w-xs">
              <span className="sr-only">{searchPlaceholder}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={searchPlaceholder} className="pl-9" />
            </label>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {filters.map((filter) => (
              <ColumnFilter key={filter.key} table={table} filter={filter} data={data || []} />
            ))}
            {toolbar}
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const align = header.column.columnDef.meta?.align;
                  const canSort = header.column.getCanSort();
                  const label = header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext());
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={{ asc: 'ascending', desc: 'descending' }[header.column.getIsSorted()] || 'none'}
                      className={cn('h-11 whitespace-nowrap px-4 text-left font-medium text-muted-foreground', align === 'right' && 'text-right')}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn('inline-flex items-center gap-1.5 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', align === 'right' && 'flex-row-reverse')}
                        >
                          {label}
                          <SortIcon direction={header.column.getIsSorted()} />
                        </button>
                      ) : (
                        label
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columnDefs.length} className="px-4 py-12 text-center text-muted-foreground">
                  {globalFilter || columnFilters.length ? 'No rows match your search or filters.' : empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row.original); } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn('border-b last:border-0 transition-colors', onRowClick && 'cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none')}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn('px-4 py-3 align-middle', cell.column.columnDef.meta?.align === 'right' && 'text-right tabular-nums', cell.column.columnDef.meta?.className)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {pageCount} · {total} {total === 1 ? 'row' : 'rows'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
