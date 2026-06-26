import { createClient } from '@supabase/supabase-js'

// Remove o BOM (U+FEFF) que o PowerShell pode injetar ao passar envs para a Vercel CLI.
// Evita-se um BOM literal no código-fonte usando o code point (no-irregular-whitespace).
function stripBom(value: string | undefined): string {
  if (!value) return ''
  return (value.charCodeAt(0) === 0xfeff ? value.slice(1) : value).trim()
}

const supabaseUrl = stripBom(import.meta.env.VITE_SUPABASE_URL as string)
const supabaseAnonKey = stripBom(import.meta.env.VITE_SUPABASE_ANON_KEY as string)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
