import React from 'react'
import ReactDOM from 'react-dom/client'
import { Root } from './Root.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
// Inter, bundled rather than loaded from Google's CDN — see the note in index.html.
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
)
