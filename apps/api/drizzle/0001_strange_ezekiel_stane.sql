-- Convert user_face_url from text to text[] with proper casting
-- First, we need to handle existing data properly

-- Step 1: Convert existing single strings to arrays
UPDATE users 
SET user_face_url = CASE 
  WHEN user_face_url IS NULL THEN NULL
  WHEN user_face_url = '' THEN NULL
  ELSE ARRAY[user_face_url]
END
WHERE user_face_url IS NOT NULL;

-- Step 2: Change the column type to text[]
ALTER TABLE users 
ALTER COLUMN user_face_url 
SET DATA TYPE text[] 
USING CASE 
  WHEN user_face_url IS NULL THEN NULL
  ELSE ARRAY[user_face_url]
END;

