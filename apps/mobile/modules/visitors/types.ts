export type VisitorStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Visitor {
    id: string;
    organizationId: string;
    name: string;
    accessAreas: string[];
    entryDate: string;
    exitDate: string;
    status: VisitorStatus;
    approvedByUserId?: string | null;
    approvedAt?: string | null;
    createdByUserId: string;
    qrToken: string;
    qrUrl?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface VisitorQrResponse {
    visitor: Visitor;
}

