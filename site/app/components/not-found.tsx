import { Link } from '@tanstack/react-router'

/** Shown for any unknown URL, and prerendered as /404 so nginx can answer with a real 404. */
export function NotFound() {
  return (
    <main className="container not-found">
      <p className="label">404</p>
      <h1 className="display">this part isn't in the box</h1>
      <p className="muted">
        The page you asked for doesn't exist, or it moved when packages were renamed. These are good
        places to look instead.
      </p>
      <div className="not-found-links">
        <Link to="/packages" className="button primary">
          Browse packages
        </Link>
        <Link to="/docs/$slug" params={{ slug: 'getting-started' }} className="button">
          Read the docs
        </Link>
      </div>
    </main>
  )
}
