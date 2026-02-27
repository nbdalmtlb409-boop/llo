import express from 'express';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import axios from 'axios';
import { EMA, MACD, RSI, BollingerBands } from 'technicalindicators';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(express.json());

const BINANCE_FAPI = 'https://fapi.binance.com';

let botState = {
    isRunning: false,
    apiKey: '',
    apiSecret: '',
    allocatedCapital: 35,
    tpPercent: 2,
    slPercent: 1,
    logs: [] as string[],
    currentPrice: 0,
    indicators: {
        ema200: 0,
        macd: 0,
        macdSignal: 0,
        rsi: 0,
        upperBB: 0
    },
    position: null as any,
    geminiAnalysis: ''
};

function log(msg: string) {
    const time = new Date().toLocaleTimeString('ar-EG');
    botState.logs.unshift(`[${time}] ${msg}`);
    if (botState.logs.length > 50) botState.logs.pop();
    console.log(msg);
}

function getSignature(queryString: string, secret: string) {
    return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

async function binanceRequest(method: 'GET' | 'POST' | 'DELETE', endpoint: string, params: any = {}) {
    if (!botState.apiKey || !botState.apiSecret) throw new Error('API Keys not set');
    
    params.timestamp = Date.now();
    params.recvWindow = 5000;
    const queryString = Object.keys(params).map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
    const signature = getSignature(queryString, botState.apiSecret);
    const url = `${BINANCE_FAPI}${endpoint}?${queryString}&signature=${signature}`;
    
    const response = await axios({
        method,
        url,
        headers: { 'X-MBX-APIKEY': botState.apiKey }
    });
    return response.data;
}

let loopInterval: any = null;

async function runBotLoop() {
    if (!botState.isRunning) return;
    try {
        // 1. Fetch Klines (15m timeframe)
        const klinesRes = await axios.get(`${BINANCE_FAPI}/fapi/v1/klines?symbol=BNBUSDT&interval=15m&limit=250`);
        const closes = klinesRes.data.map((k: any) => parseFloat(k[4]));
        const currentPrice = closes[closes.length - 1];
        botState.currentPrice = currentPrice;

        // 2. Calculate Indicators
        const ema200 = EMA.calculate({ period: 200, values: closes });
        const macd = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
        const rsi = RSI.calculate({ values: closes, period: 14 });
        const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });

        const currentEma = ema200[ema200.length - 1];
        const currentMacd = macd[macd.length - 1];
        const prevMacd = macd[macd.length - 2];
        const currentRsi = rsi[rsi.length - 1];
        const currentBB = bb[bb.length - 1];

        botState.indicators = {
            ema200: currentEma || 0,
            macd: currentMacd?.MACD || 0,
            macdSignal: currentMacd?.signal || 0,
            rsi: currentRsi || 0,
            upperBB: currentBB?.upper || 0
        };

        // 3. Check Position
        let position = null;
        try {
            const positions = await binanceRequest('GET', '/fapi/v2/positionRisk', { symbol: 'BNBUSDT' });
            position = positions[0];
        } catch (e: any) {
            log(`خطأ في جلب بيانات الصفقة: ${e.message}`);
            return;
        }
        
        const posAmt = parseFloat(position.positionAmt);
        const entryPrice = parseFloat(position.entryPrice);
        
        botState.position = posAmt > 0 ? { amt: posAmt, entry: entryPrice, unRealizedProfit: position.unRealizedProfit } : null;

        if (posAmt > 0) {
            // Manage Exit
            const tpPrice = entryPrice * (1 + botState.tpPercent / 100);
            const slPrice = entryPrice * (1 - botState.slPercent / 100);
            
            if (currentPrice >= tpPrice || currentPrice >= currentBB.upper) {
                log(`تم تفعيل جني الأرباح! السعر: ${currentPrice}`);
                await closePosition(posAmt);
            } else if (currentPrice <= slPrice) {
                log(`تم تفعيل إيقاف الخسارة! السعر: ${currentPrice}`);
                await closePosition(posAmt);
            }
        } else {
            // Check Entry Conditions
            const isUptrend = currentPrice > currentEma;
            const isMacdCrossUp = prevMacd && currentMacd && prevMacd.MACD <= prevMacd.signal && currentMacd.MACD > currentMacd.signal;
            const isRsiValid = currentRsi > 40 && currentRsi < 70;

            if (isUptrend && isMacdCrossUp && isRsiValid) {
                log(`تحققت شروط الدخول! فتح صفقة شراء (Long) عند ${currentPrice}`);
                await openLongPosition(currentPrice);
            }
        }

    } catch (error: any) {
        log(`خطأ في حلقة البوت: ${error.message}`);
    }
}

