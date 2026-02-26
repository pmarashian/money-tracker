/// <reference types="vite/client" />

/** Teller Connect (https://cdn.teller.io/connect/connect.js) */
declare global {
  interface Window {
    TellerConnect?: {
      setup: (config: {
        applicationId: string;
        products: string[];
        onSuccess: (enrollment: {
          accessToken: string;
          enrollment: { id: string; institution?: { name?: string } };
        }) => void;
        onExit?: () => void;
        onInit?: () => void;
      }) => { open: () => void };
    };
  }
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_PROD_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}