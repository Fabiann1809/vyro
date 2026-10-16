import { CameraPreview } from './ui/CameraPreview'
import { NavBar } from './ui/NavBar'
import { isImmersive, useNavigation, type Screen } from './ui/navigation'
import { PlaceholderScreen } from './ui/screens/PlaceholderScreen'
import { useAppliedTheme } from './ui/useAppliedTheme'

function CurrentScreen({ screen }: { screen: Screen }): React.JSX.Element {
  switch (screen) {
    case 'home':
      return <PlaceholderScreen screen={screen} title="screen.home.title" />
    case 'calibration':
      return <PlaceholderScreen screen={screen} title="screen.calibration.title" />
    case 'training':
      return <PlaceholderScreen screen={screen} title="screen.training.title" />
    case 'summary':
      return <PlaceholderScreen screen={screen} title="screen.summary.title" />
    case 'progress':
      return <PlaceholderScreen screen={screen} title="screen.progress.title" />
    case 'settings':
      return <PlaceholderScreen screen={screen} title="screen.settings.title" />
    case 'lab':
      return <CameraPreview />
  }
}

function App(): React.JSX.Element {
  useAppliedTheme()
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
