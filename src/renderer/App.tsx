import { APP_NAME } from '@shared/app'

function App(): React.JSX.Element {
  return (
    <main className="flex h-screen items-center justify-center bg-slate-950">
      <h1 className="text-5xl font-bold tracking-widest text-emerald-400">{APP_NAME}</h1>
    </main>
  )
}

export default App
