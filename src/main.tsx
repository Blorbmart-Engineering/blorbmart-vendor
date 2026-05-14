import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const root = createRoot(document.getElementById('root')!)

import('./App.tsx')
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  })
  .catch((err) => {
    console.error('App failed to load:', err)
    const message = err instanceof Error ? err.message : String(err)
    root.render(
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#0b0f14',
        color: '#c4cfdd',
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <h2 style={{ color: '#f7f8fa', marginBottom: 8, fontWeight: 800, fontSize: 22 }}>
            Unable to load
          </h2>
          <p style={{ marginBottom: 12, fontSize: 14, lineHeight: 1.6 }}>
            The app could not start due to a configuration error.
          </p>
          <pre style={{
            background: '#161c26',
            border: '1px solid #2a3444',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 12,
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#f87171',
            marginBottom: 20,
          }}>
            {message}
          </pre>
          <button
            style={{
              padding: '10px 24px',
              background: '#f97316',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  })