async function closePosition(qty: number) {
    try {
        await binanceRequest('POST', '/fapi/v1/order', {
            symbol: 'BNBUSDT',
            side: 'SELL',
            type: 'MARKET',
            quantity: qty
        });
        log('تم إغلاق الصفقة بنجاح.');
    } catch (e: any) {
        log(`فشل في إغلاق الصفقة: ${e.message}`);
    }
}

async function openLongPosition(price: number) {
    try {
        // Set Leverage
        await binanceRequest('POST', '/fapi/v1/leverage', { symbol: 'BNBUSDT', leverage: 5 });
        
        // Calculate Qty
        // 20% of allocated capital
        const marginToUse = botState.allocatedCapital * 0.20;
        const positionSize = marginToUse * 5; // 5x leverage
        let qty = positionSize / price;
        
        // Format qty to Binance step size (BNB usually 2 decimals)
        qty = Math.floor(qty * 100) / 100;

        await binanceRequest('POST', '/fapi/v1/order', {
            symbol: 'BNBUSDT',
            side: 'BUY',
            type: 'MARKET',
            quantity: qty
        });
        log(`تم فتح صفقة شراء (Long): ${qty} BNB`);
        
        // Call Gemini for analysis
        analyzeWithGemini();
    } catch (e: any) {
        log(`فشل في فتح الصفقة: ${e.message}`);
    }
}

async function analyzeWithGemini() {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `أنت مساعد تداول عملات رقمية. البوت الخاص بي قام للتو بفتح صفقة شراء (Long) على زوج BNB/USDT.
        السعر الحالي: ${botState.currentPrice}
        المتوسط المتحرك 200 (EMA): ${botState.indicators.ema200}
        مؤشر القوة النسبية (RSI): ${botState.indicators.rsi}
        الماكد (MACD): ${botState.indicators.macd}
        
        قدم تحليلاً موجزاً جداً (جملتين كحد أقصى) لحالة السوق بناءً على هذه المؤشرات باللغة العربية.`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt
        });
        botState.geminiAnalysis = response.text || '';
        log(`تحليل Gemini: ${botState.geminiAnalysis}`);
    } catch (e: any) {
        console.error("Gemini error:", e);
    }
}

// API Routes
app.get('/api/state', (req, res) => {
    const { apiSecret, ...safeState } = botState;
    // We need to tell the frontend if the keys are set, without sending the actual keys
    const stateToSend = {
        ...safeState,
        apiKey: botState.apiKey ? 'SET' : '',
        apiSecret: botState.apiSecret ? 'SET' : ''
    };
    res.json(stateToSend);
});

app.post('/api/config', (req, res) => {
    const { apiKey, apiSecret, allocatedCapital, tpPercent, slPercent } = req.body;
    if (apiKey) botState.apiKey = apiKey;
    if (apiSecret) botState.apiSecret = apiSecret;
    if (allocatedCapital) botState.allocatedCapital = allocatedCapital;
    if (tpPercent) botState.tpPercent = tpPercent;
    if (slPercent) botState.slPercent = slPercent;
    res.json({ success: true });
});

app.post('/api/start', (req, res) => {
    if (!botState.apiKey || !botState.apiSecret) {
        return res.status(400).json({ error: 'يجب إدخال مفاتيح API أولاً' });
    }
    if (botState.isRunning) {
        return res.json({ success: true, message: 'البوت يعمل بالفعل' });
    }
    botState.isRunning = true;
    log('تم تشغيل البوت. جاري مراقبة السوق...');
    if (!loopInterval) {
        loopInterval = setInterval(runBotLoop, 15000); // 15 seconds
        runBotLoop(); // Run immediately
    }
    res.json({ success: true });
});

app.post('/api/stop', (req, res) => {
    botState.isRunning = false;
    if (loopInterval) {
        clearInterval(loopInterval);
        loopInterval = null;
    }
    log('تم إيقاف البوت.');
    res.json({ success: true });
});

async function startServer() {
    const PORT = 3000;

    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static('dist'));
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
