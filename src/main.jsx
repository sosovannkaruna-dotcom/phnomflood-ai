import { createRoot } from 'react-dom/client'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/noto-sans-khmer'
import './index.css'
import App from './App'
import JudgeLayer from './judge/JudgeLayer'
import { IconContext } from '@phosphor-icons/react'

createRoot(document.getElementById('root')).render(
  <IconContext.Provider value={{ weight: 'bold' }}>
    <App />
    <JudgeLayer />
  </IconContext.Provider>,
)

// Installable app: register the service worker in production builds only, so development
// always runs the latest code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Not fatal: the site works the same without it.
    })
  })
}
