import { createClient } from '@supabase/supabase-js'

// strip BOM (﻿) that PowerShell can inject when piping env vars to the Vercel CLI
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string)?.replace(/^﻿/, '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string)?.replace(/^﻿/, '').trim()

export const supabase = createClient(supabaseUrl, supabaseAnonKey)