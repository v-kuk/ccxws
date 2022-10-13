/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "events";
import { IClient } from "./IClient";
import { SmartWss } from "./SmartWss";
import { Watcher } from "./Watcher";
import { Market } from "./Market";

export type AssignedMarket = {
    market: Market;
    socketId: number;
};
export type MarketMap = Map<string, AssignedMarket>;
export type WssFactoryFn = (path: string) => SmartWss;
export type SendFn = (remoteId: string, market: AssignedMarket) => void;

export type Subscription = {
    type: string;
    name: string;
};

export type Socket = {
    connection: SmartWss;
    subscriptions: Set<Subscription>;
    requestsCount: number;
};

export abstract class BasicRLClient extends EventEmitter implements IClient {
    public hasTickers: boolean;
    public hasTrades: boolean;
    public hasCandles: boolean;
    public hasLevel2Snapshots: boolean;
    public hasLevel2Updates: boolean;
    public hasLevel3Snapshots: boolean;
    public hasLevel3Updates: boolean;

    protected _wssFactory: WssFactoryFn;
    protected _wssPath: string; // in case you need to update url mid time
    protected _tickerSubs: MarketMap;
    protected _tradeSubs: MarketMap;
    protected _candleSubs: MarketMap;
    protected _level2SnapshotSubs: MarketMap;
    protected _level2UpdateSubs: MarketMap;
    protected _level3SnapshotSubs: MarketMap;
    protected _level3UpdateSubs: MarketMap;
    protected _wss: Array<Socket>;
    protected _watcher: Watcher;

    protected _actionQueue: Array<() => void>;
    protected _flushInterval: NodeJS.Timeout;
    protected _creatingSocket: boolean;

    constructor(
        readonly wssPath: string,
        readonly name: string,
        wssFactory?: WssFactoryFn,
        watcherMs?: number,
        readonly maxSocketSubs?: number,
        readonly maxRequestsPerSecond?: number,
    ) {
        super();
        this._tickerSubs = new Map();
        this._tradeSubs = new Map();
        this._candleSubs = new Map();
        this._level2SnapshotSubs = new Map();
        this._level2UpdateSubs = new Map();
        this._level3SnapshotSubs = new Map();
        this._level3UpdateSubs = new Map();
        this._wss = [];
        this._watcher = new Watcher(this, watcherMs);

        this.hasTickers = false;
        this.hasTrades = true;
        this.hasCandles = false;
        this.hasLevel2Snapshots = false;
        this.hasLevel2Updates = false;
        this.hasLevel3Snapshots = false;
        this.hasLevel3Updates = false;
        this._wssFactory = wssFactory || (path => new SmartWss(path));

        this._creatingSocket = false;
        this._actionQueue = new Array<() => void>();

        if (this.maxRequestsPerSecond) {
            // eslint-disable-next-line @typescript-eslint/no-implied-eval
            this._flushInterval = setInterval(this._flushRequestsCount.bind(this), 1000);
        }
    }

    //////////////////////////////////////////////

    public close() {
        if (this._beforeClose) {
            this._beforeClose();
        }
        this._watcher.stop();
        if (this._wss.length > 0) {
            for (let i = 0; i < this._wss.length; i++) {
                this._wss[i].connection.close();
                this._wss.splice(i, 1);
            }
        }
    }

    public async reconnect() {
        this.emit("reconnecting");
        if (this._wss.length > 0) {
            for (const wss of this._wss) {
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                wss.connection.once("closed", () => this._connect());
            }

            this.close();
        } else {
            await this._connect();
        }
    }

    public subscribeTicker(market: Market) {
        if (!this.hasTickers) return;
        return this._subscribe(market, this._tickerSubs, this._sendSubTicker.bind(this));
    }

    public unsubscribeTicker(market: Market): Promise<void> {
        if (!this.hasTickers) return;
        this._unsubscribe(market, this._tickerSubs, this._sendUnsubTicker.bind(this));
    }

    public subscribeCandles(market: Market) {
        if (!this.hasCandles) return;
        return this._subscribe(market, this._candleSubs, this._sendSubCandles.bind(this));
    }

    public unsubscribeCandles(market: Market): Promise<void> {
        if (!this.hasCandles) return;
        this._unsubscribe(market, this._candleSubs, this._sendUnsubCandles.bind(this));
    }

    public subscribeTrades(market: Market) {
        if (!this.hasTrades) return;
        return this._subscribe(market, this._tradeSubs, this._sendSubTrades.bind(this));
    }

    public unsubscribeTrades(market: Market): Promise<void> {
        if (!this.hasTrades) return;
        this._unsubscribe(market, this._tradeSubs, this._sendUnsubTrades.bind(this));
    }

    public subscribeLevel2Snapshots(market: Market) {
        if (!this.hasLevel2Snapshots) return;
        return this._subscribe(
            market,
            this._level2SnapshotSubs,
            this._sendSubLevel2Snapshots.bind(this),
        );
    }

