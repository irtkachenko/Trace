-- Fix the DELETE policy for messages to ensure it works correctly
-- The issue was likely with the UUID comparison or the complex EXISTS clause

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

CREATE POLICY "Users can delete their own messages" ON public.messages
FOR DELETE USING (
    sender_id = auth.uid()
);

-- Also ensure RLS is enabled on the messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
