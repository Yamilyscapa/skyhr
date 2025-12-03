-- Create permission_status enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE "permission_status" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text,
  "message" text NOT NULL,
  "documents_url" text,
  "starting_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "is_approved" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

-- Add foreign key for user_id if it doesn't exist and users table exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'permissions_user_id_users_id_fk'
    ) THEN
      ALTER TABLE "permissions"
        ADD CONSTRAINT "permissions_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
  END IF;
END $$;

-- Add new columns if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'organization_id') THEN
    ALTER TABLE "permissions" ADD COLUMN "organization_id" text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'approved_by') THEN
    ALTER TABLE "permissions" ADD COLUMN "approved_by" text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'supervisor_comment') THEN
    ALTER TABLE "permissions" ADD COLUMN "supervisor_comment" text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'updated_at') THEN
    ALTER TABLE "permissions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
  END IF;
END $$;

-- Make documents_url nullable if it's currently NOT NULL
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permissions' 
    AND column_name = 'documents_url' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "permissions" ALTER COLUMN "documents_url" DROP NOT NULL;
  END IF;
END $$;

-- Convert documents_url from text to text[] if it's still text type
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permissions' 
    AND column_name = 'documents_url' 
    AND data_type = 'text'
  ) THEN
    -- First handle existing data
    UPDATE permissions 
    SET documents_url = CASE 
      WHEN documents_url IS NULL OR documents_url = '' THEN NULL
      ELSE documents_url
    END;
    
    -- Change to array type
    ALTER TABLE "permissions"
      ALTER COLUMN "documents_url" SET DATA TYPE text[] USING CASE 
        WHEN documents_url IS NULL THEN NULL
        WHEN documents_url = '' THEN NULL
        ELSE ARRAY[documents_url]
      END;
  END IF;
END $$;

-- Add status column if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'status') THEN
    ALTER TABLE "permissions" ADD COLUMN "status" "permission_status" DEFAULT 'pending' NOT NULL;
    
    -- Migrate existing is_approved data to status if is_approved exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'is_approved') THEN
      UPDATE "permissions"
      SET "status" = CASE 
        WHEN "is_approved" = true THEN 'approved'::permission_status
        ELSE 'pending'::permission_status
      END;
    END IF;
  END IF;
END $$;

-- Add foreign key constraints if they don't exist and referenced tables exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'permissions_organization_id_organization_id_fk'
    ) THEN
      ALTER TABLE "permissions"
        ADD CONSTRAINT "permissions_organization_id_organization_id_fk" 
        FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'permissions_approved_by_users_id_fk'
    ) THEN
      ALTER TABLE "permissions"
        ADD CONSTRAINT "permissions_approved_by_users_id_fk" 
        FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
  END IF;
END $$;

-- Drop old is_approved column if it exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'is_approved') THEN
    ALTER TABLE "permissions" DROP COLUMN "is_approved";
  END IF;
END $$;

