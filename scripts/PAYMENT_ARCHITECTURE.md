# BrasUX — Arquitetura de Pagamentos

## Diagrama do Fluxo Financeiro

```
COMPRADOR
  │
  ├─ [1] Cria pedido (orders — status=0, payment_status=PENDING)
  │
  ├─ [2] Acessa checkout → asaas-create-charge (Edge Function)
  │       └─ Gera PIX/cartão/boleto no Asaas
  │       └─ Persiste em payments (status=pending)
  │
  ├─ [3] Paga
  │
  │             ASAAS WEBHOOK ──▶ asaas-webhook (Edge Function)
  │                                 │
  │                                 ├─ PAYMENT_CONFIRMED:
  │                                 │   ├─ orders: status=1, payment_status=CONFIRMED
  │                                 │   ├─ payment_transactions: insere evento
  │                                 │   ├─ execute-split (Edge Function interna)
  │                                 │   │   └─ execute_order_split() Postgres fn
  │                                 │   │       ├─ Cria wallet_transactions HELD:
  │                                 │   │       │   ├─ vendor_wallet ← vendor_net
  │                                 │   │       │   └─ courier_wallet ← delivery_fee
  │                                 │   │       └─ Cria wallet_transaction AVAILABLE:
  │                                 │   │           └─ platform_wallet ← comissão + service_fee
  │                                 │   └─ earn_points_on_payment()
  │                                 │
  │                                 └─ PAYMENT_DECLINED / REFUNDED → atualiza status
  │
VENDEDOR                          ENTREGADOR
  │                                 │
  ├─ [4] Aceita pedido (status=2)   │
  │                                 ├─ [5] Aceita entrega (deliveries)
  │                                 │
  ├─ [6] Prepara (status=3)         ├─ [7] Coleta (PICKED_UP, status=3)
  │                                 │
  │                                 ├─ [8] Entrega (DELIVERED, status=4)
  │                                 │       └─ release-balance (Edge Function interna)
  │                                 │           └─ release_balance_after_delivery()
  │                                 │               └─ wallet_transactions HELD → AVAILABLE
  │                                 │                   (vendor + courier)
  │
  └─ [9] Solicita saque (create-withdrawal)
          └─ request_withdrawal() Postgres fn
              ├─ Valida saldo disponível
              ├─ Insere withdrawals (status=pending)
              └─ Insere wallet_transaction débito (direction=out)

ADMIN
  └─ process-withdrawal → Asaas PIX transfer → withdrawals.status=paid
  └─ refund-payment → Asaas refund + reverse_split_on_refund()
```

## Tabelas e Responsabilidades

| Tabela | Propósito |
|--------|-----------|
| `subscriptions` | Plano do vendedor (comissão por pedido) |
| `payments` | Cobrança do gateway (1 por pedido) |
| `payment_transactions` | Log de eventos do webhook (idempotente) |
| `split_rules` | Regra de divisão por pedido (auditoria) |
| `wallets` | Carteiras (vendor/courier/platform) |
| `wallet_transactions` | Ledger contábil — nunca deletar |
| `withdrawals` | Solicitações de saque com rastreabilidade |
| `refunds` | Estornos com histórico completo |

## Modelo de Ledger (wallet_transactions)

Saldo nunca é armazenado diretamente. Calculado por:

```sql
-- Disponível para saque
SELECT SUM(CASE WHEN status='available' AND direction='in' THEN amount
                WHEN status='completed' AND direction='out' THEN -amount
                ELSE 0 END)
FROM wallet_transactions WHERE wallet_id = $1;

-- Retido (aguardando entrega)
SELECT SUM(amount) FROM wallet_transactions
WHERE wallet_id = $1 AND status='held' AND direction='in';
```

## Planos de Assinatura

| Plano | Mensalidade | Comissão |
|-------|-------------|----------|
| Gratuito | R$ 0,00 | 8% |
| Start | R$ 49,90 | 5% |
| Pro | R$ 99,90 | 3% |
| Premium | R$ 199,90 | 2% |
| White Label | R$ 299,90+ | 0% |

## Exemplo de Split

```
Comprador paga: R$ 114,99
  └─ Produtos: R$ 100,00
  └─ Entrega: R$ 12,00
  └─ Taxa operacional: R$ 2,99

Vendedor (plano Start, 5%):
  └─ R$ 100,00 - R$ 5,00 comissão = R$ 95,00 HELD

Entregador:
  └─ R$ 12,00 HELD

Plataforma BrasUX:
  └─ R$ 5,00 comissão + R$ 2,99 service_fee = R$ 7,99 AVAILABLE

Após DELIVERED: HELD → AVAILABLE (vendor + courier)
```

## Edge Functions

| Função | Trigger | Auth |
|--------|---------|------|
| `asaas-create-charge` | Frontend (checkout) | JWT |
| `asaas-webhook` | Asaas (token) | Webhook token |
| `execute-split` | asaas-webhook interno | x-internal-key |
| `release-balance` | updateDeliveryStatus | x-internal-key |
| `create-withdrawal` | Frontend (lojista/entregador) | JWT |
| `process-withdrawal` | Admin / cron | x-internal-key |
| `refund-payment` | Admin | JWT Admin |

## Plano de Implementação em Etapas

### Etapa 1 — Banco (rodar agora) ✅
- Executar `scripts/supabase-migration-008-payment-infra.sql`
- Verifica: tabelas, funções Postgres, RLS

### Etapa 2 — Edge Functions (deploy)
```bash
supabase functions deploy execute-split
supabase functions deploy release-balance
supabase functions deploy create-withdrawal
supabase functions deploy process-withdrawal
supabase functions deploy refund-payment
supabase functions deploy asaas-webhook  # atualizado
```

### Etapa 3 — Variáveis de ambiente
```bash
supabase secrets set INTERNAL_FUNCTION_KEY=<uuid-secreto-gerado>
supabase secrets set ASAAS_API_KEY=<sua-chave-asaas>
supabase secrets set ASAAS_WEBHOOK_TOKEN=<token-asaas-webhook>
```

### Etapa 4 — Frontend (já feito) ✅
- `src/types/payment.ts` — tipos TypeScript
- `src/services/paymentApi.ts` — API layer
- `src/hooks/useWallet.ts` — hook de carteira
- `src/hooks/useWithdrawal.ts` — hook de saques
- `SellerPage.tsx` — FinanceiroTab reescrita

### Etapa 5 — Próximos passos
- [ ] Dashboard Admin com ledger da plataforma
- [ ] Gráfico de receita por período (SellerPage)
- [ ] Notificação push quando saldo liberado
- [ ] Cobrança recorrente de assinaturas (cron)
- [ ] CourierPage: seção financeira com carteira v2
- [ ] Relatório de conciliação financeira (admin)
- [ ] Gateway alternativo: Mercado Pago / Pagar.me

## Segurança

- **Idempotência**: payment_transactions.gateway_event_id UNIQUE; split_rules com check de already_executed
- **Anti race condition**: request_withdrawal() usa transação Postgres atômica
- **Valores nunca do frontend**: split calculado server-side; ledger é append-only
- **RLS**: todas as tabelas com policies por role
- **Webhook**: validado por token Asaas antes de processar
- **Internal functions**: protegidas por x-internal-key (não expostas ao browser)
