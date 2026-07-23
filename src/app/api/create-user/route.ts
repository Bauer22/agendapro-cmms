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
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // ── 2. Confere se quem pede tem permissão de criar usuário ──
    const { data: me } = await admin
      .from('profiles').select('role,company_id').eq('id', userData.user.id).single()

    if (!me || !['admin', 'superadmin'].includes(me.role)) {
      return NextResponse.json({ error: 'Sem permissão para criar usuários' }, { status: 403 })
    }

    // ── 3. Se não for superadmin, só pode criar usuário na PRÓPRIA empresa ──
    const empresaAlvo = me.role === 'superadmin' ? (company_id ?? me.company_id) : me.company_id
    if (me.role !== 'superadmin' && company_id && company_id !== me.company_id) {
      return NextResponse.json({ error: 'Você só pode criar usuários da sua própria empresa' }, { status: 403 })
    }

    const cleanUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
    const email = `${cleanUsername}@industrial8-internal.com`

    // Cria o usuário já confirmado, sem disparar e-mail nenhum
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // já confirma automaticamente — sem e-mail
      user_metadata: { display_name, role: role || 'operator', company_id: empresaAlvo }
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
        display_name, role: role || 'operator', company_id: empresaAlvo, shift, sector, code
      }).eq('id', data.user.id)
    }

    return NextResponse.json({ success: true, user_id: data.user?.id, username: cleanUsername })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro desconhecido' }, { status: 500 })
  }
}
