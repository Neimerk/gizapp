# HANDOFF — Transferência para o Claude Code

Repaginação de frontend/UX do **BrasUX Shopping (gizapp)**: categorização por
departamentos, navegação unificada e sistema de design com tokens + dark mode.
Os 15 arquivos abaixo já foram escritos e **validados** (build + lint + typecheck
passam limpos). Este documento diz o que fazer para aplicá-los e continuar.

## Os 15 arquivos (já neste pacote, em `src/…` espelhando o repo)

**Novos (8):**
- `src/data/taxonomy.ts`
- `src/data/navigation.ts`
- `src/components/ui/CategoryTile.tsx`
- `src/components/ui/DepartmentCard.tsx`
- `src/components/home/SectionHeader.tsx`
- `src/components/home/FlashSale.tsx`
- `src/components/home/JoinCtaSection.tsx`
- `src/components/home/BrasuxSolutionsSection.tsx`  ← inerte (não importado por ninguém ainda)

**Substituem existentes (7):**
- `src/index.css`
- `src/pages/HomePage.tsx`
- `src/pages/CategoriesPage.tsx`
- `src/pages/CategoryPage.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/BottomNavigation.tsx`
- `src/components/store/StoreCard.tsx`

> São interdependentes (HomePage importa `home/*`; AppLayout importa
> `navigation.ts`; CategoriesPage importa `taxonomy.ts`+`CategoryTile`).
> Aplicar TODOS de uma vez, num commit só. Aplicar só parte quebra o build.

## Passos

1. **Aplicar os arquivos.** Copie a árvore `src/` deste pacote por cima da
   `src/` do repo, mantendo a estrutura de pastas. Coloque o `CLAUDE.md` na raiz
   do repo.

2. **Instalar e validar (portão obrigatório):**
   ```bash
   npm install
   npm run build      # tsc -b && vite build — DEVE passar limpo
   npm run lint       # eslint . — 0 erros
   ```
   Se `npm run build` acusar erro, conserte antes de seguir (provável causa:
   import órfão por `noUnusedLocals`).

3. **Validar no ar:**
   ```bash
   npm run dev
   ```
   Checklist:
   - [ ] "Categorias" no nav (desktop E mobile) → leva aos 6 departamentos
   - [ ] Favoritos (coração) no header funciona no mobile
   - [ ] `/categorias` agrupada por departamento; cada categoria abre só as lojas certas
   - [ ] Home sem as promos BrasUX; grade de departamentos no lugar da lista plana
   - [ ] Botão de tema (dark mode): shell, cards de loja e telas de categoria trocam de tema de verdade

4. **Continuar a migração de tokens** conforme `CLAUDE.md` → seção "Convenção de
   migração hex → token". Próximo lote sugerido: `Footer`, `ProductPage`,
   `StorePage`. Mesma receita mecânica + as regras invioláveis (ilha translúcida,
   marca literal, ponte legada).

## Estado known-good (já corrigido nesta sessão)
- Imports órfãos `useState`/`useEffect` na `HomePage` (sobraram da extração do
  FlashSale) → removidos. `tsc -b` agora passa.
- Diretiva `eslint-disable` sem uso no `AppLayout` → removida.
- `tsc -b`, `vite build` e `eslint` nos 15 arquivos: **limpos**.

## Se algo no dark mode parecer errado
Provavelmente é um componente AINDA não migrado puxando a ponte legada do
`index.css` — esperado. Migre esse componente pela tabela do `CLAUDE.md`. NÃO
adicione hex novo na ponte legada.
