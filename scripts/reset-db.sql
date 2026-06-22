-- ============================================================
-- BrasUX — Reset de banco de dados para produção
-- Executa no Supabase: Dashboard → SQL Editor → New query
--
-- O que este script FAZ:
--   ✓ Remove todos os pedidos e itens de pedido
--   ✓ Remove todos os produtos e vínculos loja-produto
--   ✓ Remove todas as lojas (incluindo as de teste/seed)
--   ✓ Remove usuários Customer e Seller de teste
--
-- O que este script NÃO FAZ:
--   ✗ Não remove usuários com Role = 'Admin'
--   ✗ Não altera a estrutura do banco (tabelas, índices, migrations)
-- ============================================================

BEGIN;

-- 1. Itens de pedido primeiro (FK → Orders e StoreProducts)
DELETE FROM "OrderItems";

-- 2. Pedidos (FK → Stores e AppUsers)
DELETE FROM "Orders";

-- 3. Produtos por loja (FK → Stores e Products, CASCADE de Stores)
DELETE FROM "StoreProducts";

-- 4. Catálogo de produtos
DELETE FROM "Products";

-- 5. Usuários de teste — mantém apenas Admins
DELETE FROM "AppUsers"
WHERE "Role" != 'Admin';

-- 6. Lojas — todas eram dados de teste
DELETE FROM "Stores";

COMMIT;

-- ============================================================
-- Verificação — rode após o COMMIT para confirmar zeros:
-- ============================================================
-- SELECT
--   (SELECT COUNT(*) FROM "OrderItems")   AS order_items,
--   (SELECT COUNT(*) FROM "Orders")        AS orders,
--   (SELECT COUNT(*) FROM "StoreProducts") AS store_products,
--   (SELECT COUNT(*) FROM "Products")      AS products,
--   (SELECT COUNT(*) FROM "Stores")        AS stores,
--   (SELECT COUNT(*) FROM "AppUsers")      AS admins_remaining;
