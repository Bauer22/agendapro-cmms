# 🚀 AgendaPro CMMS — Guia de Deploy

## Passo 1 — Criar conta Supabase (gratuito)

1. Acesse **https://supabase.com** → clique em **Start your project**
2. Crie uma conta com Google ou e-mail
3. Clique em **New Project**
4. Preencha:
   - **Name:** agendapro-cmms
   - **Database Password:** (anote, vai precisar)
   - **Region:** South America (São Paulo)
5. Clique em **Create new project** e aguarde ~2 minutos

---

## Passo 2 — Configurar o banco de dados

1. No painel Supabase, clique em **SQL Editor** (menu lateral)
2. Clique em **New query**
3. Cole todo o conteúdo do arquivo `supabase-schema.sql`
4. Clique em **Run** (▶️) 
5. Deve aparecer: `Schema instalado com sucesso! ✅`

---

## Passo 3 — Pegar as credenciais do Supabase

1. No menu lateral, clique em **Settings → API**
2. Copie os dois valores:
   - **Project URL** → começa com `https://xxxx.supabase.co`
   - **anon / public key** → chave longa

---

## Passo 4 — Criar conta no Vercel

1. Acesse **https://vercel.com** → clique em **Sign Up**
2. Crie conta com GitHub (recomendado) ou e-mail

---

## Passo 5 — Criar repositório GitHub

1. Acesse **https://github.com** → **New repository**
2. Nome: `agendapro-cmms` → Public ou Private → **Create repository**
3. No terminal, dentro da pasta do projeto:

```bash
cd agendapro-cmms
git init
git add .
git commit -m "AgendaPro CMMS v3"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/agendapro-cmms.git
git push -u origin main
```

---

## Passo 6 — Deploy no Vercel

1. No Vercel, clique em **New Project**
2. Selecione o repositório `agendapro-cmms`
3. Na tela de configuração, expanda **Environment Variables** e adicione:

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` |

4. Clique em **Deploy** e aguarde ~3 minutos
5. Sua URL será algo como: `https://agendapro-cmms.vercel.app`

---

## Passo 7 — Criar o primeiro usuário (Administrador)

1. No Supabase → **Authentication → Users → Add user**
2. Preencha e-mail e senha
3. O **primeiro usuário criado vira Administrador automaticamente**
4. Acesse o sistema e faça login

---

## Passo 8 — Instalar no celular como app (PWA)

### iPhone (iOS)
1. Abra a URL no **Safari**
2. Toque em **Compartilhar** (ícone quadrado com seta)
3. Toque em **"Adicionar à Tela de Início"**
4. Toque em **Adicionar** ✅

### Android
1. Abra no **Chrome**
2. Menu **⋮** → **"Adicionar à tela inicial"**
3. Clique em **Instalar** ✅

---

## Funcionalidades do Sistema

| Módulo | Descrição |
|--------|-----------|
| 🏠 Dashboard | KPIs, alertas, OS do dia, tarefas, manutenções |
| 📋 Ordens de Serviço | Kanban (Aberta → Andamento → Concluída) |
| ⚙️ Máquinas | CRUD com componentes, plano MP, horímetro |
| 🔧 Manutenção | Registro corretiva/preventiva com resultado |
| 📝 MP (Preventiva) | Checklist por período gerado do plano da máquina |
| ✅ Tarefas | Calendário por dia + prioridade + responsável |
| 📦 Peças | Estoque com alerta de mínimo |
| 🏭 Fornecedores | Contatos com link WhatsApp e telefone |
| 📊 Relatórios | PDF (OS, Manutenção, Peças) + Backup JSON |
| 👥 Usuários | 4 perfis: Admin, Supervisor, Operador, Consulta |
| ⚙️ Config | Empresa + perfil pessoal |

## Máquinas pré-cadastradas (seed automático)
- TOR-001 — Torno Laminador
- SEC-001 — Secador
- PRE-001 — Prensa
- CAL-001 — Caldeira
- EMP-001 — Empilhadeira
- CAR-001 — Carregadeira
- COM-001 — Compressor

---

## Suporte
- Documentação Supabase: https://supabase.com/docs
- Documentação Vercel: https://vercel.com/docs
- Stack: **Next.js 14 + Supabase + Vercel + PWA**
