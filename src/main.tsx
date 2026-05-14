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
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <h2 style={{ color: '#f7f8fa', marginBottom: 8, fontWeight: 800, fontSize: 22 }}>
            Unable to load
          </h2>
          <p style={{ marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
            The app could not start. This is usually caused by missing configuration.
            Please check that all environment variables are set and try again.
          </p>
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
