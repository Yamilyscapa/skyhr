export interface Announcement {
    id: string;
    title: string;
    content: string;
    priority: 'normal' | 'important' | 'urgent';
    createdAt: string;
    publishedAt: string | null;
    expiresAt: string | null;
    updatedAt: string;
    organizationId: string;
}

