import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './styles-base.css'
import './styles-ui.css'

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)