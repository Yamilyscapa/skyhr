export interface Permission {
    id: string;
    userId: string;
    organizationId: string;
    message: string;
    documentsUrl: string[];
    startingDate: string;
    endDate: string;
    status: 'pending' | 'approved' | 'rejected';
    approvedBy: string | null;
    supervisorComment: string | null;
    createdAt: string;
    updatedAt: string;
}

