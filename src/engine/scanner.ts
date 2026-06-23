import type { StockQuote, CandleData, ScannerResult, SectorData, MarketBreadth } from '../types';
import { FO_STOCKS, SCORE_WEIGHTS } from '../constants';
import {
  calcEMA, calcRSI, calcMACD, calcVWAP, calcATR, calcADX,
  calcMomentumScore, calcVolumeScore, calcTrendScore, calcOIScore,
} from './indicators';
import { findSupportResistance, generateTradeSignal } from './signals';

// ==================== DATA GENERATION (Simulation) ====================
// This simulates realistic market data. Replace with Upstox API calls when token is available.

const stockCache = new Map<string, { quote: StockQuote; candles: CandleData[]; lastUpdate: number }>();
const baseValues = new Map<string, number>();

function getBasePrice(symbol: string): number {
  if (!baseValues.has(symbol)) {
    // Realistic base prices for major F&O stocks
    const prices: Record<string, number> = {
      RELIANCE: 2450, TCS: 3600, HDFCBANK: 1650, INFY: 1520, ICICIBANK: 1180,
      HINDUNILVR: 2350, SBIN: 780, BHARTIARTL: 1550, KOTAKBANK: 1780, ITC: 430,
      LT: 3400, AXISBANK: 1100, WIPRO: 480, BAJFINANCE: 6800, HCLTECH: 1580,
      ASIANPAINT: 2800, MARUTI: 12000, SUNPHARMA: 1700, TATAMOTORS: 650, TITAN: 3200,
      ULTRACEMCO: 10500, BAJAJFINSV: 1600, NESTLEIND: 2350, ONGC: 260, NTPC: 350,
      TATASTEEL: 145, POWERGRID: 310, TECHM: 1550, JSWSTEEL: 880, ADANIENT: 2800,
      INDUSINDBK: 980, DRREDDY: 6200, CIPLA: 1500, EICHERMOT: 4600, DIVISLAB: 5800,
      BPCL: 320, APOLLOHOSP: 6500, TATACONSUM: 1050, HEROMOTOCO: 4800, COALINDIA: 420,
      GRASIM: 2600, BRITANNIA: 5200, SBILIFE: 1500, HINDALCO: 600, VEDL: 440,
      BANKBARODA: 240, 'M&M': 2800, HDFC: 640, DLF: 850, PNB: 105,
    };
    baseValues.set(symbol, prices[symbol] || 1000 + Math.random() * 2000);
  }
  return baseValues.get(symbol)!;
}

function generateIntraCandles(_symbol: string, base: number): CandleData[] {
  const candles: CandleData[] = [];
  const now = new Date();
  const marketOpen = new Date(now);
  marketOpen.setHours(9, 15, 0, 0);

  const minutesElapsed = Math.min(375, Math.max(0,
    (now.getTime() - marketOpen.getTime()) / 60000
  ));

  // Generate 5-minute candles
  let price = base * (0.99 + Math.random() * 0.02);
  const trend = (Math.random() - 0.45) * 0.002; // slight upward bias
  const vol = base * 0.008; // volatility

  const numCandles = Math.max(20, Math.floor(minutesElapsed / 5));

  for (let i = 0; i < numCandles; i++) {
    const drift = trend + (Math.random() - 0.5) * vol / base;
    const open = price;
    const move1 = price * (1 + (Math.random() - 0.5) * vol / base);
    const move2 = price * (1 + drift);
    const high = Math.max(open, move1, move2) * (1 + Math.random() * 0.002);
    const low = Math.min(open, move1, move2) * (1 - Math.random() * 0.002);
    const close = move2;
    price = close;

    const time = marketOpen.getTime() / 1000 + i * 300;
    const volume = Math.floor(50000 + Math.random() * 200000) * (1 + Math.random());

    candles.push({ time, open, high, low, close, volume });
  }

  return candles;
}

