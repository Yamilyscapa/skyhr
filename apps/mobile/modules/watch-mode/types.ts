export type WatchModeEvent = {
    id: string;
    userName: string;
    status: string;
    recordedAt: string;
    message: string;
    distance?: number | null;
};

export type StatusTone = 'idle' | 'success' | 'error' | 'warning';
