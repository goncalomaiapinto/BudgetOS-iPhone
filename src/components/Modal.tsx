import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from '../lib/format'
import { Icon } from './Icon'

interface Props {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}

/** Minimal accessible modal (a bottom sheet on phones): Esc closes, focus stays inside, click on the backdrop closes. */
export function Modal({ title, onClose, children, footer, width = 'max-w-md' }: Props) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    // Focus the first field unless a child already grabbed focus (autoFocus).
    if (!panel.current?.contains(document.activeElement)) {
      panel.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])')?.focus()
    }
    return () => previous?.focus?.()
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[1px] md:items-start md:overflow-y-auto md:p-4 md:pt-[8vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className={cx(
          'card sheet-in flex max-h-[92dvh] w-full flex-col rounded-t-2xl rounded-b-none border-b-0 shadow-2xl md:max-h-none md:rounded-xl md:border-b',
          width,
        )}
        onKeyDown={(e) => {
          if (e.key !== 'Tab' || !panel.current) return
          const items = panel.current.querySelectorAll<HTMLElement>(
            'input:not([type=hidden]):not([tabindex="-1"]), select, textarea, button:not(:disabled)',
          )
          const first = items[0]
          const last = items[items.length - 1]
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-fg/20 md:hidden" />
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" data-close className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </div>
        <div className={cx('overflow-y-auto overscroll-contain px-5 py-4', !footer && 'pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-4')}>
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-line px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] *:flex-1 md:pb-3 md:*:flex-none">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
