# BrasUX Shopping (gizapp) — Contexto do projeto

Marketplace/delivery multi-lojista (estilo iFood/Rappi) que roda em
`brasux.com.br` / `shopping.brasux.com.br`. SPA com 4 papéis: comprador,
lojista, entregador, admin.

## Stack
- **Frontend:** React 19 + TypeScript + **Vite 8**
- **Estilo:** **Tailwind CSS v4** via `@tailwindcss/vite` (SEM `tailwind.config` — a config vive no CSS, em `src/index.css`, com `@theme`)
- **Estado:** Zustand · **Dados:** TanStack React Query · **Rotas:** react-router-dom
- **Mapas:** mapbox-gl/react-map-gl · **Realtime:** @microsoft/signalr · **Ícones:** lucide-react
- **Backend (não neste repo):** Supabase (Postgres/Auth/Storage/Edge Functions Deno) + API .NET (`GizApp.ImageAPI`, imagens + SignalR) + Asaas (pagamentos)

## Comandos
- `npm run dev` — Vite dev server
- `npm run build` — **`tsc -b && vite build`** (este é o portão de validação real)
- `npm run lint` — `eslint .`

> ⚠️ O projeto tem `noUnusedLocals`/`noUnusedParameters` ligados: **import ou
> variável não usada é ERRO de build**, não warning. Sempre rode `npm run build`
> (ou `npx tsc -b`) antes de considerar uma mudança pronta. O esbuild sozinho
> NÃO pega isso.

## Decisões de arquitetura (NÃO reverter)

1. **Taxonomia = fonte única.** `src/data/taxonomy.ts` agrupa as 33 categorias
   planas de `categories.ts` em **6 departamentos** por intenção (Comida,
   Mercado, Saúde & Beleza, Casa & Construção, Variedades, Serviços & Cursos).
   Home, `/categorias`, `CategoryPage`, Footer e cadastro de loja devem consumir
   ESTE arquivo. Cada departamento tem cor de acento estável (nada de cor
   aleatória por índice).

2. **Navegação = fonte única.** `src/data/navigation.ts` define o nav primário
   uma vez (`customerNav`/`courierNav` + `getPrimaryNav(role)`), consumido por
   `AppLayout` (desktop) e `BottomNavigation` (mobile). São IGUAIS de propósito:
   Início · Categorias · Lojas · Pedidos · Conta. Busca/Carrinho/Favoritos vivem
   no header, não no nav.

3. **Design tokens = `src/index.css`.** Tailwind v4 `@theme inline` + variáveis
   `:root` (claro) / `.dark` (escuro). As utilities de token (`bg-surface`,
   `text-content`, `border-line`, `bg-brand`…) resolvem para `var(--…)` em
   runtime, então alternar `.dark` re-tematiza tudo que usa token.
   Match exato loja↔categoria em `CategoryPage` (sem substring fuzzy).

4. **Promos de produtos BrasUX** (SimulENEM, NotaOn, PDV, Landing) ficam FORA da
   home de shopping, isoladas em `components/home/BrasuxSolutionsSection.tsx`
   (componente inerte, não montado). Destino: rota `/solucoes` ou a vitrine.

## Convenção de migração hex → token (EM ANDAMENTO)

Substituir hex literais pelos utilitários de token, surface por surface:

| de | para |
|---|---|
| `bg-white` (standalone) | `bg-surface` |
| `bg-[#f7f9fc]` | `bg-canvas` |
| `bg-[#f8fafc]` | `bg-subtle` |
| `bg-[#f1f5f9]` | `bg-subtle-2` |
| `bg-[#94a3b8]` | `bg-faint` |
| `text-[#0f172a]` | `text-content` |
| `text-[#64748b]` | `text-muted` |
| `text-[#94a3b8]` | `text-faint` |
| `text-[#475569]` | `text-muted` |
| `border-[#e2e8f0]` | `border-line` |
| `border-[#e8eaf0]` | `border-line-subtle` |
| `border-[#f1f5f9]` | `border-subtle-2` |

**Regras invioláveis da migração:**
- **NÃO migrar `bg-white/N` translúcido** (`bg-white/8`, `/10`, `/20`…): são
  overlays de "ilhas sempre-escuras" (hero, CTAs em gradiente, banners). Ficam
  literais. Use guarda: só troca `bg-white` quando NÃO seguido de `/`.
- **NÃO migrar cores de marca/acento** (`#16a34a`, `#002776`, `#1351b4`,
  `#4ade80`, `#dc2626`, `#7c3aed`, `#e11d48`…): vêm pareadas com gradientes
  inline. Entram num pass próprio, depois.
- **NÃO migrar `bg-[#0f172a]`**: é fundo dark intencional (chips/botões), não
  superfície temável. Fica literal.
- **Ponte legada** (`html.dark .bg-[#hex] {…}` no fim do `index.css`): mantém o
  dark mode dos componentes ainda NÃO migrados. Conforme um hex literal some do
  código inteiro, a linha correspondente da ponte pode ser removida. Quando o
  último sumir, a ponte inteira cai.

## Estado da migração de tokens
- **Migrados:** `index.css`, `taxonomy.ts`, `navigation.ts`, `CategoryTile`,
  `DepartmentCard`, `AppLayout`, `BottomNavigation`, `StoreCard`, `HomePage`,
  `CategoriesPage`, `CategoryPage`, `home/SectionHeader`, `home/FlashSale`,
  `home/JoinCtaSection`.
- **Faltam (mesma receita):** `Footer`, `ProductPage`, `StorePage`,
  `CartPage`/`CheckoutPage`, `AccountPage` e os demais `components/ui/*`.

## Regras de trabalho
- Entregar **arquivos completos drop-in**, não fragmentos.
- Mudar só o escopo pedido; não tocar lógica fora do alvo.
- Validar SEMPRE com `npm run build` (`tsc -b`) **e** `npm run lint` antes de dar como pronto.
