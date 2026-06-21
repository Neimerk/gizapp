# BrasUX — Supabase Edge Functions

## Deploy

```bash
# 1. Instale o Supabase CLI (se não tiver)
npm install -g supabase

# 2. Faça login e link ao projeto
supabase login
supabase link --project-ref <SEU_PROJECT_REF>

# 3. Configure os secrets (uma vez só)
supabase secrets set ASAAS_API_KEY=<sua_chave_sandbox>
supabase secrets set ASAAS_API_URL=https://sandbox.asaas.com/api/v3
supabase secrets set ASAAS_WEBHOOK_TOKEN=<token_que_voce_criar>

# Para produção, troque ASAAS_API_URL:
# supabase secrets set ASAAS_API_URL=https://api.asaas.com/api/v3

# 4. Deploy das functions
supabase functions deploy asaas-create-charge
supabase functions deploy asaas-webhook
```

## Configurar webhook no Asaas

1. Acesse https://sandbox.asaas.com → Configurações → Integrações → Webhooks
2. URL: `https://<seu-projeto>.supabase.co/functions/v1/asaas-webhook`
3. Token de autenticação: o mesmo valor de ASAAS_WEBHOOK_TOKEN
4. Eventos a ativar:
   - PAYMENT_CONFIRMED
   - PAYMENT_RECEIVED
   - PAYMENT_DECLINED
   - PAYMENT_REFUNDED

## Testar localmente

```bash
supabase start
supabase functions serve asaas-create-charge --env-file .env.local
```

Crie `.env.local` com:
```
ASAAS_API_KEY=seu_token_sandbox
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
ASAAS_WEBHOOK_TOKEN=qualquer_string_secreta
```

## Setup de emails (Resend)

```bash
# 1. Crie uma conta gratuita em resend.com (3.000 emails/mês free)
# 2. Crie uma API key em resend.com/api-keys
# 3. Configure o domínio de envio (ou use o domínio de sandbox do Resend)

supabase secrets set RESEND_API_KEY=re_xxxx
supabase secrets set EMAIL_FROM="BrasUX Shopping <noreply@seudominio.com.br>"
supabase secrets set APP_URL=https://brasux.com.br

# 4. Deploy da nova função
supabase functions deploy send-order-emails
```

> **Sandbox Resend**: sem configurar domínio, os emails só chegam no endereço verificado na conta.
> Para produção, adicione e verifique o seu domínio em resend.com/domains.

## Emails disparados automaticamente

| Trigger | Destinatário | Assunto |
|---|---|---|
| Pedido criado (checkout) | Comprador | ✅ Pedido #XXXXX recebido |
| Pedido criado (checkout) | Lojista | 🛒 Novo pedido #XXXXX |
| Pix/Boleto confirmado (webhook Asaas) | Comprador | 💰 Pagamento confirmado |

## Cartões de teste (sandbox Asaas)

| Bandeira | Número           | CVV | Validade | CPF           |
|----------|------------------|-----|----------|---------------|
| Visa     | 4111111111111111 | 123 | 12/2030  | qualquer CPF  |
| Visa     | 4916661233667891 | 737 | 12/2024  | Qualquer CPF  |

## Arquitetura do split (fase 2)

Quando sellers tiverem subconta Asaas:
1. Seller cadastra dados bancários em `/minha-loja`
2. Asaas cria subconta e retorna `walletId`
3. Salvar `asaas_wallet_id` em `stores.asaas_wallet_id`
4. Descomente o `split` no payload de `asaas-create-charge/index.ts`

```typescript
split: [{ walletId: sellerWalletId, percentualValue: 93 }]
// 93% para o seller, 7% fica na conta principal BrasUX
```
