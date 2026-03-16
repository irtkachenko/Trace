-- Security hardening for RPC functions based on Technical Audit
-- Date: 2026-03-16

-- 1) Harden rpc_send_message: Add explicit participant check
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
    -- Check if the current user is a participant in the chat
    select exists (
        select 1 from public.chats
        where id = p_chat_id
          and (user_id = auth.uid() or recipient_id = auth.uid())
    ) into v_is_participant;

    if not v_is_participant then
        raise exception 'Forbidden: You are not a participant in this chat' using errcode = '42501';
    end if;

    -- Enforce rate limits
    perform public.check_action_limit('message_send');

    insert into public.messages(chat_id, sender_id, content, reply_to_id, attachments, client_id)
    values (p_chat_id, auth.uid(), p_content, p_reply_to_id, p_attachments, p_client_id)
    returning * into new_message;

    return new_message;
end;
$$;

-- 2) Harden rpc_create_chat: Add existence and logical checks
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
    -- Logical checks
    if p_recipient_id = auth.uid() then
        raise exception 'Bad Request: Cannot create a chat with yourself' using errcode = 'P0001';
    end if;

    -- Check if recipient exists
    if not exists (select 1 from public.users where id = p_recipient_id) then
        raise exception 'Not Found: Recipient user does not exist' using errcode = 'P0001';
    end if;

    -- Enforce rate limits
    perform public.check_action_limit('chat_create');

    -- Insert new chat
    -- Note: UI might benefit from checking if chat exists already, 
    -- but we let the DB handle it or create duplicates if not constrained.
    insert into public.chats(user_id, recipient_id, title)
    values (auth.uid(), p_recipient_id, 'Chat')
    returning * into new_chat;

    return new_chat;
end;
$$;

-- 3) Ensure update_last_seen is robust
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

-- 4) Rate limit cleanup task (GC)
create or replace function public.cleanup_rate_limits()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Remove limits older than 24 hours to keep the table small
    delete from public.rate_limits
    where window_start < now() - interval '24 hours';
end;
$$;

-- Grant permissions explicitly
grant execute on function public.rpc_send_message(uuid, text, uuid, jsonb, uuid) to authenticated;
grant execute on function public.rpc_create_chat(uuid) to authenticated;
grant execute on function public.update_last_seen() to authenticated;
grant execute on function public.cleanup_rate_limits() to authenticated;
 grant execute on function public.cleanup_rate_limits() to service_role;
