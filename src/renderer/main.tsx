import './styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startSettingsSync } from './ui/settingsSync'

// The saved settings are loaded first, so the first screen already has the right language/theme.
void startSettingsSync(window.api).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
