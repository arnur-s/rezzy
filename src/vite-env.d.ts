/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  // WhatsApp Embedded Signup (optional — the connect form degrades gracefully
  // when unset). App id + Embedded Signup configuration id from the Meta app.
  readonly VITE_WHATSAPP_APP_ID?: string
  readonly VITE_WHATSAPP_CONFIG_ID?: string
  // Mirrors WHATSAPP_GRAPH_VERSION on the edge functions. Confirm the current
  // stable Graph API version at deploy time rather than relying on the default.
  readonly VITE_WHATSAPP_GRAPH_VERSION?: string
  // VAPID public key for Web Push (optional — desktop notifications degrade
  // gracefully when unset). The matching private key is an edge function secret.
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
