/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { ClientOptions } from "../ClientOptions";
import { Level2Point } from "../Level2Point";
import { Level2Update } from "../Level2Update";
import { HuobiBase } from "./HuobiBase";

export class HuobiClient extends HuobiBase {
    constructor({ wssPath = "wss://api.huobi.pro/ws", watcherMs }: ClientOptions = {}) {
        super({ name: "Huobi", wssPath, watcherMs });
        
        this.l2updatesChannel = "mbp.150";
        this.hasLevel2Updates = true;
    }

    protected _sendSubLevel2Updates(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                sub: `market.${remote_id}.mbp.150`,
                id: "mbp_" + remote_id,
            }),
        );
    }

    protected _sendUnsubLevel2Updates(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                unsub: `market.${remote_id}.mbp.150`,
                id: "mbp_" + remote_id,
            }),
        );
    }

    protected _constructL2Update(msg, market) {
        const { ts, tick } = msg;

        const asks = tick.asks
            ? tick.asks.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(2)))
            : [];
        const bids = tick.bids
            ? tick.bids.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(2)))
            : [];

        return new Level2Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            sequenceId: tick.seqNum,
            lastSequenceId: tick.prevSeqNum,
            timestampMs: ts,
            asks,
            bids,
        });
    }
}
