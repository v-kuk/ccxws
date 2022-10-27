import { BinanceBase, BinanceClientOptions } from "./BinanceBase";
import { BasicMultiClientV2 } from "../BasicMultiClientV2";
import { IClient } from "../IClient";

export class BinanceMultiClient extends BasicMultiClientV2 {
    public options: BinanceClientOptions;

    constructor(options: BinanceClientOptions = {}) {
        const sockerPairLimit = 1000;
        super({ sockerPairLimit });
        this.throttleMs = 100;
        this.options = options;
        this.hasTickers = true;
        this.hasTrades = true;
        this.hasCandles = false;
        this.hasLevel2Updates = true;
    }

    protected _createBasicClient(): IClient {
        return new BinanceClient({ ...this.options, parent: this });
    }
}

export class BinanceClient extends BinanceBase {
    public retryErrorTimeout: number;
    public parent: BinanceMultiClient;

    constructor({
        useAggTrades = true,
        requestSnapshot = true,
        socketBatchSize = 200,
        socketThrottleMs = 1000,
        restThrottleMs = 1000,
        testNet = false,
        wssPath = "wss://stream.binance.com:9443/stream",
        restL2SnapshotPath = "https://api.binance.com/api/v1/depth",
        watcherMs,
        l2updateSpeed,
        l2snapshotSpeed,
        batchTickers,
        parent,
    }: BinanceClientOptions = {}) {
        if (testNet) {
            wssPath = "wss://testnet.binance.vision/stream";
            restL2SnapshotPath = "https://testnet.binance.vision/api/v1/depth";
        }
        super({
            name: "Binance",
            restL2SnapshotPath,
            wssPath,
            useAggTrades,
            requestSnapshot,
            socketBatchSize,
            socketThrottleMs,
            restThrottleMs,
            watcherMs,
            l2updateSpeed,
            l2snapshotSpeed,
            batchTickers,
        });
        this.parent = parent as BinanceMultiClient;
    }
}
