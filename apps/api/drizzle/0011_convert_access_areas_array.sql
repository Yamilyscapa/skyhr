ALTER TABLE "visitors"
  ALTER COLUMN "access_areas" TYPE text[]
  USING CASE
    WHEN "access_areas" IS NULL THEN ARRAY[]::text[]
    WHEN "access_areas" LIKE '{%' THEN "access_areas"::text[]
    ELSE ARRAY["access_areas"]
  END;
