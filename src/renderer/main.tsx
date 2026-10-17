import './styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startSettingsSync } from './ui/settingsSync'
import { loadCustomSkills } from './ui/skillsStore'

// The saved settings and the skills made later are loaded first, so that the first screen already
// has the right language, theme and exercises.
void Promise.all([startSettingsSync(window.api), loadCustomSkills(window.api)]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
