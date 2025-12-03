SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('shift', 'user_schedule', 'organization_settings')
ORDER BY table_name;
