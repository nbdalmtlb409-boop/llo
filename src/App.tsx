import React, { useState, useEffect } from 'react';
import { Play, Square, Settings, Activity, AlertTriangle, Wallet, TrendingUp, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function App() {
  const [state, setState] = useState<any>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [allocatedCapital, setAllocatedCapital] = useState(35);
  const [tpPercent, setTpPercent] = useState(2);
  const [slPercent, setSlPercent] = useState(1);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('/api/state');
        const data = await res.json();
        setState(data);
      } catch (e) {
        console.error("Failed to fetch state", e);
      }
    };
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const res = await fetch('https://fapi.binance.com/fapi/v1/klines?symbol=BNBUSDT&interval=15m&limit=50');
        const data = await res.json();
        const formatted = data.map((k: any) => ({
          time: new Date(k[0]).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          price: parseFloat(k[4])
        }));
        setChartData(formatted);
      } catch (e) {
        console.error("Failed to fetch chart data", e);
      }
    };
    fetchChartData();
    const interval = setInterval(fetchChartData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveConfig = async () => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, apiSecret, allocatedCapital, tpPercent, slPercent })
      });
      alert('تم حفظ الإعدادات بنجاح');
      setApiKey(''); // Clear security fields
      setApiSecret('');
    } catch (e) {
      alert('فشل في حفظ الإعدادات');
    }
  };

  const handleStart = async () => {
    try {
      const res = await fetch('/api/start', { method: 'POST' });
      const data = await res.json();
      if (data.error) alert(data.error);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStop = async () => {
    try {
      await fetch('/api/stop', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  if (!state) return <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 font-sans" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="text-emerald-500" />
              بوت تداول Binance الآلي (BNB/USDT)
            </h1>
            <p className="text-zinc-400 text-sm mt-1">يعمل على العقود الآجلة (USDT-M) باستراتيجية EMA200/MACD/RSI</p>
          </div>
          <div className="flex items-center gap-3">
            {state.isRunning ? (
              <button onClick={handleStop} className="flex items-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 px-4 py-2 rounded-lg transition-colors border border-red-500/20">
                <Square size={18} /> إيقاف البوت
              </button>
            ) : (
              <button onClick={handleStart} className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-4 py-2 rounded-lg transition-colors border border-emerald-500/20">
                <Play size={18} /> تشغيل البوت
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Config & Status */}
          <div className="space-y-6">
            
            {/* Warning */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="text-amber-500 shrink-0" />
              <div className="text-sm text-amber-200/80">
                <p className="font-semibold text-amber-500 mb-1">تنبيه هام</p>
                هذا البوت حقيقي وسيقوم بتنفيذ صفقات حقيقية على حسابك في العقود الآجلة. يجب أن يكون الرصيد في محفظة (USDT-M Futures). لا تحتاج لإدخال مفتاح Gemini API، المنصة تقوم بربطه تلقائياً.
              </div>
            </div>

            {/* Config Panel */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings size={20} className="text-zinc-400" />
                إعدادات البوت
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">مفتاح API (Binance)</label>
                  <input 
                    type="password" 
                    value={apiKey} 
                    onChange={e => setApiKey(e.target.value)} 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" 
                    placeholder={state.apiKey ? 'تم الحفظ (أدخل لتحديثه)' : 'أدخل مفتاح API'} 
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">الرمز السري (API Secret)</label>
                  <input 
                    type="password" 
                    value={apiSecret} 
                    onChange={e => setApiSecret(e.target.value)} 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" 
                    placeholder={state.apiSecret ? 'تم الحفظ (أدخل لتحديثه)' : 'أدخل الرمز السري'} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">رأس المال المخصص ($)</label>
                    <input type="number" value={allocatedCapital} onChange={e => setAllocatedCapital(Number(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">الرافعة المالية</label>
                    <input type="text" value="5x (ثابتة)" disabled className="w-full bg-zinc-950/50 border border-zinc-800/50 text-zinc-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">جني الأرباح (%)</label>
                    <input type="number" step="0.1" value={tpPercent} onChange={e => setTpPercent(Number(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">إيقاف الخسارة (%)</label>
                    <input type="number" step="0.1" value={slPercent} onChange={e => setSlPercent(Number(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>
                <button onClick={handleSaveConfig} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-sm transition-colors mt-2">
                  حفظ الإعدادات
                </button>
              </div>
            </div>

            {/* Status Panel */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity size={20} className="text-zinc-400" />
                حالة السوق والمؤشرات
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                  <span className="text-zinc-400 text-sm">السعر الحالي (BNB)</span>
                  <span className="font-mono text-lg text-emerald-400">${state.currentPrice?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <span className="block text-xs text-zinc-500 mb-1">EMA 200</span>
                    <span className={`font-mono text-sm ${state.currentPrice > state.indicators.ema200 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {state.indicators.ema200?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <span className="block text-xs text-zinc-500 mb-1">RSI (14)</span>
                    <span className={`font-mono text-sm ${(state.indicators.rsi > 40 && state.indicators.rsi < 70) ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {state.indicators.rsi?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <span className="block text-xs text-zinc-500 mb-1">MACD</span>
                    <span className="font-mono text-sm text-zinc-300">
                      {state.indicators.macd?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <span className="block text-xs text-zinc-500 mb-1">Upper BB</span>
                    <span className="font-mono text-sm text-zinc-300">
                      {state.indicators.upperBB?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Chart & Logs */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Chart */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-[300px] flex flex-col">
              <h2 className="text-lg font-semibold mb-4">مخطط السعر (15 دقيقة)</h2>
              <div className="w-full h-[200px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="time" stroke="#52525b" fontSize={12} tickMargin={10} />
                    <YAxis domain={['auto', 'auto']} stroke="#52525b" fontSize={12} width={60} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                      itemStyle={{ color: '#10b981' }}
                    />
                    <Line type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Position & Gemini */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Wallet size={20} className="text-zinc-400" />
                  الصفقة الحالية
                </h2>
                {state.position ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">الكمية:</span>
                      <span className="font-mono">{state.position.amt} BNB</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">سعر الدخول:</span>
                      <span className="font-mono">${state.position.entry.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">الربح/الخسارة:</span>
                      <span className={`font-mono ${parseFloat(state.position.unRealizedProfit) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ${parseFloat(state.position.unRealizedProfit).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-zinc-500 py-6 text-sm">
                    لا توجد صفقات مفتوحة حالياً
                  </div>
                )}
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Info size={20} className="text-blue-400" />
                  تحليل Gemini 2.5 Flash
                </h2>
                <div className="text-sm text-zinc-300 leading-relaxed">
                  {state.geminiAnalysis ? (
                    <p>{state.geminiAnalysis}</p>
                  ) : (
                    <p className="text-zinc-500 italic">سيتم عرض تحليل الذكاء الاصطناعي هنا عند فتح صفقة جديدة...</p>
                  )}
                </div>
              </div>
            </div>

            {/* Logs */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-4">سجل العمليات (Logs)</h2>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 h-[200px] overflow-y-auto font-mono text-xs space-y-2" dir="ltr">
                {state.logs.length > 0 ? (
                  state.logs.map((log: string, i: number) => (
                    <div key={i} className="text-zinc-400 border-b border-zinc-800/50 pb-1 last:border-0">
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-600 text-center mt-10">لا توجد سجلات بعد...</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
