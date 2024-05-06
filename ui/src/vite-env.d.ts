/// <reference types="./global-type-overrides.d.ts" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RIVER_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
