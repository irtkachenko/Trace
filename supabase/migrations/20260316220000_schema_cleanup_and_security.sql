-- Technical Audit: Schema Cleanup & Security Hardening
-- This migration cleans up redundant policies/functions and enforces security

do $$ 
begin
    -- 1) Cleanup redundant policies on chats
    drop policy if exists "Users can view their own chats" on public.chats;
    drop policy if exists "Users can delete their own chats" on public.chats;
    drop policy if exists "Users can insert their own chats" on public.chats;
    
    -- 2) Cleanup redundant policies on messages
    drop policy if exists "Users can delete their own messages" on public.messages;
    drop policy if exists "Users can view messages in their chats" on public.messages;
    drop policy if exists "Users can insert messages in their chats" on public.messages;
    drop policy if exists "Allow update for owners" on public.messages;

    -- 3) Remove old/conflicting functions
    -- There were two versions of check_action_limit in the dump
    drop function if exists public.check_action_limit(uuid, text, integer, integer);
    
    -- 4) Remove other obsolete functions from the dump that look like duplicates or old logic
    drop function if exists public.check_message_rate();
    drop function if exists public.limit_chat_creation();
    drop function if exists public.limit_daily_messages();
end $$;

-- 5) Harden rpc_send_message (Membership check + Security)
create or replace function public.rpc_send_message(
    p_chat_id uuid,
    p_content text,
    p_reply_to_id uuid default null,
    p_attachments jsonb default '[]'::jsonb,
    p_client_id uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
    new_message public.messages;
    v_is_participant boolean;
begin
    -- SECURITY: Check membership
    select exists (
        select 1 from public.chats
        where id = p_chat_id
          and (user_id = auth.uid() or recipient_id = auth.uid())
    ) into v_is_participant;

    if not v_is_participant then
        raise exception 'Forbidden: You are not a participant in this chat' using errcode = '42501';
    end if;

    -- RATE LIMIT: Enforce
    perform public.check_action_limit('message_send');

    insert into public.messages(chat_id, sender_id, content, reply_to_id, attachments, client_id)
    values (p_chat_id, auth.uid(), p_content, p_reply_to_id, p_attachments, p_client_id)
    returning * into new_message;

    return new_message;
end;
$$;

-- 6) Harden rpc_create_chat (Existence + Logical checks)
create or replace function public.rpc_create_chat(
    p_recipient_id uuid
)
returns public.chats
language plpgsql
security definer
set search_path = public
as $$
declare
    new_chat public.chats;
begin
    if p_recipient_id = auth.uid() then
        raise exception 'Bad Request: Cannot create a chat with yourself' using errcode = 'P0001';
    end if;

    if not exists (select 1 from public.users where id = p_recipient_id) then
        raise exception 'Not Found: Recipient user does not exist' using errcode = 'P0001';
    end if;

    perform public.check_action_limit('chat_create');

    insert into public.chats(user_id, recipient_id, title)
    values (auth.uid(), p_recipient_id, 'Chat')
    returning * into new_chat;

    return new_chat;
end;
$$;

-- 7) Fix update_last_seen
create or replace function public.update_last_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.users
    set last_seen = now(),
        is_online = true,
        status = 'online'
    where id = auth.uid();
end;
$$;

-- 8) Add Cleanup Task for Rate Limits
create or replace function public.cleanup_rate_limits()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.rate_limits
    where window_start < now() - interval '24 hours';
end;
$$;

-- Permissions
grant execute on function public.rpc_send_message(uuid, text, uuid, jsonb, uuid) to authenticated;
grant execute on function public.rpc_create_chat(uuid) to authenticated;
grant execute on function public.update_last_seen() to authenticated;
grant execute on function public.cleanup_rate_limits() to authenticated;
grant execute on function public.cleanup_rate_limits() to service_role;
