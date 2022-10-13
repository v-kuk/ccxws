export type ClientOptions = {
    wssPath?: string;
    watcherMs?: number;
    throttleMs?: number;
    l2UpdateDepth?: number;
    throttleL2Snapshot?: number;
};

export type ClientRLOptions = ClientOptions & {
    maxSocketSubs?: number;
    maxRequestsPerSecond?: number;
};
