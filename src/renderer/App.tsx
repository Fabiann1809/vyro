import { useEffect } from 'react'
import { CameraPreview } from './ui/CameraPreview'
import { Ambient } from './ui/kit/Ambient'
import { BrandOpening } from './ui/kit/BrandOpening'
import { ExpandOverlay } from './ui/ExpandOverlay'
import { focusComposer } from './ui/focusComposer'
import { Sidebar } from './ui/Sidebar'
import { isImmersive, useNavigation, type Screen } from './ui/navigation'
import { PathScreen } from './ui/screens/PathScreen'
import { CalibrationScreen } from './ui/screens/CalibrationScreen'
import { DashboardScreen } from './ui/screens/DashboardScreen'
import { HomeScreen } from './ui/screens/HomeScreen'
import { HowScreen } from './ui/screens/HowScreen'
import { LibraryScreen } from './ui/screens/LibraryScreen'
import { SettingsScreen } from './ui/screens/SettingsScreen'
import { SkillCreateScreen } from './ui/screens/SkillCreateScreen'
import { SummaryScreen } from './ui/screens/SummaryScreen'
import { TrainingScreen } from './ui/screens/TrainingScreen'
import { useSession } from './ui/sessionStore'
import { useSettings } from './ui/settingsStore'
import { useAppliedAppearance } from './ui/useAppliedAppearance'

function CurrentScreen({ screen }: { screen: Screen }): React.JSX.Element {
  const skillId = useSession((state) => state.skillId)
  switch (screen) {
    case 'home':
      return <HomeScreen />
    case 'dashboard':
      return <DashboardScreen />
    case 'path':
      return <PathScreen />
    case 'library':
      return <LibraryScreen />
    case 'how':
      return <HowScreen />
    case 'calibration':
      return <CalibrationScreen key={skillId ?? ''} />
    case 'training':
      return <TrainingScreen />
    case 'summary':
      return <SummaryScreen />
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
  const go = useNavigation((state) => state.go)
  const immersive = isImmersive(screen)

  // Ctrl + K (or Cmd + K) goes to the chat from anywhere the person is sitting at the computer.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || immersive) return
      event.preventDefault()
      go('home')
      focusComposer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, immersive])

  return (
    <div
      className={`relative flex h-screen overflow-hidden bg-bg text-t1 ${immersive ? '' : 'gap-3.5 p-3.5'}`}
    >
      <Ambient />
      {!immersive && <Sidebar />}
      <main
        className={`relative flex min-w-0 flex-1 items-center justify-center overflow-auto ${immersive ? '' : 'rounded-[1.875rem]'}`}
      >
        {/* A new key for each screen: the arrival of a screen is a soft slide in, not a jump. */}
        <div key={screen} className="anim-fade flex h-full w-full items-center justify-center">
          <CurrentScreen screen={screen} />
        </div>
      </main>
      <ExpandOverlay />
      <BrandOpening />
    </div>
  )
}

export default App
