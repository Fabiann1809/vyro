import { useEffect } from 'react'
import { CameraPreview } from './ui/CameraPreview'
import { NavBar } from './ui/NavBar'
import { isImmersive, useNavigation, type Screen } from './ui/navigation'
import { CalibrationScreen } from './ui/screens/CalibrationScreen'
import { ProgressScreen } from './ui/screens/ProgressScreen'
import { SettingsScreen } from './ui/screens/SettingsScreen'
import { SummaryScreen } from './ui/screens/SummaryScreen'
import { TrainingScreen } from './ui/screens/TrainingScreen'
import { HomeScreen } from './ui/screens/HomeScreen'
import { useSettings } from './ui/settingsStore'
import { useAppliedTheme } from './ui/useAppliedTheme'

function CurrentScreen({ screen }: { screen: Screen }): React.JSX.Element {
  switch (screen) {
    case 'home':
      return <HomeScreen />
    case 'calibration':
      return <CalibrationScreen />
    case 'training':
      return <TrainingScreen />
    case 'summary':
      return <SummaryScreen />
    case 'progress':
      return <ProgressScreen />
    case 'settings':
      return <SettingsScreen />
    case 'lab':
      return <CameraPreview />
  }
}

function App(): React.JSX.Element {
  useAppliedTheme()
  // Subscribing makes every screen draw again, with the new texts, when the language changes.
  const language = useSettings((state) => state.language)
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  const screen = useNavigation((state) => state.screen)

  return (
    <div className="flex h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {!isImmersive(screen) && <NavBar />}
      <main className="flex flex-1 items-center justify-center overflow-auto">
        <CurrentScreen screen={screen} />
      </main>
    </div>
  )
}

export default App
