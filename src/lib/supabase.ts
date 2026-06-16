import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client principal — usado em toda a aplicação, mantém a sessão do usuário logado
export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true }
})

// Client isolado e descartável — usado SOMENTE para criar novos usuários
// (signUp) sem substituir a sessão do admin que está logado.
// Não persiste sessão em localStorage, então não interfere com o client principal.
export function createIsolatedClient() {
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}
