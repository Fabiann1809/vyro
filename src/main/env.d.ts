// The values set when the app is built (see `.env.example`). Only variables that start with
// MAIN_VITE_ reach the main process, and none of them may be a secret: they end up in the bundle.
interface ImportMetaEnv {
  readonly MAIN_VITE_SUPABASE_URL?: string
  readonly MAIN_VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
