-- Drop the permissive policy that allows viewing all contacts
DROP POLICY IF EXISTS "Users can view all contacts" ON "public"."users";

-- Create a new restrictive policy that blocks direct table access for authenticated users
-- This will work together with the existing "Users can view own profile" policy
CREATE POLICY "Users cannot directly access users table"
ON "public"."users"
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (false);

-- Create RPC function for safe user search by EMAIL ONLY
CREATE OR REPLACE FUNCTION public.search_users(p_query text)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  image text,
  last_seen timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow searches with proper query length
  IF length(trim(p_query)) < 2 THEN
    RETURN;
  END IF;
  
  -- Return query result - EMAIL SEARCH ONLY
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.email,
    u.image,
    u.last_seen
  FROM public.users u
  WHERE 
    u.id != auth.uid()
    AND u.email ILIKE '%' || trim(p_query) || '%'  -- EMAIL ONLY
  LIMIT 10;
END;
$function$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
