export const TRUSTED_ORIGINS: string[] = process.env.TRUSTED_ORIGINS?.split(",").map(origin => origin.trim()).filter(origin => origin.length > 0) || [];
