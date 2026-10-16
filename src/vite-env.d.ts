/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute base URL of the CareerLens API. Defaults to the local dev server. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
