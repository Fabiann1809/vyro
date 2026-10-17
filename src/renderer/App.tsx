import { useEffect } from 'react'
import { CameraPreview } from './ui/CameraPreview'
import { NavBar } from './ui/NavBar'
import { isImmersive, useNavigation, type Screen } from './ui/navigation'
import { PathScreen } from './ui/screens/PathScreen'
import { CoachScreen } from './ui/screens/CoachScreen'
import { CalibrationScreen } from './ui/screens/CalibrationScreen'
import { ProgressScreen } from './ui/screens/ProgressScreen'
import { SettingsScreen } from './ui/screens/SettingsScreen'
import { SkillCreateScreen } from './ui/screens/SkillCreateScreen'
import { SummaryScreen } from './ui/screens/SummaryScreen'
import { TrainingScreen } from './ui/screens/TrainingScreen'
import { HomeScreen } from './ui/screens/HomeScreen'
import { useSettings } from './ui/settingsStore'
import { useAppliedAppearance } from './ui/useAppliedAppearance'

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
    case 'path':
      return <PathScreen />
    case 'coach':
      return <CoachScreen />
    case 'skillNew':
      return <SkillCreateScreen />
    case 'settings':
      return <SettingsScreen />
    case 'lab':
      return <CameraPreview />
  }
}

function App(): React.JSX.Element {
  useAppliedAppearance()
  // Subscribing makes every screen draw again, with the new texts, when the language changes.
  const language = useSettings((state) => state.language)
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  const screen = useNavigation((state) => state.screen)

  return (
    <div className="flex h-screen flex-col bg-bg text-t1">
      {!isImmersive(screen) && <NavBar />}
      <main className="flex flex-1 items-center justify-center overflow-auto">
        <CurrentScreen screen={screen} />
      </main>
    </div>
  )
}

export default App
