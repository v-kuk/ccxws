const LOCKED: bigint = 0n;
const UNLOCKED: bigint = 1n;

export class Semaphore {
    private lock: BigInt64Array;

    constructor() {
        const buffer = new ArrayBuffer(8);
        this.lock = new BigInt64Array(buffer, 0, 1);
        Atomics.store(this.lock, 0, UNLOCKED);
    }

    public async enter(): Promise<void> {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                const lastState = Atomics.compareExchange(this.lock, 0, UNLOCKED, LOCKED);
                if (lastState === UNLOCKED) {
                    clearInterval(interval);
                    resolve();
                }
            }, 10);
        });
    }

    public leave(): void {
        Atomics.store(this.lock, 0, UNLOCKED);
    }
}
