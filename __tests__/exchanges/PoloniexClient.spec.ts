import { testClient } from "../TestRunner";
import { PoloniexClient } from "../../src/exchanges/PoloniexClient";

testClient({
    clientFactory: () => new PoloniexClient(),
    clientName: "PoloniexClient",
    exchangeName: "Poloniex",
    markets: [
        {
            id: "BTC_USDT",
            base: "BTC",
            quote: "USDT",
        },
        {
            id: "ETH_BTC",
            base: "ETH",
            quote: "BTC",
        },
        {
            id: "ETH_USDT",
            base: "ETH",
            quote: "USDT",
        },
    ],

    testConnectEvents: false,
    testDisconnectEvents: false,
    testReconnectionEvents: false,
    testCloseEvents: false,

    hasTickers: true,
    hasTrades: true,
    hasCandles: false,
    hasLevel2Snapshots: false,
    hasLevel2Updates: true,
    hasLevel3Snapshots: false,
    hasLevel3Updates: false,

    ticker: {
        hasTimestamp: true,
        hasLast: false,
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

    l2snapshot: {
        hasTimestampMs: false,
        hasSequenceId: true,
        hasCount: false,
    },

    l2update: {
        hasSnapshot: false,
        hasTimestampMs: false,
        hasSequenceId: true,
        hasCount: false,
    },
});
