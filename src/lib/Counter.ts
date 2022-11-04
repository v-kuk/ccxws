import { Semaphore } from "./Semaphore";

export class Counter {
    private semaphore: Semaphore;
    private counter: number;

    constructor(init: number = 0) {
        this.counter = init;
        this.semaphore = new Semaphore();
    }

    public async compareInc(value: number): Promise<boolean> {
        await this.semaphore.enter();
        let cond = false;
        if (this.counter < value - 1) {
            this.counter++;
            cond = true;
        }
        this.semaphore.leave();
        return cond;
    }

    public async inc(): Promise<boolean> {
        await this.semaphore.enter();
        this.counter++;
        this.semaphore.leave();
        return true;
    }

    public async dec(): Promise<boolean> {
        await this.semaphore.enter();
        this.counter--;
        this.semaphore.leave();
        return true;
    }
}