    public unsubscribeLevel2Snapshots(market: Market): Promise<void> {
        if (!this.hasLevel2Snapshots) return;
        this._unsubscribe(
            market,
            this._level2SnapshotSubs,
            this._sendUnsubLevel2Snapshots.bind(this),
        );
    }

    public subscribeLevel2Updates(market: Market) {
        if (!this.hasLevel2Updates) return;
        return this._subscribe(
            market,
            this._level2UpdateSubs,
            this._sendSubLevel2Updates.bind(this),
        );
    }

    public unsubscribeLevel2Updates(market: Market): Promise<void> {
        if (!this.hasLevel2Updates) return;
        this._unsubscribe(market, this._level2UpdateSubs, this._sendUnsubLevel2Updates.bind(this));
    }

    public subscribeLevel3Snapshots(market: Market) {
        if (!this.hasLevel3Snapshots) return;
        return this._subscribe(
            market,
            this._level3SnapshotSubs,
            this._sendSubLevel3Snapshots.bind(this),
        );
    }

    public unsubscribeLevel3Snapshots(market: Market): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public subscribeLevel3Updates(market: Market) {
        if (!this.hasLevel3Updates) return;
        return this._subscribe(
            market,
            this._level3UpdateSubs,
            this._sendSubLevel3Updates.bind(this),
        );
    }

    public unsubscribeLevel3Updates(market: Market): Promise<void> {
        if (!this.hasLevel3Updates) return;
        this._unsubscribe(market, this._level3UpdateSubs, this._sendUnsubLevel3Updates.bind(this));
    }

    ////////////////////////////////////////////
    // PROTECTED

    /**
     * Helper function for performing a subscription operation
     * where a subscription map is maintained and the message
     * send operation is performed
     * @param {Market} market
     * @param {Map} map
     * @param {Function} sendFn
     * @returns {Boolean} returns true when a new subscription event occurs
     */
    protected async _subscribe(market: Market, map: MarketMap, sendFn: SendFn) {
        await this._connect();
        const remote_id = market.id;
        if (!map.has(remote_id)) {
            const assignedMarket: AssignedMarket = {
                market,
                socketId: null,
            };
            // perform the subscription if socket array has any sockets and
            // socket is connected and available for new pairs
            // if there is no available sockets - we create them
            // and if not, then we'll reply on the _onConnected event
            // to send the signal to our server!
            let socketToSubscribe: Promise<Socket> = null;
            if (this._wss.length > 0) {
                for (let i = 0; i < this._wss.length; i++) {
                    const wss = this._wss[i];
                    const isAvailable =
                        (!this.maxSocketSubs || wss.subscriptions.size < this.maxSocketSubs) &&
                        wss.connection.isConnected;
                    if (isAvailable) {
                        socketToSubscribe = Promise.resolve(wss); // we need to use same interface as _createConnection returns
                        assignedMarket.socketId = i;
                    }
                }
            }

            if (socketToSubscribe == null) {
                socketToSubscribe = this._createConnection();
                assignedMarket.socketId = this._wss.length - 1;
            }

            map.set(remote_id, assignedMarket);
            socketToSubscribe
                .then(socket =>
                    this._processAction(socket, () => sendFn(remote_id, assignedMarket)),
                )
                .catch(err => {
                    throw new Error(err);
                });

            return true;
        }
        return false;
    }

    /**
     * Helper function for performing an unsubscription operation
     * where a subscription map is maintained and the message
     * send operation is performed
     */
    protected _unsubscribe(market: Market, map: MarketMap, sendFn: SendFn) {
        const remote_id = market.id;
        if (map.has(remote_id)) {
            const { market, socketId } = map.get(remote_id);
            map.delete(remote_id);

            if (this._wss[socketId].connection.isConnected) sendFn(remote_id, { market, socketId });
        }
    }

    protected async _createConnection(): Promise<Socket> {
        // if there is already creating connection - wait for it to stop creating
        if (this._creatingSocket) {
            const wait = () =>
                new Promise<Socket>(resolve => {
                    const interval = setInterval(() => {
                        if (!this._creatingSocket) {
                            clearInterval(interval);
                            resolve(this._wss[this._wss.length - 1]);
                        }
                    }, 100);
                });
            return await wait();
        }

        this._creatingSocket = true;

        if (!this.wssPath && !this._wssPath) {
            const wait = () =>
                new Promise<Socket>(resolve => {
                    let check = 0;
                    const interval = setInterval(() => {
                        if (check > 5) throw new Error("There is no wss url provided");

                        if (this.wssPath || this._wssPath) {
                            clearInterval(interval);
                            resolve(this._wss[this._wss.length - 1]);
                        }

                        check++;
                    }, 1000);
                });
            return await wait();
        }

        const connection = this._wssFactory(this.wssPath ?? this._wssPath);
        connection.on("error", this._onError.bind(this));
        connection.on("connecting", this._onConnecting.bind(this));
        connection.on("connected", this._onConnected.bind(this));
        connection.on("disconnected", this._onDisconnected.bind(this));
        connection.on("closing", this._onClosing.bind(this));
        connection.on("closed", this._onClosed.bind(this));
        connection.on("message", (msg: string) => {
            try {
                this._onMessage(msg);
            } catch (ex) {
                this._onError(ex);
            }
        });

        await connection.connect();

        this._wss.push({
            connection,
            subscriptions: new Set<Subscription>(),
            requestsCount: 0,
        });

        this._creatingSocket = false;

        return this._wss[this._wss.length - 1];
    }

