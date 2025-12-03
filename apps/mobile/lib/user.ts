type UserLike = Record<string, unknown> | null | undefined;

const FACE_KEYS = [
    'user_face_url',
    'userFaceUrl',
    'user_face_urls',
    'userFaceUrls',
] as const;

function normalizeToArray(value: unknown): string[] {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
    }

    if (typeof value === 'string') {
        return [value];
    }

    return [];
}

function collectFaceUrls(source: UserLike): string[] {
    if (!source || typeof source !== 'object') {
        return [];
    }

    const record = source as Record<string, unknown>;

    return FACE_KEYS.flatMap((key) => normalizeToArray(record[key]));
}

/**
 * Extracts the face URL list from the user object regardless of naming convention or nesting.
 * Backend may return the data directly on the user or nested under user.metadata.
 */
export function getUserFaceUrls(user: UserLike): string[] {
    const direct = collectFaceUrls(user);
    const metadata = collectFaceUrls((user as Record<string, unknown> | null | undefined)?.metadata as UserLike);

    const unique = new Set([...direct, ...metadata]);
    return Array.from(unique);
}
