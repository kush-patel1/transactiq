import { Link } from 'react-router-dom'

export default function Nav() {
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">IQ</span>
          TransactIQ
        </Link>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <Link to="/demo" className="btn btn-primary" style={{ padding: '9px 18px' }}>
            Live demo →
          </Link>
        </div>
      </div>
    </nav>
  )
}
