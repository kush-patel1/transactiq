import { useState } from 'react'
import { Link } from 'react-router-dom'
import Register from '../components/Register'
import Receiving from '../components/Receiving'
import Dashboard from '../components/Dashboard'
import BackOffice from '../components/BackOffice'
import { StoreProvider, useStore } from '../lib/store'
import { STORE_NAME } from '../lib/seed'
import type { Role, User } from '../lib/types'

type Tab = 'register' | 'receiving' | 'dashboard' | 'backoffice'

const TABS: { id: Tab; label: string; roles: Role[] }[] = [
  { id: 'register', label: 'Register', roles: ['owner', 'cashier'] },
  { id: 'receiving', label: 'Receiving', roles: ['owner', 'cashier'] },
  { id: 'dashboard', label: 'Dashboard', roles: ['owner'] },
  { id: 'backoffice', label: 'Back Office', roles: ['owner'] },
]

export default function Demo() {
  return (
    <StoreProvider>
      <DemoShell />
    </StoreProvider>
  )
}

function DemoShell() {
  const { dispatch, currentUser } = useStore()
  const [tab, setTab] = useState<Tab>('register')

  if (!currentUser) {
    return <Login onLogin={(u) => { dispatch({ type: 'LOGIN', userId: u.id }); setTab('register') }} />
  }

  const visibleTabs = TABS.filter((t) => t.roles.includes(currentUser.role))

  return (
    <div className="demo-shell">
      <div className="demo-bar">
        <Link to="/" className="brand" style={{ fontSize: 17 }}>
          <span className="brand-mark">IQ</span>
          TransactIQ
        </Link>

        <div className="tabs" role="tablist">
          {visibleTabs.map((tb) => (
            <button
              key={tb.id}
              role="tab"
              aria-selected={tab === tb.id}
              className={'tab' + (tab === tb.id ? ' active' : '')}
              onClick={() => setTab(tb.id)}
            >
              {tb.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="chip" title={`Role: ${currentUser.role}`}>
            <span className="avatar sm">{currentUser.name[0]}</span>
            {currentUser.name} · {currentUser.role}
          </span>
          <button
            className="btn btn-ghost"
            style={{ padding: '7px 14px', fontSize: 13 }}
            onClick={() => dispatch({ type: 'LOGOUT' })}
          >
            Switch user
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '7px 14px', fontSize: 13 }}
            title="Reseed the demo data and sign out"
            onClick={() => dispatch({ type: 'RESET' })}
          >
            Reset demo
          </button>
        </div>
      </div>

      <div className="demo-body">
        {tab === 'register' && <Register />}
        {tab === 'receiving' && <Receiving />}
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'backoffice' && <BackOffice />}
      </div>
    </div>
  )
}

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const { state } = useStore()
  const [selected, setSelected] = useState<User | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  function submit() {
    if (!selected) return
    if (pin === selected.pin) {
      onLogin(selected)
    } else {
      setError(true)
      setPin('')
    }
  }

  return (
    <div className="login-screen">
      <div className="brand" style={{ fontSize: 24, marginBottom: 6 }}>
        <span className="brand-mark" style={{ width: 38, height: 38, borderRadius: 11 }}>IQ</span>
        TransactIQ
      </div>
      <p style={{ color: 'var(--text-2)', margin: '0 0 28px' }}>
        {STORE_NAME} · who’s on the register?
      </p>

      <div className="user-cards">
        {state.users.map((u) => (
          <button
            key={u.id}
            className={'user-card glass' + (selected?.id === u.id ? ' selected' : '')}
            onClick={() => { setSelected(u); setPin(''); setError(false) }}
          >
            <div className="avatar" style={{ margin: '0 auto' }}>{u.name[0]}</div>
            <div style={{ fontWeight: 700, marginTop: 10 }}>{u.name}</div>
            <div style={{ color: 'var(--text-3)', fontSize: 13, textTransform: 'capitalize' }}>{u.role}</div>
            <div className="pin-hint">demo PIN: {u.pin}</div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mini-form" style={{ marginTop: 26, justifyContent: 'center' }}>
          <input
            className="mini-input pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="PIN"
            value={pin}
            autoFocus
            onChange={(e) => { setPin(e.target.value); setError(false) }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            aria-label={`PIN for ${selected.name}`}
          />
          <button className="btn btn-primary" style={{ padding: '10px 22px' }} onClick={submit}>
            Sign in
          </button>
        </div>
      )}
      {error && <p style={{ color: 'var(--red)', fontSize: 14, marginTop: 12 }}>Wrong PIN — try again.</p>}

      <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 34, maxWidth: 420, textAlign: 'center' }}>
        Roles gate what each person sees: cashiers get the register and receiving;
        owners also get the IQ dashboard and back office. Real build swaps PINs for Firebase Auth.
      </p>
    </div>
  )
}
