-- chat_messages: suporte a conversas diretas cliente-loja (sem order_id)
-- order_id passa a ser nullable; store_id opcional para chats sem pedido específico.

alter table public.chat_messages
  alter column order_id drop not null,
  add column if not exists store_id uuid;

-- Garante contexto: ao menos um de order_id ou store_id deve estar preenchido
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_messages_context_check' and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_context_check
      check (order_id is not null or store_id is not null);
  end if;
end $$;

create index if not exists chat_messages_store_id_idx
  on public.chat_messages (store_id, created_at)
  where store_id is not null;

-- Clientes autenticados podem inserir em conversas diretas com loja
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chat_messages' and policyname = 'chat_store_customer_insert'
  ) then
    create policy "chat_store_customer_insert"
      on public.chat_messages for insert
      with check (
        sender_id = auth.uid()
        and conversation_type = 'store_customer'
        and store_id is not null
      );
  end if;
end $$;

-- Lojistas podem ler e responder (store_id vinculado à loja que gerenciam)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chat_messages' and policyname = 'chat_store_vendor_all'
  ) then
    create policy "chat_store_vendor_all"
      on public.chat_messages for all
      using (
        conversation_type = 'store_customer'
        and exists (
          select 1 from public.stores s
          where s.id = chat_messages.store_id
            and s.owner_id = auth.uid()
        )
      )
      with check (
        sender_id = auth.uid()
        and conversation_type = 'store_customer'
        and exists (
          select 1 from public.stores s
          where s.id = chat_messages.store_id
            and s.owner_id = auth.uid()
        )
      );
  end if;
end $$;
