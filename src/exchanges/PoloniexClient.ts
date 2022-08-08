/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import moment from "moment";
import { BasicClient } from "../BasicClient";
import { ClientOptions } from "../ClientOptions";
import { Level2Point } from "../Level2Point";
import { Level2Update } from "../Level2Update";
import { NotImplementedFn } from "../NotImplementedFn";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";

export class PoloniexClient extends BasicClient {
    protected static _pingTimeout: any;

    constructor({ wssPath = "wss://ws.poloniex.com/ws/public", watcherMs }: ClientOptions = {}) {
        super(wssPath, "Poloniex", undefined, watcherMs);

        this.hasTickers = true;
        this.hasTrades = true;
        this.hasLevel2Updates = true;
    }

    protected _sendSubTicker(remote_id: string) {
        this._sendSubscribe("ticker", remote_id);
    }

    protected _sendUnsubTicker(remote_id: string) {
        this._sendUnsubscribe("ticker", remote_id);
    }

    protected _sendSubTrades(remote_id) {
        this._sendSubscribe("trades", remote_id);
    }

    protected _sendUnsubTrades(remote_id: string) {
        this._sendUnsubscribe("trades", remote_id);
    }

    protected _sendSubLevel2Updates(remote_id: string) {
        this._sendSubscribe("book", remote_id);
    }

    protected _sendUnsubLevel2Updates(remote_id: string) {
        this._sendUnsubscribe("book", remote_id);
    }

    protected _sendSubCandles = NotImplementedFn;
    protected _sendUnsubCandles = NotImplementedFn;
    protected _sendSubLevel2Snapshots = NotImplementedFn;
    protected _sendUnsubLevel2Snapshots = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;
    protected _sendSubLevel3Updates = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;

    protected _sendSubscribe(channel: string, symbol: string): void {
        this._wss.send(
            JSON.stringify({
                event: "subscribe",
                channel: [channel],
                symbols: [symbol],
            }),
        );
    }

    protected _sendUnsubscribe(channel: string, symbol: string): void {
        this._wss.send(
            JSON.stringify({
                event: "unsubscribe",
                channel: [channel],
                symbols: [symbol],
            }),
        );
    }

    protected _ping(): void {
        PoloniexClient._pingTimeout = setTimeout(() => {
            if (this._wss) this._wss.send(JSON.stringify({ event: "ping" }));
        }, 29000);
    }

    protected _onMessage(raw): void {
        try {
            if (PoloniexClient._pingTimeout) clearTimeout(PoloniexClient._pingTimeout);

            this._ping();

            const msg = JSON.parse(raw);

            // capture channel metadata
            if (msg.event === "subscribe") return;

            // process unsubscribe event
            if (msg.event === "unsubscribe") return;

            if (msg.event === "pong") return;

            if (msg.event === "error")
                throw new Error(msg.message);

            if (msg.data?.length === 0) return;

            const data = msg.data[0];

            // tickers
            if (msg.channel === "ticker") {
                const market = this._tickerSubs.get(data.symbol);
                if (!market) return;

                const ticker = this._createTicker(data, market);
                this.emit("ticker", ticker, market);
                return;
            }

            // trades
            if (msg.channel === "trades") {
                const market = this._tradeSubs.get(data.symbol);
                if (!market) return;

                const trade = this._createTrade(data, market);
                this.emit("trade", trade, market);
                return;
            }

            // l2updates
            if (msg.channel === "book") {
                const market = this._level2UpdateSubs.get(data.symbol);
                if (!market) return;

                this._onLevel2Update(msg.data, market);
                return;
            }
        } catch (e) {
            throw new Error(e);
        }
    }

    protected _createTicker(update, market): Ticker {
        const { dailyChange, high, amount, quantity, low, open, ts } = update;
        return new Ticker({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestamp: moment(ts).utc().valueOf(),
            open: Number(open).toFixed(8),
            high,
            low,
            volume: quantity,
            quoteVolume: amount,
            changePercent: dailyChange,
        });
    }

    protected _createTrade(update, market): Trade {
        let { id, quantity, takerSide, price, createTime } = update;
        price = Number(price).toFixed(8);
        quantity = Number(quantity).toFixed(8);

        return new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            tradeId: id,
            unix: moment(createTime).utc().valueOf(),
            side: takerSide,
            price,
            amount: quantity,
        });
    }

    protected _onLevel2Update(data, market): void {
        for (let i = 0; i < data.length; i++) {
            const asks = data[i].asks.map((ask: Array<string>) => new Level2Point(ask[0], ask[1]));
            const bids = data[i].bids.map((bid: Array<string>) => new Level2Point(bid[0], bid[1]));

            const update = new Level2Update({
                exchange: this.name,
                base: market.base,
                quote: market.quote,
                timestamp: moment(data[i].createTime).utc().valueOf(),
                sequenceId: data[i].id,
                asks,
                bids,
            });
            this.emit("l2update", update, market);
        }
    }
}
