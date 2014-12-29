var ws = require('ws'),
    messages = require('../../public/lib/messages.js'),
    config = require('../../config/config'),
    Registry = require('../models/Registry.js'),
    PriceRequester = require('../models/PriceRequester.js');

/**
 * CexIO
 */
function CexIOPriceRequester(symbol, options) {
    PriceRequester.call(this, symbol, options);
}

CexIOPriceRequester.config = {
    exchange: 'cexio',
    symbol_map: {
        "BTCUSD" : "BTC/USD",
        "LTCUSD" : "LTC/USD"
    },
    url_template: 'https://cex.io/api/ticker/<<SYMBOL>>',
};

CexIOPriceRequester.register = function (factory) {
    factory.register();
};

CexIOPriceRequester.prototype = Object.create(PriceRequester.prototype);
CexIOPriceRequester.prototype.constructor = CexIOPriceRequester;

CexIOPriceRequester.prototype.processResponse = function (response, body) {
    var object = JSON.parse(body),
        bid = parseFloat(object.bid),
        ask = parseFloat(object.ask),
        updated_on = new Date();

    return new messages.Price(this.getExchange(),
                              this.symbol,
                              bid,
                              ask,
                              updated_on, {
                                  volume24: parseFloat(object.volume),
                                  low24: parseFloat(object.low),
                                  high24: parseFloat(object.high)
                              });
};
/**/

/**
 * CexIO streamer
 */

function CexIOStreamer(symbol, callback, errback) {
    var self = this;

    this.socket = ws.connect('wss://ws.cex.io/ws');

    this.socket.on('open', function (data) {
        self.socket.send(JSON.stringify({
            e: "subscribe",
            rooms: ["tickers"]
        }));
    });

    this.socket.on('message', function (message){
        var payload = JSON.parse(message);
        if ((payload.e !== "tick") ||
            (payload.data.symbol2 !== 'USD')) {
            return;
        }

        if ((payload.data.symbol1 === 'LTC' && symbol === 'LTCUSD') ||
            (payload.data.symbol1 === 'BTC' && symbol === 'BTCUSD')) {
            callback(new messages.Price("cexio",
                                        symbol,
                                        parseFloat(payload.data.price),
                                        parseFloat(payload.data.price)));
        }
    });
}

CexIOStreamer.config = {
    exchange: 'cexio',
};

CexIOStreamer.prototype.stop = function () {
    this.socket.close();
};

module.exports = {
    register: function () {
        registry = Registry.getInstance();
        registry.requesters.register(CexIOPriceRequester.config.exchange,
                                     CexIOPriceRequester);
        registry.streamers.register(CexIOStreamer.config.exchange,
                                   CexIOStreamer);
    }
};
/**/