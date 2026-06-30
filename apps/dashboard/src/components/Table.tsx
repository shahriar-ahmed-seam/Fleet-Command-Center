import React from 'react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  /** Extracts the raw cell value used for rendering and sorting. */
  accessor: (row: T) => string | number | null | undefined;
  /** Optional custom cell renderer. */
  render?: (row: T) => React.ReactNode;
  /** Enables client-side sorting on this column. */
  sortable?: boolean;
  /** Fixed/limited width. */
  width?: number | string;
  align?: 'left' | 'right' | 'center';
}

export type SortDir = 'asc' | 'desc';

/** Pure, stable sort of rows by a column accessor and direction. */
export function sortRows<T>(
  rows: readonly T[],
  accessor: (row: T) => string | number | null | undefined,
  dir: SortDir,
): T[] {
  const factor = dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const av = accessor(a.row);
      const bv = accessor(b.row);
      // Nullish values sort to the end regardless of direction.
      if (av == null && bv == null) return a.index - b.index;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return a.index - b.index; // stable for equal keys
    })
    .map((x) => x.row);
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Called when a row is clicked (enables row selection UX). */
  onRowClick?: (row: T) => void;
  /** Key of the currently selected row, for highlight. */
  selectedKey?: string | null;
  /** Message shown when there are no rows. */
  emptyMessage?: React.ReactNode;
}

/** A sortable, token-styled data table. */
export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  emptyMessage = 'No records',
}: TableProps<T>): React.ReactElement {
  const [sort, setSort] = React.useState<{ key: string; dir: SortDir } | null>(null);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    return sortRows(rows, col.accessor, sort.dir);
  }, [rows, sort, columns]);

  const toggleSort = (key: string) =>
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 'var(--font-size-sm)',
      }}
    >
      <thead>
        <tr>
          {columns.map((col) => {
            const active = sort?.key === col.key;
            return (
              <th
                key={col.key}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                aria-sort={
                  active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined
                }
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  textAlign: col.align ?? 'left',
                  width: col.width,
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--color-surface-alt)',
                  color: 'var(--color-text-muted)',
                  fontWeight: 600,
                  fontSize: 'var(--font-size-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                  borderBottom: '1px solid var(--color-border)',
                  cursor: col.sortable ? 'pointer' : 'default',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
                {col.sortable && (
                  <span aria-hidden="true" style={{ marginLeft: 6, opacity: active ? 1 : 0.3 }}>
                    {active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 ? (
          <tr>
            <td
              colSpan={columns.length}
              style={{
                padding: 'var(--space-6)',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
              }}
            >
              {emptyMessage}
            </td>
          </tr>
        ) : (
          sorted.map((row) => {
            const key = rowKey(row);
            const selected = key === selectedKey;
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  background: selected ? 'var(--color-surface-alt)' : 'transparent',
                  cursor: onRowClick ? 'pointer' : 'default',
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      textAlign: col.align ?? 'left',
                      borderBottom: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.render ? col.render(row) : col.accessor(row)}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
