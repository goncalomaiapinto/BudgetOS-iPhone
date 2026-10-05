import type { Transaction, Transfer } from '../lib/api'
import { cx, formatDate, formatMoney } from '../lib/format'
import { Icon } from './Icon'

/** One transaction (or transfer) as a phone list row: tinted icon, what/where on two lines, amount on the right. */
export function TxItem({ t, onClick, showDate = true }: { t: Transaction; onClick: () => void; showDate?: boolean }) {
  const income = t.type === 'Income'
  const color = t.categoryColor ?? 'var(--muted)'
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-2.5 text-left active:bg-fg/5">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color: `color-mix(in srgb, ${color} 75%, var(--fg))` }}
      >
        <Icon name={income ? 'arrowDownRight' : 'arrowUpRight'} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{t.subCategoryName ?? t.categoryName}</span>
        <span className="block truncate text-xs text-muted">
          {t.description ? `${t.description} · ` : ''}
          {t.accountName}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={cx('block font-semibold tabular', income ? 'text-pos' : 'text-fg')}>
          {income ? '+' : '−'}
          {formatMoney(t.amount)}
        </span>
        {showDate && <span className="block text-xs text-muted tabular">{formatDate(t.date)}</span>}
      </span>
    </button>
  )
}

export function TransferItem({ t, onClick, showDate = true }: { t: Transfer; onClick: () => void; showDate?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-2.5 text-left active:bg-fg/5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-fg/[0.07] text-muted">
        <Icon name="swap" size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">Transferência</span>
        <span className="block truncate text-xs text-muted">
          {t.fromAccountName} → {t.toAccountName}
          {t.description ? ` · ${t.description}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-semibold text-muted tabular">{formatMoney(t.amount)}</span>
        {showDate && <span className="block text-xs text-muted tabular">{formatDate(t.date)}</span>}
      </span>
    </button>
  )
}
