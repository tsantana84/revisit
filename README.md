# Revisit

Plataforma multi-tenant de fidelidade para restaurantes. Donos criam programas de pontos, gerentes operam o PDV, clientes acumulam pontos e resgatam recompensas.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16 (App Router, React 19) |
| Auth | Clerk |
| Banco de dados | Supabase (Postgres + RLS) |
| Estilo | Tailwind CSS 4 |
| Validação | Zod 4 |
| IA | OpenAI DALL-E (imagens dos cartões) |
| Gráficos | Recharts |
| Deploy | Vercel |

### Dependências

| Pacote | Uso |
|--------|-----|
| `@clerk/nextjs` | Autenticação, componentes de login, middleware |
| `@supabase/supabase-js` | Cliente do banco de dados |
| `next` | Framework (App Router, React 19) |
| `react` / `react-dom` | UI |
| `tailwindcss` | Estilos |
| `zod` | Validação de inputs |
| `recharts` | Gráficos no dashboard de analytics |
| `openai` | Geração de imagens de cartão (DALL-E) |
| `slugify` | Geração de slugs para URLs de tenant |
| `svix` | Verificação de webhooks do Clerk |

**Dev:** `typescript`, `vitest` (testes RLS)

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.local.example .env.local
# Preencher com as chaves do Supabase, Clerk e OpenAI

# 3. Subir Supabase local
npx supabase start
npx supabase db reset    # Aplica migrations + seed

# 4. Rodar
npm run dev              # http://localhost:3000
```

## Variáveis de ambiente

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET

# OpenAI
OPENAI_API_KEY
```

## Comandos

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Build de produção
npm run lint         # ESLint
npm run test:rls     # Testes de RLS (vitest)

npx vercel --prod    # Deploy produção
npx supabase db push # Enviar migrations pro Supabase remoto
```

## Estrutura

```
src/
├── app/
│   ├── (auth)/              # Login, signup, onboarding
│   ├── dashboard/
│   │   ├── owner/           # Painel do dono: config, equipe, analytics, clientes
│   │   ├── manager/         # Painel do gerente: PDV
│   │   └── admin/           # Super admin: visão geral do sistema
│   ├── api/                 # Webhooks, convites, geração de cartão
│   └── [slug]/              # Rotas públicas do tenant (cadastro de cliente)
├── lib/
│   ├── auth.ts              # Helpers de auth (getRevisitAuth, requireOwner, etc.)
│   ├── logger.ts            # Logger estruturado (JSON)
│   ├── actions/             # Server Actions por domínio
│   └── supabase/            # Clientes Supabase (RLS e service)
supabase/
├── migrations/              # 0001 a 0012
└── seed.sql
```

## Papéis

| Papel | Acesso | Como é criado |
|-------|--------|---------------|
| **owner** | Tudo do restaurante | Signup + onboarding |
| **manager** | PDV (vendas, consultas) | Convite pelo owner (Clerk Invitations) |
| **admin** | Visão cross-tenant | Manual via Supabase + Clerk |

Owner tem acesso ao dashboard de manager também.

## Fluxos principais

**Signup do owner:**
Clerk SignUp → `/onboarding` → cria restaurante + staff → define metadata no Clerk → dashboard

**Convite de manager:**
Owner convida via API → manager recebe email → signup no Clerk → webhook cria `restaurant_staff`

**Cadastro de cliente:**
`/:slug/register` → middleware resolve slug → service client cria customer + cartão

**Venda no PDV:**
Gerente busca cliente pelo cartão → registra venda → pontos calculados → verifica promoção de rank

## Auth — como funciona

Clerk controla toda a autenticação. Supabase é só banco de dados.

O JWT do Clerk inclui `restaurant_id` e `app_role` via JWT Template. O RLS do Supabase lê esses claims via `auth.jwt()`.

**Detalhe importante:** o JWT do Clerk tem cache de ~60s. Se o `publicMetadata` for atualizado no backend, a sessão atual pode não refletir imediatamente. Por isso, `getRevisitAuth()` tem um fallback que consulta o banco diretamente quando os claims da sessão estão vazios.

## Multi-tenancy

- Toda tabela tem `restaurant_id`
- RLS isola os dados por tenant
- Middleware injeta `x-restaurant-id` nas rotas públicas de tenant
- Números de cartão são únicos por restaurante, não globalmente

## Convenções

- Todo texto de UI e erros em **português (pt-BR)**
- Soft deletes com `deleted_at` — views `active_*` filtram
- Server Actions retornam discriminated unions (`step: 'success' | 'error'`)
- Dark theme com tokens `db-*` (ex: `db-card`, `db-input`, `db-text`)
- Auth pages com `auth-gradient-bg` e `auth-card`
- Path alias: `@/*` → `src/*`
- Logs estruturados: `domain.action` em snake_case
