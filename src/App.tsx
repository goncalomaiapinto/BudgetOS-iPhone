import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Modal } from './components/Modal'
import { Icon } from './components/Icon'
import { Toasts } from './components/Toasts'
import { TransactionModal } from './components/TransactionModal'
import { useApp } from './lib/app-context'
import { cx } from './lib/format'
import BudgetPage from './pages/BudgetPage'
import CategoriesPage from './pages/CategoriesPage'
import DashboardPage from './pages/DashboardPage'
import InvestmentsPage from './pages/InvestmentsPage'
import PlanPage from './pages/PlanPage'
import SettingsPage from './pages/SettingsPage'
import TransactionsPage from './pages/TransactionsPage'

const nav = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/orcamento', label: 'Orçamento', icon: 'grid' },
  { to: '/previsao', label: 'Previsão', icon: 'target' },
  { to: '/investimentos', label: 'Investimentos', icon: 'trend' },
  { to: '/transacoes', label: 'Transações', icon: 'list' },
  { to: '/categorias', label: 'Categorias', icon: 'tag' },
  { to: '/definicoes', label: 'Definições', icon: 'settings' },
]

// Phone: three tabs + the add button in the middle; the rest lives under "Mais".
const tabs = [
  { to: '/', label: 'Início', icon: 'home' },
  { to: '/transacoes', label: 'Transações', icon: 'list' },
  { to: '/previsao', label: 'Previsão', icon: 'target' },
]
const more = [
  { to: '/orcamento', label: 'Orçamento', icon: 'grid', hint: 'Grelha do ano, mês a mês' },
  { to: '/investimentos', label: 'Investimentos', icon: 'trend', hint: 'Valor, reforços e ganhos' },
  { to: '/categorias', label: 'Categorias', icon: 'tag', hint: 'Categorias e subcategorias' },
  { to: '/definicoes', label: 'Definições', icon: 'settings', hint: 'Contas, data de início, cópia de segurança' },
]

export default function App() {
  const { modal, openTransaction, categoriesError } = useApp()
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const inMore = more.some((m) => m.to === pathname)

  // Global shortcut: N opens "Nova transação" (unless typing somewhere or a dialog is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement
      if (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      openTransaction()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openTransaction])

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <img src="./favicon.svg" alt="" className="size-7" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Orçamento</div>
            <div className="text-xs text-muted">Pessoal</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-inc text-white' : 'text-muted hover:bg-fg/5 hover:text-fg',
                )
              }
            >
              <Icon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-4 py-4 text-xs text-muted">
          Atalho: <kbd className="rounded border border-line px-1 font-sans">N</kbd> nova transação
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 hidden items-center gap-2 border-b border-line bg-surface/90 px-6 py-2.5 backdrop-blur md:flex">
          <div className="ml-auto" />
          <button type="button" className="btn-primary h-9 px-3 sm:px-4" onClick={() => openTransaction()} title="Nova transação" aria-label="Nova transação">
            <Icon name="plus" />
            <span className="hidden sm:inline">Nova transação</span>
          </button>
        </header>

        {categoriesError && (
          <div className="mx-4 mt-4 rounded-lg border border-exp/40 bg-exp-row px-4 py-3 text-sm md:mx-6">
            <strong>Sem ligação à API.</strong> {categoriesError}
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+6.5rem)] md:p-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/orcamento" element={<BudgetPage />} />
            <Route path="/previsao" element={<PlanPage />} />
            <Route path="/investimentos" element={<InvestmentsPage />} />
            <Route path="/transacoes" element={<TransactionsPage />} />
            <Route path="/categorias" element={<CategoriesPage />} />
            <Route path="/definicoes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Phone tab bar: frosted, above the home indicator */}
      <nav
        aria-label="Navegação"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
      >
        {tabs.slice(0, 2).map((t) => (
          <Tab key={t.to} {...t} />
        ))}
        <div className="flex items-start justify-center">
          <button
            type="button"
            onClick={() => openTransaction()}
            aria-label="Nova transação"
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-inc text-white shadow-lg ring-4 shadow-inc/30 ring-bg transition-transform active:scale-95"
          >
            <Icon name="plus" size={26} />
          </button>
        </div>
        <Tab {...tabs[2]} />
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cx('tab-item', inMore ? 'text-inc dark:text-[#9fc0ea]' : 'text-muted')}
        >
          <Icon name="more" size={24} />
          <span>Mais</span>
        </button>
      </nav>

      {moreOpen && (
        <Modal title="Mais" onClose={() => setMoreOpen(false)}>
          <ul className="-mx-2 -my-1">
            {more.map((m) => (
              <li key={m.to}>
                <NavLink
                  to={m.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cx('flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 active:bg-fg/5', isActive && 'bg-inc/10')
                  }
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-inc/10 text-inc dark:bg-inc/30 dark:text-[#9fc0ea]">
                    <Icon name={m.icon} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{m.label}</span>
                    <span className="block text-xs text-muted">{m.hint}</span>
                  </span>
                  <Icon name="right" className="text-muted" />
                </NavLink>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {modal.open && <TransactionModal key={modal.transfer ? `t${modal.transfer.id}` : (modal.transaction?.id ?? 'new')} />}
      <Toasts />
    </div>
  )
}

function Tab({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => cx('tab-item', isActive ? 'text-inc dark:text-[#9fc0ea]' : 'text-muted')}>
      <Icon name={icon} size={24} />
      <span>{label}</span>
    </NavLink>
  )
}
