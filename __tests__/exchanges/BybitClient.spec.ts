import { BybitClient } from "../../src/exchanges/BybitClient";
import { testClient } from "../TestRunner";

testClient({
    clientFactory: () => new BybitClient(),
    clientName: "BybitClient",
    exchangeName: "Bybit",
    markets: [
        {
            id: "BTCUSDT",
            base: "BTC",
            quote: "USDT",
        },
        {
            id: "ETHUSDT",
            base: "ETH",
            quote: "USDT",
        },
        {
            id: "ETHBTC",
            base: "ETH",
            quote: "USDT",
        },
    ],

    testConnectEvents: true,
    testDisconnectEvents: true,
    testReconnectionEvents: true,
    testCloseEvents: true,

    hasTickers: true,
    hasTrades: true,
    hasCandles: false,
    hasLevel2Snapshots: false,
    hasLevel2Updates: true,
    hasLevel3Snapshots: false,
    hasLevel3Updates: false,

    ticker: {
        hasTimestamp: true,
        hasLast: true,
        hasOpen: true,
        hasHigh: true,
        hasLow: true,
        hasVolume: true,
        hasQuoteVolume: true,
        hasChange: false,
        hasChangePercent: true,
        hasAsk: false,
        hasBid: false,
        hasAskVolume: false,
        hasBidVolume: false,
    },

    trade: {
        hasTradeId: true,
    },

    l2update: {
        hasSnapshot: false,
        hasTimestampMs: true,
        hasSequenceId: false,
        hasCount: false,
    },
});
