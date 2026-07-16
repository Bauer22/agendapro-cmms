import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Troca a senha de um usuário. Roda no SERVIDOR com a Service Role Key.
// Só admin/superadmin da MESMA empresa pode trocar (superadmin troca de qualquer um).
export async function POST(req: NextRequest) {
  try {
    const { user_id, new_password } = await req.json()

    if (!user_id || !new_password || String(new_password).length < 6) {
      return NextResponse.json({ error: 'Senha deve ter ao menos 6 caracteres' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (!serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 })
    }

    // ── 1. Identifica QUEM está pedindo (pelo token do navegador) ──
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const asUser = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userErr } = await asUser.auth.getUser()
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── 2. Confere se quem pede tem permissão ──
    const { data: me } = await admin
      .from('profiles').select('role,company_id').eq('id', userData.user.id).single()

    if (!me || !['admin', 'superadmin'].includes(me.role)) {
      return NextResponse.json({ error: 'Sem permissão para alterar senhas' }, { status: 403 })
    }

    // ── 3. Confere se o alvo é da mesma empresa (superadmin passa direto) ──
    const { data: target } = await admin
      .from('profiles').select('id,display_name,email,role,company_id').eq('id', user_id).single()

    if (!target) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }
    if (me.role !== 'superadmin' && target.company_id !== me.company_id) {
      return NextResponse.json({ error: 'Usuário de outra empresa' }, { status: 403 })
    }
    // Admin comum não mexe em superadmin
    if (me.role === 'admin' && target.role === 'superadmin') {
      return NextResponse.json({ error: 'Sem permissão para alterar senha de Super Admin' }, { status: 403 })
    }

    // ── 4. Troca a senha ──
    const { error } = await admin.auth.admin.updateUserById(user_id, { password: new_password })
    if (error) {
      return NextResponse.json(
        { error: `${error.message} (code: ${(error as any).code || 'n/a'})` },
        { status: (error as any).status || 400 }
      )
    }

    // ── 5. Registra no audit trail ──
    await admin.from('audit_trail').insert({
      table_name: 'auth.users',
      record_id: user_id,
      action: 'PASSWORD_RESET',
      new_data: { target: target.display_name || target.email },
      user_id: userData.user.id,
      user_name: (userData.user.user_metadata as any)?.display_name || userData.user.email,
      company_id: me.company_id,
    }).then(() => {}, () => {})   // não falha se a tabela não existir

    return NextResponse.json({
      ok: true,
      message: `Senha de ${target.display_name || target.email} alterada com sucesso`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado' }, { status: 500 })
  }
}