    protected _processAction(socket: Socket, callback: () => void) {
        if (!this.maxRequestsPerSecond || socket.requestsCount < this.maxRequestsPerSecond) {
            callback();
        } else {
            this._actionQueue.push(() => this._processAction(socket, callback));
        }
    }

    protected _flushRequestsCount() {
        for (const wss of this._wss) {
            wss.requestsCount = 0;
        }

        for (const action of this._actionQueue) {
            action();
        }
    }

    /**
     * Idempotent method for creating and initializing
     * a long standing web socket client. This method
     * is only called in the subscribe method. Multiple calls
     * have no effect.
     */
    protected async _connect() {
        if (this._wss.length === 0) {
            this._beforeConnect();
            await this._createConnection();
        }
    }

    /**
     * Handles the error event
     * @param {Error} err
     */
    protected _onError(err) {
        this.emit("error", err);
    }

    /**
     * Handles the connecting event. This is fired any time the
     * underlying websocket begins a connection.
     */
    protected _onConnecting() {
        this.emit("connecting");
    }

    /**
     * This method is fired anytime the socket is opened, whether
     * the first time, or any subsequent reconnects. This allows
     * the socket to immediate trigger resubscription to relevent
     * feeds
     */
    protected _onConnected() {
        this.emit("connected");
        for (const [marketSymbol, market] of this._tickerSubs) {
            this._tickerSubs.delete(marketSymbol);
            void this.subscribeTicker(market.market);
        }
        for (const [marketSymbol, market] of this._candleSubs) {
            this._candleSubs.delete(marketSymbol);
            void this.subscribeCandles(market.market);
        }
        for (const [marketSymbol, market] of this._tradeSubs) {
            this._tradeSubs.delete(marketSymbol);
            void this.subscribeTrades(market.market);
        }
        for (const [marketSymbol, market] of this._level2SnapshotSubs) {
            this._level2SnapshotSubs.delete(marketSymbol);
            void this.subscribeLevel2Snapshots(market.market);
        }
        for (const [marketSymbol, market] of this._level2UpdateSubs) {
            this._level2UpdateSubs.delete(marketSymbol);
            void this.subscribeLevel2Updates(market.market);
        }
        for (const [marketSymbol, market] of this._level3UpdateSubs) {
            this._level3SnapshotSubs.delete(marketSymbol);
            void this.subscribeLevel3Updates(market.market);
        }
        this._watcher.start();
    }

    /**
     * Handles a disconnection event
     */
    protected _onDisconnected() {
        this._watcher.stop();
        this.emit("disconnected");
    }

    /**
     * Handles the closing event
     */
    protected _onClosing() {
        this._watcher.stop();
        this.emit("closing");
    }

    /**
     * Fires before connect
     */
    protected _beforeConnect() {
        //
    }

    /**
     * Fires before close
     */
    protected _beforeClose() {
        //
    }

    /**
     * Handles the closed event
     */
    protected _onClosed() {
        this.emit("closed");
    }

    ////////////////////////////////////////////
    // ABSTRACT

    protected abstract _onMessage(msg: any);

    protected abstract _sendSubTicker(remoteId: string, market: AssignedMarket);

    protected abstract _sendSubCandles(remoteId: string, market: AssignedMarket);

    protected abstract _sendUnsubCandles(remoteId: string, market: AssignedMarket);

    protected abstract _sendUnsubTicker(remoteId: string, market: AssignedMarket);

    protected abstract _sendSubTrades(remoteId: string, market: AssignedMarket);

    protected abstract _sendUnsubTrades(remoteId: string, market: AssignedMarket);

    protected abstract _sendSubLevel2Snapshots(remoteId: string, market: AssignedMarket);

    protected abstract _sendUnsubLevel2Snapshots(remoteId: string, market: AssignedMarket);

    protected abstract _sendSubLevel2Updates(remoteId: string, market: AssignedMarket);

    protected abstract _sendUnsubLevel2Updates(remoteId: string, market: AssignedMarket);

    protected abstract _sendSubLevel3Snapshots(remoteId: string, market: AssignedMarket);

    protected abstract _sendUnsubLevel3Snapshots(remoteId: string, market: AssignedMarket);

    protected abstract _sendSubLevel3Updates(remoteId: string, market: AssignedMarket);

    protected abstract _sendUnsubLevel3Updates(remoteId: string, market: AssignedMarket);
}
