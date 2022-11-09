/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-implied-eval */
import moment from "moment";
import { BasicClient } from "../BasicClient";
import { Level2Point } from "../Level2Point";
import { Level2Update } from "../Level2Update";
import { NotImplementedFn } from "../NotImplementedFn";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";

export type BybitClientOptions = {
    wssPath?: string;
    watcherMs?: number;
};

export class BybitClient extends BasicClient {
    protected _pingInterval: NodeJS.Timeout;

    protected _sendSubCandles = NotImplementedFn;
    protected _sendUnsubCandles = NotImplementedFn;
    protected _sendSubLevel2Snapshots = NotImplementedFn;
    protected _sendUnsubLevel2Snapshots = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;
    protected _sendSubLevel3Updates = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;

    constructor({
        wssPath = "wss://stream.bybit.com/spot/quote/ws/v1",
        watcherMs,
    }: BybitClientOptions = {}) {
        super(wssPath, "Bybit", undefined, watcherMs);

        this.hasTickers = true;
        this.hasTrades = true;
        this.hasLevel2Updates = true;
    }

    protected _startPing() {
        clearInterval(this._pingInterval);
        this._pingInterval = setInterval(this._sendPing.bind(this), 20000);
    }

    protected _stopPing() {
        clearInterval(this._pingInterval);
    }

    protected _sendPing() {
        if (this._wss) this._wss.send(JSON.stringify({ ping: moment().valueOf() }));
    }

    protected _sendSubTicker(remoteId: string) {
        this._wss.send(
            JSON.stringify({
                topic: "realtimes",
                event: "sub",
                symbol: remoteId,
                params: {
                    binary: false,
                },
            }),
        );
    }

    protected _sendUnsubTicker(remoteId: string) {
        this._wss.send(
            JSON.stringify({
                topic: "realtimes",
                event: "cancel",
                symbol: remoteId,
                params: {
                    binary: false,
                },
            }),
        );
    }

    protected _sendSubTrades(remoteId: string) {
        this._wss.send(
            JSON.stringify({
                topic: "trade",
                event: "sub",
                symbol: remoteId,
                params: {
                    binary: false,
                },
            }),
        );
    }

    protected _sendUnsubTrades(remoteId: string) {
        this._wss.send(
            JSON.stringify({
                topic: "trade",
                event: "cancel",
                symbol: remoteId,
                params: {
                    binary: false,
                },
            }),
        );
    }

    protected _sendSubLevel2Updates(remoteId: string) {
        this._wss.send(
            JSON.stringify({
                topic: "diffDepth",
                event: "sub",
                symbol: remoteId,
                params: {
                    binary: false,
                },
            }),
        );
    }

    protected _sendUnsubLevel2Updates(remoteId: string) {
        this._wss.send(
            JSON.stringify({
                topic: "diffDepth",
                event: "cancel",
                symbol: remoteId,
                params: {
                    binary: false,
                },
            }),
        );
    }

    protected _onMessage(raw: string) {
        let msg: any;
        try {
            msg = JSON.parse(raw);
        } catch (e) {
            this.emit("error", e);
            return;
        }

        if ((msg.event === "sub" || msg.event === "cancel") && msg.msg === "Success") return;

        if (msg.topic === "realtimes") {
            this._onTicker(msg);
            return;
        }

        if (msg.topic === "trade") {
            this._onTrade(msg);
            return;
        }

        if (msg.topic === "diffDepth") {
            this._onL2Update(msg);
            return;
        }
    }

    protected _onTicker(msg) {
        const [
            {
                s, // symbol
                t, // timestamp
                o, // open
                c, // close
                h, // high
                l, // low
                v, // volume
                qv, // quote volume
                m, // change
            },
        ] = msg.data;

        const market = this._tickerSubs.get(s);
        if (!market) return;

        const ticker = new Ticker({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestamp: moment(Number(t)).utc().valueOf(),
            open: o,
            last: c,
            high: h,
            low: l,
            volume: v,
            quoteVolume: qv,
            changePercent: m,
        });

        this.emit("ticker", ticker, market);
    }

    protected _onTrade(msg) {
        const { symbol } = msg;
        const [
            {
                v, // trade ID
                t, // timestamp
                p, // price
                q, // quantity
                m, // isBuy
            },
        ] = msg.data;

        const market = this._tradeSubs.get(symbol);
        if (!market) return;

        const trade = new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            tradeId: v,
            unix: moment(Number(t)).utc().valueOf(),
            side: m ? "buy" : "sell",
            price: p,
            amount: q,
        });

        this.emit("trade", trade, market);
    }

    protected _onL2Update(msg) {
        const [
            {
                s, // symbol
                t, // timestamp
                b, // bids
                a, // asks
            },
        ] = msg.data;

        const bids = b.map(([price, amount]) => new Level2Point(price, amount));
        const asks = a.map(([price, amount]) => new Level2Point(price, amount));

        const market = this._level2UpdateSubs.get(s);
        if (!market) return;

        const update = new Level2Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestampMs: moment(Number(t)).utc().valueOf(),
            bids,
            asks,
        });

        this.emit("l2update", update, market);
    }
}
