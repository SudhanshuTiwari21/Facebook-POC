/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FB_APP_ID: string;
  readonly VITE_FB_CONFIG_ID: string;
  readonly VITE_FB_GRAPH_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

