import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../db";

async function main() {
    console.log("Fixing permissions table...");
    try {
        // Attempt to convert single text column to text array
        await db.execute(sql`ALTER TABLE permissions ALTER COLUMN documents_url TYPE text[] USING ARRAY[documents_url]`);
        console.log("Successfully altered documents_url to text[] using ARRAY[]");
    } catch (error) {
        console.error("Failed to alter column with ARRAY[]:", error);

        try {
            // Fallback: try the hint suggestion
            await db.execute(sql`ALTER TABLE permissions ALTER COLUMN documents_url TYPE text[] USING documents_url::text[]`);
            console.log("Successfully altered documents_url to text[] using cast");
        } catch (e2) {
            console.error("Failed with cast:", e2);
        }
    }

    console.log("Fixing visitors table...");
    try {
        // Attempt to convert access_areas to text array
        // Try hint first as it's more likely for existing array-like data
        await db.execute(sql`ALTER TABLE visitors ALTER COLUMN access_areas TYPE text[] USING access_areas::text[]`);
        console.log("Successfully altered access_areas to text[] using cast");
    } catch (error) {
        console.error("Failed to alter access_areas with cast:", error);
        try {
            // Fallback: try ARRAY[]
            await db.execute(sql`ALTER TABLE visitors ALTER COLUMN access_areas TYPE text[] USING ARRAY[access_areas]`);
            console.log("Successfully altered access_areas to text[] using ARRAY[]");
        } catch (e2) {
            console.error("Failed with ARRAY[] casting:", e2);
        }
    }

    process.exit(0);
}

main();
