import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Esta rota roda no SERVIDOR (nunca no navegador) e usa a Service Role Key,
// que tem permissão de admin no Supabase — cria usuários sem disparar
// e-mail de confirmação e sem o limite de "email rate limit".
export async function POST(req: NextRequest) {
  try {
    const { username, password, display_name, role, company_id, shift, sector, code } = await req.json()

    if (!username || !password || password.length < 6) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 })
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const cleanUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
    const email = `${cleanUsername}@industrial8-internal.com`

    // Cria o usuário já confirmado, sem disparar e-mail nenhum
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // já confirma automaticamente — sem e-mail
      user_metadata: { display_name, role: role || 'operator', company_id }
    })

    if (error) {
      const msg = error.message?.includes('already registered') || error.message?.includes('already been registered')
        ? 'Esse nome de usuário já existe.'
        : `${error.message} (code: ${(error as any).code || 'n/a'}, status: ${(error as any).status || 'n/a'})`
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // Atualiza o profile com os dados completos (o trigger já cria o registro básico)
    if (data.user) {
      await new Promise(r => setTimeout(r, 500))
      await admin.from('profiles').update({
        display_name, role: role || 'operator', company_id, shift, sector, code
      }).eq('id', data.user.id)
    }

    return NextResponse.json({ success: true, user_id: data.user?.id, username: cleanUsername })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro desconhecido' }, { status: 500 })
  }
}
