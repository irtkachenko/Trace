-- Add updated_at column to chats table
-- This column is referenced by the trigger in 20260315120000_messages_updated_at_trigger.sql

alter table public.chats 
add column updated_at timestamp with time zone default now();

-- Create index for better performance on ordering
create index idx_chats_updated_at on public.chats(updated_at desc);