function generateQuote(info: typeof FO_STOCKS[0], candles: CandleData[]): StockQuote {
  const base = getBasePrice(info.symbol);
  const last = candles[candles.length - 1];
  const first = candles[0];
  const prevClose = base * (0.995 + Math.random() * 0.01);

  const high = Math.max(...candles.map(c => c.high));
  const low = Math.min(...candles.map(c => c.low));
  const totalVol = candles.reduce((a, c) => a + c.volume, 0);
  const avgVol = totalVol * (0.6 + Math.random() * 0.8);
  const change = last.close - prevClose;
  const changePct = (change / prevClose) * 100;

  const oiBase = info.lotSize * (5000 + Math.random() * 20000);
  const oiChange = oiBase * (Math.random() - 0.4) * 0.1;

  return {
    symbol: info.symbol,
    name: info.name,
    ltp: Math.round(last.close * 100) / 100,
    open: Math.round(first.open * 100) / 100,
    high: Math.round(high * 100) / 100,
    low: Math.round(low * 100) / 100,
    close: Math.round(last.close * 100) / 100,
    prevClose: Math.round(prevClose * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePct: Math.round(changePct * 100) / 100,
    volume: Math.round(totalVol),
    avgVolume: Math.round(avgVol),
    volumeRatio: Math.round((totalVol / avgVol) * 100) / 100,
    oi: Math.round(oiBase),
    oiChange: Math.round(oiChange),
    oiChangePct: Math.round((oiChange / oiBase) * 10000) / 100,
    sector: info.sector,
    lotSize: info.lotSize,
    instrumentKey: info.instrumentKey,
    futuresKey: `NSE_FO|${info.symbol}`,
    lastUpdated: Date.now(),
  };
}

// ==================== MAIN SCANNER ====================

export function runFullScan(): ScannerResult[] {
  const results: ScannerResult[] = [];

  for (const stockInfo of FO_STOCKS) {
    const cached = stockCache.get(stockInfo.symbol);
    let candles: CandleData[];

    if (cached && Date.now() - cached.lastUpdate < 10000) {
      // Update last candle with slight variation
      candles = cached.candles.map((c, i) => {
        if (i === cached.candles.length - 1) {
          const delta = c.close * (Math.random() - 0.5) * 0.002;
          const newClose = c.close + delta;
          return {
            ...c,
            close: newClose,
            high: Math.max(c.high, newClose),
            low: Math.min(c.low, newClose),
          };
        }
        return c;
      });
    } else {
      candles = generateIntraCandles(stockInfo.symbol, getBasePrice(stockInfo.symbol));
    }

    const quote = generateQuote(stockInfo, candles);
    stockCache.set(stockInfo.symbol, { quote, candles, lastUpdate: Date.now() });

    const result = analyzeStock(quote, candles);
    results.push(result);
  }

  return results;
}

export function analyzeStock(stock: StockQuote, candles: CandleData[]): ScannerResult {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  // Calculate indicators
  const ema9Arr = calcEMA(closes, 9);
  const ema20Arr = calcEMA(closes, 20);
  const ema9 = ema9Arr[ema9Arr.length - 1];
  const ema20 = ema20Arr[ema20Arr.length - 1];
  const rsi = calcRSI(closes);
  const macd = calcMACD(closes);
  const vwap = calcVWAP(highs, lows, closes, volumes);
  const atr = calcATR(highs, lows, closes);
  const adx = calcADX(highs, lows, closes);

  // Calculate scores
  const momentumScore = calcMomentumScore(
    stock.changePct, rsi, macd.histogram, adx,
    (stock.ltp - vwap) / vwap,
    (stock.ltp - ema9) / ema9,
    (stock.ltp - ema20) / ema20,
  );

  const volumeScore = calcVolumeScore(stock.volumeRatio, stock.changePct);
  const trendScore = calcTrendScore(ema9, ema20, stock.ltp, adx);
  const oiScore = calcOIScore(stock.oiChangePct, stock.changePct);

  // Relative strength (vs NIFTY proxy)
  const relativeStrength = 50 + stock.changePct * 10 + (stock.volumeRatio - 1) * 5;

  // Sector score
  const sectorScore = 50 + Math.random() * 20;

  // Composite score
  const compositeScore = Math.min(100, Math.max(0,
    momentumScore * SCORE_WEIGHTS.momentum +
    volumeScore * SCORE_WEIGHTS.volume +
    trendScore * SCORE_WEIGHTS.trend +
    Math.min(100, Math.max(0, relativeStrength)) * SCORE_WEIGHTS.relativeStrength +
    oiScore * SCORE_WEIGHTS.oi +
    sectorScore * SCORE_WEIGHTS.sector +
    (momentumScore * 0.5 + trendScore * 0.5) * SCORE_WEIGHTS.pattern +
    (momentumScore * 0.4 + volumeScore * 0.3 + trendScore * 0.3) * SCORE_WEIGHTS.timing
  ));

  const macdSignal: 'bullish' | 'bearish' | 'neutral' =
    macd.histogram > 0.5 ? 'bullish' : macd.histogram < -0.5 ? 'bearish' : 'neutral';

  // Support/Resistance
  const levels = findSupportResistance(candles, stock.ltp);

  const result: ScannerResult = {
    stock,
    signal: null,
    momentumScore,
    relativeStrength: Math.min(100, Math.max(0, relativeStrength)),
    volumeScore,
    trendScore,
    oiScore,
    sectorScore,
    compositeScore,
    levels,
    vwap,
    ema9,
    ema20,
    rsi,
    atr,
    macdSignal,
  };

  // Generate trade signal
  result.signal = generateTradeSignal(result);

  return result;
}

export function getStockCandles(symbol: string): CandleData[] {
  const cached = stockCache.get(symbol);
  return cached?.candles || [];
}

export function generateMarketBreadth(results: ScannerResult[]): MarketBreadth {
  const advancing = results.filter(r => r.stock.changePct > 0).length;
  const declining = results.filter(r => r.stock.changePct < 0).length;
  const unchanged = results.length - advancing - declining;
  const totalVolume = results.reduce((a, r) => a + r.stock.volume, 0);
  const putCallRatio = 0.7 + Math.random() * 0.6;
  const vixLevel = 12 + Math.random() * 8;

  return {
    advancing,
    declining,
    unchanged,
    totalVolume,
    putCallRatio: Math.round(putCallRatio * 100) / 100,
    vixLevel: Math.round(vixLevel * 100) / 100,
    marketTrend: advancing > declining * 1.2 ? 'bullish' :
      declining > advancing * 1.2 ? 'bearish' : 'neutral',
  };
}

export function generateSectorData(results: ScannerResult[]): SectorData[] {
  const sectorMap = new Map<string, ScannerResult[]>();
  for (const r of results) {
    const existing = sectorMap.get(r.stock.sector) || [];
    existing.push(r);
    sectorMap.set(r.stock.sector, existing);
  }

  return [...sectorMap.entries()].map(([name, stocks]) => {
    const avgChange = stocks.reduce((a, s) => a + s.stock.changePct, 0) / stocks.length;
    const avgMomentum = stocks.reduce((a, s) => a + s.momentumScore, 0) / stocks.length;
    return {
      name,
      change: Math.round(avgChange * 100) / 100,
      stocks: stocks.map(s => s.stock.symbol),
      avgMomentum: Math.round(avgMomentum),
      moneyFlow: avgChange > 0.5 ? 'inflow' as const :
        avgChange < -0.5 ? 'outflow' as const : 'neutral' as const,
    };
  }).sort((a, b) => b.change - a.change);
}
