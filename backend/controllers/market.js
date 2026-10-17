const YahooFinance = require("yahoo-finance2").default;

const yahooFinance = new YahooFinance();
const getMarketIndices = async (req, res) => {
    try {
        const quotes = await yahooFinance.quote(["^NSEI", "^BSESN"]);

        const data = quotes.map((index) => {
            const price = index.regularMarketPrice;
            const previousClose = index.regularMarketPreviousClose;

            const change = price - previousClose;
            const percent = previousClose
                ? (change / previousClose) * 100
                : 0;

            return {
                symbol: index.symbol,
                name: index.symbol === "^NSEI" ? "NIFTY 50" : "SENSEX",
                price: Number(price.toFixed(2)),
                change: Number(change.toFixed(2)),
                percent: Number(percent.toFixed(2)),
                isDown: change < 0
            };
        });

        

        res.json(data);

    } catch (err) {
        console.log("Index API error:", err);

        res.status(500).json({
            message: "Failed to fetch market indices"
        });
    }
};
const getMarketQuotes = async (req, res) => {
    try {
        const symbols = [
            "INFY.NS",
            "ONGC.NS",
            "TCS.NS",
            "KPITTECH.NS",
            "QUICKHEAL.NS",
            "WIPRO.NS",
            "M&M.NS",
            "RELIANCE.NS",
            "HINDUNILVR.NS"
        ];

        const quotes = await yahooFinance.quote(symbols);

        const data = quotes.map((stock) => {
            const price = stock.regularMarketPrice;
            const previousClose = stock.regularMarketPreviousClose;

            const change = price - previousClose;

            const percent =
                previousClose
                    ? (change / previousClose) * 100
                    : 0;

            return {
                symbol: stock.symbol,
                name: stock.symbol.replace(".NS", ""),
                price: Number(price.toFixed(2)),
                percent: `${percent.toFixed(2)}%`,
                isDown: change < 0
            };
        });

        res.json(data);

    } catch (err) {
        console.log("Market API error:", err);

        res.status(500).json({
            message: "Failed to fetch market data"
        });
    }
};

module.exports = {
    getMarketQuotes,
    getMarketIndices
};