import { db } from "../../db";
import { organization } from "../../db/schema";
import { eq } from "drizzle-orm";
import { createCollection, deleteCollection } from "../biometrics/biometrics.service";

export interface OrganizationWithCollection {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  createdAt: Date;
  metadata: string | null;
  subscription_id: string | null;
  is_active: boolean;
  updated_at: Date;
  rekognition_collection_id: string | null;
}

/**
 * Generate a unique collection ID for the organization
 */
const generateCollectionId = (organizationId: string): string => {
  // Rekognition collection names must be alphanumeric and underscores only
  // Format: skyhr_org_{organizationId}
  return `skyhr_org_${organizationId.replace(/[^a-zA-Z0-9]/g, '_')}`;
};

/**
 * Create a Rekognition collection for an organization
 */
export const createOrganizationCollection = async (organizationId: string): Promise<string | null> => {
  try {
    // First, verify the organization exists (with retry for timing issues)
    let org = null;
    let retries = 3;
    while (!org && retries > 0) {
      org = await getOrganization(organizationId);
      if (!org) {
        retries--;
        if (retries > 0) {
          console.log(`Organization ${organizationId} not found, retrying in 100ms... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    if (!org) {
      console.error(`Organization ${organizationId} not found after retries`);
      return null;
    }
    
    // If collection already exists, return it
    if (org.rekognition_collection_id) {
      console.log(`Organization ${organizationId} already has Rekognition collection: ${org.rekognition_collection_id}`);
      return org.rekognition_collection_id;
    }
    
    const collectionId = generateCollectionId(organizationId);
    
    console.log(`Attempting to create Rekognition collection ${collectionId} for organization: ${organizationId}`);
    
    // Create the collection in AWS Rekognition
    const success = await createCollection(collectionId);
    
    if (success) {
      // Retry the database update (in case of timing issues)
      retries = 3;
      let updateSuccess = false;
      while (!updateSuccess && retries > 0) {
        try {
          const result = await db
            .update(organization)
            .set({ 
              rekognition_collection_id: collectionId,
              updated_at: new Date()
            })
            .where(eq(organization.id, organizationId))
            .returning();
          
          if (result && result.length > 0) {
            updateSuccess = true;
            console.log(`Successfully created and linked Rekognition collection ${collectionId} for organization: ${organizationId}`);
            return collectionId;
          }
        } catch (dbError) {
          retries--;
          if (retries > 0) {
            console.warn(`Failed to update organization record, retrying... (${retries} retries left):`, {
              organizationId,
              collectionId,
              error: dbError instanceof Error ? dbError.message : String(dbError),
            });
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            console.error(`Failed to update organization record with collection ID after retries:`, {
              organizationId,
              collectionId,
              error: dbError instanceof Error ? dbError.message : String(dbError),
            });
          }
        }
      }
      
      // Collection was created but DB update failed - still return success
      if (!updateSuccess) {
        console.warn(`Collection ${collectionId} created but DB update failed for organization: ${organizationId}`);
      }
      return collectionId;
    }
    
    console.error(`Failed to create Rekognition collection for organization: ${organizationId}`, {
      organizationId,
      collectionId,
    });
    return null;
  } catch (error) {
    console.error(`Error creating organization collection:`, {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
};

/**
 * Delete a Rekognition collection for an organization
 */
export const deleteOrganizationCollection = async (organizationId: string): Promise<boolean> => {
  try {
    // Get the organization to find the collection ID
    const org = await getOrganization(organizationId);
    
    if (!org?.rekognition_collection_id) {
      console.warn(`No collection found for organization: ${organizationId} (treating as success)`);
      return true; // Consider it successful if no collection exists
    }
    
    const collectionId = org.rekognition_collection_id;
    console.log(`Attempting to delete Rekognition collection ${collectionId} for organization: ${organizationId}`);
    
    // Delete the collection from AWS Rekognition
    const success = await deleteCollection(collectionId);
    
    if (success) {
      try {
        // Remove the collection ID from the organization record
        await db
          .update(organization)
          .set({ 
            rekognition_collection_id: null,
            updated_at: new Date()
          })
          .where(eq(organization.id, organizationId));
        
        console.log(`Successfully deleted and unlinked Rekognition collection ${collectionId} for organization: ${organizationId}`);
      } catch (dbError) {
        console.error(`Failed to update organization record after collection deletion:`, {
          organizationId,
          collectionId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
        });
        // Collection was deleted but DB update failed - still return success
      }
    } else {
      console.error(`Failed to delete Rekognition collection for organization: ${organizationId}`, {
        organizationId,
        collectionId,
      });
    }
    
    return success;
  } catch (error) {
    console.error(`Error deleting organization collection:`, {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
};

/**
 * Get organization by ID with collection info
 */
export const getOrganization = async (organizationId: string): Promise<OrganizationWithCollection | null> => {
  try {
    const result = await db
      .select()
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    console.error(`Error fetching organization:`, {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
};

/**
 * Get organization's Rekognition collection ID
 */
export const getOrganizationCollectionId = async (organizationId: string): Promise<string | null> => {
  try {
    const org = await getOrganization(organizationId);
    return org?.rekognition_collection_id || null;
  } catch (error) {
    console.error(`Error fetching organization collection ID:`, {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Ensure organization has a Rekognition collection (create if missing)
 */
export const ensureOrganizationCollection = async (organizationId: string): Promise<string | null> => {
  try {
    const org = await getOrganization(organizationId);
    
    if (!org) {
      console.error(`Organization not found: ${organizationId}`);
      return null;
    }
    
    // If collection already exists, return it
    if (org.rekognition_collection_id) {
      console.log(`Organization ${organizationId} already has Rekognition collection: ${org.rekognition_collection_id}`);
      return org.rekognition_collection_id;
    }
    
    // Create new collection
    console.log(`Ensuring Rekognition collection exists for organization: ${organizationId}`);
    return await createOrganizationCollection(organizationId);
  } catch (error) {
    console.error(`Error ensuring organization collection:`, {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
};
