# 🏢 Industrial8 — Guia Multi-Tenant

## Como funciona

```
Você (Super Admin)
      ↓
  agendapro.com.br
      ↓ (RLS filtra por company_id)
  ┌─────────────────┬─────────────────┐
  │  Laminadora ABC │  Madeireira XYZ │
  │  (dados A)      │  (dados B)      │
  └─────────────────┴─────────────────┘
```

Cada empresa vê APENAS seus próprios dados.
O Super Admin vê tudo e gerencia as empresas.

---

## Passo 1 — Configurar o banco

Execute o `supabase-schema-multitenant.sql` no Supabase SQL Editor.

---

## Passo 2 — Criar sua conta Super Admin

1. Supabase → Authentication → Users → Add user
   - E-mail: seu@email.com
   - Senha: sua senha

2. Supabase → Table Editor → profiles
   - Edite seu perfil
   - Mude `role` para `superadmin`
   - Deixe `company_id` como NULL (super admin não pertence a empresa)

---

## Passo 3 — Cadastrar um cliente

1. Faça login no sistema como Super Admin
2. Vá na aba **Super Admin**
3. Clique em **+ Nova Empresa**
4. Preencha: nome, plano, data de expiração
5. Clique em **Salvar**

---

## Passo 4 — Criar usuário para o cliente

### Opção A — Convite pelo sistema
1. Super Admin → **+ Convidar**
2. Preencha e-mail, nome, empresa e perfil
3. O cliente recebe e-mail de convite e cria a senha

### Opção B — Manual no Supabase
1. Supabase → Auth → Users → Invite user
2. No e-mail convite, adicione metadata:
```json
{
  "company_id": "UUID-DA-EMPRESA",
  "role": "admin",
  "display_name": "Nome do Cliente"
}
```

---

## Passo 5 — O cliente acessa o sistema

- URL: **agendapro.vercel.app** (mesma URL para todos)
- Faz login com o e-mail e senha criados
- Vê APENAS os dados da empresa dele
- Pode cadastrar máquinas, criar OS, registrar manutenções

---

## Planos e preços sugeridos

| Plano | Preço/mês | Usuários | Funcionalidades |
|-------|-----------|----------|-----------------|
| Trial | Grátis | 2 | 30 dias, todas as funções |
| Basic | R$ 297 | 5 | Todas as funções |
| Pro | R$ 550 | 15 | Todas + suporte prioritário |
| Enterprise | R$ 1.200 | Ilimitado | Tudo + personalização |

---

## ⚠️ Migrar dados existentes

Se você já tem dados no sistema atual, execute este SQL para
associar os dados existentes à sua empresa:

```sql
-- 1. Pegar o ID da sua empresa
select id, name from companies;

-- 2. Migrar todos os dados (substitua SEU_COMPANY_ID)
update machines set company_id = 'SEU_COMPANY_ID' where company_id is null;
update work_orders set company_id = 'SEU_COMPANY_ID' where company_id is null;
update maintenance set company_id = 'SEU_COMPANY_ID' where company_id is null;
update pm_reports set company_id = 'SEU_COMPANY_ID' where company_id is null;
update tasks set company_id = 'SEU_COMPANY_ID' where company_id is null;
update parts set company_id = 'SEU_COMPANY_ID' where company_id is null;
update suppliers set company_id = 'SEU_COMPANY_ID' where company_id is null;
update downtime_records set company_id = 'SEU_COMPANY_ID' where company_id is null;
```
