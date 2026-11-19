-- READ ONLY. An owner may run this in the intended Supabase project's SQL editor.
-- Returns schema/policy/grant metadata only: no user rows, keys or document URLs.
-- Repository migrations do not establish the state of a deployed database.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       pg_get_userbyid(c.relowner) AS table_owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema IN ('public', 'storage')
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY table_schema, table_name, grantee, privilege_type;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
ORDER BY id;

SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
FROM pg_roles
WHERE rolname IN (current_user, 'anon', 'authenticated', 'service_role', 'postgres');

SELECT n.nspname AS schema_name, c.relname AS view_name, c.reloptions
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
ORDER BY c.relname;

SELECT n.nspname AS schema_name, p.proname AS function_name,
       p.prosecdef AS security_definer, p.proacl AS execute_grants
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
ORDER BY p.proname;
