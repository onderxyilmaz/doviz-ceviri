import { useState, useEffect, useCallback } from "react";

const APIS = [
  (s, e, base) => `https://api.frankfurter.dev/v1/${s}..${e}?base=${base}&symbols=TRY`,
  (s, e, base) => `https://api.frankfurter.app/${s}..${e}?from=${base}&to=TRY`,
];

const CURRENCY_COLORS = [
  "#38bdf8", "#c084fc", "#34d399", "#fbbf24", "#fb7185", 
  "#60a5fa", "#a78bfa", "#2dd4bf", "#f59e0b", "#ec4899"
];

async function fetchCurrencies() {
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/currencies");
    if (r.ok) return r.json();
  } catch {}
  return null;
}

async function apiFetch(start, end, base) {
  for (const mkUrl of APIS) {
    try {
      const r = await fetch(mkUrl(start, end, base));
      if (r.ok) return r.json();
    } catch {}
  }
  throw new Error("API bağlantısı kurulamadı");
}

async function fetchLatestRate(from, to) {
  try {
    // Önce latest endpoint'ini dene (gerçek zamanlı)
    const r = await fetch(`https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}`);
    if (r.ok) {
      const data = await r.json();
      return data.rates?.[to] || null;
    }
    // Eğer latest çalışmazsa bugünün tarihini kullan
    const today = fmt(new Date());
    const r2 = await fetch(`https://api.frankfurter.dev/v1/${today}?from=${from}&to=${to}`);
    if (r2.ok) {
      const data = await r2.json();
      return data.rates?.[to] || null;
    }
  } catch {}
  return null;
}

async function fetchLatestRates(currencies) {
  try {
    const rates = {};
    await Promise.all(currencies.map(async (code) => {
      const rate = await fetchLatestRate(code, "TRY");
      if (rate !== null) {
        rates[code] = rate;
      }
    }));
    return rates;
  } catch {}
  return {};
}

function fmt(d) { return d.toISOString().split("T")[0]; }
function ago(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function pd(s) { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); }

export default function App() {
  const [start, setStart] = useState(fmt(ago(30)));
  const [end, setEnd] = useState(fmt(ago(1)));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortCol, setSortCol] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [hov, setHov] = useState(null);
  const [ready, setReady] = useState(false);
  const [currencies, setCurrencies] = useState({});
  const [selectedCurrencies, setSelectedCurrencies] = useState(["USD", "EUR"]);
  const [showCurrencySelect, setShowCurrencySelect] = useState(false);
  const [convertAmount, setConvertAmount] = useState("");
  const [convertFrom, setConvertFrom] = useState("USD");
  const [convertTo, setConvertTo] = useState("TRY");
  const [convertRate, setConvertRate] = useState(null);
  const [convertLoading, setConvertLoading] = useState(false);
  const [liveRates, setLiveRates] = useState({});

  useEffect(() => { 
    setReady(true);
    fetchCurrencies().then(data => {
      if (data) setCurrencies(data);
    });
    
    // Live kur değerlerini yükle ve periyodik olarak güncelle
    const updateLiveRates = async () => {
      if (selectedCurrencies.length > 0) {
        const rates = await fetchLatestRates(selectedCurrencies);
        setLiveRates(rates);
      }
    };
    
    updateLiveRates();
    const interval = setInterval(updateLiveRates, 30000); // Her 30 saniyede bir güncelle
    
    return () => clearInterval(interval);
  }, [selectedCurrencies]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showCurrencySelect && !e.target.closest('[data-currency-selector]')) {
        setShowCurrencySelect(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCurrencySelect]);

  const load = useCallback(async () => {
    if (selectedCurrencies.length === 0) {
      setError("En az bir para birimi seçmelisiniz");
      return;
    }
    setLoading(true); setError(null);
    try {
      const results = await Promise.all(selectedCurrencies.map(base => apiFetch(start, end, base)));
      const rateMaps = {};
      selectedCurrencies.forEach((base, i) => {
        rateMaps[base] = {};
        for (const [d, v] of Object.entries(results[i].rates || {})) {
          rateMaps[base][d] = v.TRY;
        }
      });
      const dates = [...new Set(selectedCurrencies.flatMap(base => Object.keys(rateMaps[base])))].sort();
      const merged = dates.filter(d => selectedCurrencies.every(base => rateMaps[base][d])).map(d => {
        const row = { date: d };
        selectedCurrencies.forEach(base => {
          row[base.toLowerCase()] = rateMaps[base][d];
        });
        return row;
      });
      if (!merged.length) throw new Error("Seçilen aralıkta veri bulunamadı");
      setRows(merged);
      setSortCol("date");
      setSortDir("desc");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [start, end, selectedCurrencies]);

  useEffect(() => { 
    if (selectedCurrencies.length > 0) {
      load(); 
    }
  }, [load]);

  useEffect(() => {
    const updateConvertRate = async () => {
      if (convertFrom && convertTo && convertFrom !== convertTo) {
        setConvertLoading(true);
        const rate = await fetchLatestRate(convertFrom, convertTo);
        setConvertRate(rate);
        setConvertLoading(false);
      } else if (convertFrom === convertTo) {
        setConvertRate(1);
        setConvertLoading(false);
      }
    };
    updateConvertRate();
  }, [convertFrom, convertTo]);

  const toggleCurrency = (code) => {
    if (selectedCurrencies.includes(code)) {
      if (selectedCurrencies.length > 1) {
        setSelectedCurrencies(selectedCurrencies.filter(c => c !== code));
      }
    } else {
      if (selectedCurrencies.length < 10) {
        setSelectedCurrencies([...selectedCurrencies, code]);
      }
    }
  };

  const sorted = [...rows].sort((a, b) => {
    const va = sortCol === "date" ? a.date : a[sortCol];
    const vb = sortCol === "date" ? b.date : b[sortCol];
    return sortDir === "asc" ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
  });

  const toggle = c => {
    if (sortCol === c) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(c); setSortDir("asc"); }
  };

  const last = rows.length ? rows[rows.length - 1] : null;
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  const first = rows.length ? rows[0] : null;
  
  const currencyData = selectedCurrencies.map((code, idx) => {
    const key = code.toLowerCase();
    // Live kur değerini kullan, yoksa tarih aralığındaki en son değeri kullan
    const liveVal = liveRates[code] != null ? liveRates[code] : null;
    const lastVal = last && last[key] != null ? last[key] : null;
    const currentVal = liveVal != null ? liveVal : (lastVal != null ? lastVal : null);
    const prevVal = prev && prev[key] != null ? prev[key] : null;
    const firstVal = first && first[key] != null ? first[key] : null;
    // Değişim hesaplaması: live varsa prevVal ile, yoksa lastVal ile prevVal karşılaştır
    const change = currentVal != null && prevVal != null ? ((currentVal - prevVal) / prevVal) * 100 : 0;
    const periodChange = currentVal != null && firstVal != null ? ((currentVal - firstVal) / firstVal) * 100 : 0;
    const validValues = rows.length ? rows.map(r => r[key]).filter(v => v != null && typeof v === 'number' && !isNaN(v)) : [];
    const min = validValues.length > 0 ? Math.min(...validValues) : 0;
    const max = validValues.length > 0 ? Math.max(...validValues) : 0;
    const data = rows.map(r => r[key]).filter(v => v != null);
    return {
      code,
      label: `${code} / TRY`,
      value: currentVal != null ? currentVal : 0,
      change,
      periodChange,
      min,
      max,
      data,
      color: CURRENCY_COLORS[idx % CURRENCY_COLORS.length],
      isLive: liveVal != null
    };
  });

  function Spark({ data, color, w = 180, h = 48 }) {
    if (data.length < 2) return null;
    const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / rng) * (h - 8) - 4}`).join(" ");
    const gid = `g${color.slice(1)}`;
    const ly = h - ((data[data.length - 1] - mn) / rng) * (h - 8) - 4;
    return (
      <svg width={w} height={h} style={{ display: "block", marginTop: 6 }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".25"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
        <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`}/>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={w} cy={ly} r="3.5" fill={color}/>
        <circle cx={w} cy={ly} r="7" fill={color} opacity=".12"/>
      </svg>
    );
  }

  const Chg = ({ v, sz = 12 }) => <span style={{ color: v >= 0 ? "#fb7185" : "#34d399", fontSize: sz, fontWeight: 600 }}>{v >= 0 ? "▲" : "▼"} %{Math.abs(v).toFixed(3)}</span>;

  const trD = s => {
    const d = pd(s);
    const ms = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
    const ds = ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"];
    return `${d.getDate().toString().padStart(2,"0")} ${ms[d.getMonth()]}, ${ds[d.getDay()]}`;
  };

  // Quick presets
  const presets = [
    { label: "7G", days: 7 },
    { label: "30G", days: 30 },
    { label: "90G", days: 90 },
    { label: "180G", days: 180 },
    { label: "1Y", days: 365 },
  ];
  const applyPreset = days => {
    setStart(fmt(ago(days)));
    setEnd(fmt(ago(1)));
  };

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
        @keyframes fu{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes p{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes si{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sp{to{transform:rotate(360deg)}}
        @keyframes sk{0%{background-position:-200% 0}100%{background-position:200% 0}}
        body{background:#06080f}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(.6)}
        select{background:rgba(255,255,255,.04)!important;color:#e2e8f0!important;appearance:none;-webkit-appearance:none;-moz-appearance:none}
        select option{background:#0f172a!important;color:#e2e8f0!important;padding:8px}
        select:focus{outline:none;border-color:rgba(56,189,248,.3)!important}
        .cards-converter-container{display:flex;gap:16px;margin-bottom:16px;align-items:flex-start}
        .currency-cards-grid{display:grid;gap:12px;flex:1;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
        .currency-converter-box{width:25%;flex-shrink:0}
        @media (max-width: 1024px){
          .cards-converter-container{flex-direction:column!important}
          .currency-converter-box{width:100%!important;max-width:100%!important}
        }
        @media (min-width: 481px) and (max-width: 1024px){
          .currency-cards-grid{grid-template-columns:repeat(2,1fr)!important}
        }
        @media (max-width: 480px){
          .currency-cards-grid{grid-template-columns:1fr!important}
          .currency-converter-box{padding:12px!important}
          .converter-row{flex-direction:column!important;gap:8px!important;align-items:stretch!important}
          .convert-input,.convert-result{flex:1 1 100%!important;min-width:100%!important;max-width:100%!important;width:100%!important;box-sizing:border-box!important}
          .convert-select{flex:1 1 100%!important;min-width:100%!important;max-width:100%!important;width:100%!important;font-size:12px!important;padding:8px 10px!important;box-sizing:border-box!important}
          .convert-swap-btn{width:100%!important;height:40px!important;margin:0!important;order:2!important}
          .convert-spacer{display:none!important}
          body > #root{padding:12px 12px!important}
          .currency-converter-box h3{font-size:13px!important;margin-bottom:10px!important}
        }
      `}</style>

      {/* HEADER */}
      <div style={{ ...S.hdr, animation: ready ? "fu .45s ease both" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={S.icon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: -.6 }}>
              Döviz Kurları <span style={{ background: "linear-gradient(135deg, #38bdf8, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontWeight: 800 }}>by Onder</span>
            </h1>
            <p style={{ fontSize: 12, color: "#4b5563", marginTop: 1 }}>
              Kur → TRY canlı takip
            </p>
          </div>
        </div>
        <div style={S.badge}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", animation: "p 2s infinite" }}/>
          <span style={{ fontSize: 11, color: "#64748b" }}>Frankfurter API</span>
        </div>
      </div>

      {/* CARDS AND CURRENCY CONVERTER */}
      <div className="cards-converter-container">
        {/* CARDS */}
        {rows.length > 0 && currencyData.length > 0 && (
          <div className="currency-cards-grid" style={{ animation: ready ? "fu .55s ease .1s both" : "none" }}>
            {currencyData.filter(c => c.value != null && c.value > 0).map((c, i) => (
              <div key={c.code} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={S.clbl}>{c.label}</span>
                    {c.isLive && (
                      <span style={{ fontSize: 8, color: "#4ade80", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
                        ● LIVE
                      </span>
                    )}
                  </div>
                  <Chg v={c.change}/>
                </div>
                <div style={S.cval}>{typeof c.value === 'number' ? c.value.toFixed(4) : '0.0000'}</div>
                <Spark data={c.data} color={c.color}/>
                <div style={S.cbot}>
                  <span style={{ color: "#34d399" }}>↓ {typeof c.min === 'number' ? c.min.toFixed(4) : '0.0000'}</span>
                  <span style={{ color: "#64748b", fontSize: 10 }}>{c.periodChange >= 0 ? "+" : ""}{typeof c.periodChange === 'number' ? c.periodChange.toFixed(2) : '0.00'}%</span>
                  <span style={{ color: "#fb7185" }}>↑ {typeof c.max === 'number' ? c.max.toFixed(4) : '0.0000'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CURRENCY CONVERTER */}
        <div className="currency-converter-box" style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)", borderRadius: 12, padding: 16, flexShrink: 0, animation: ready ? "fu .48s ease .06s both" : "none" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 12, letterSpacing: 0.5 }}>Döviz Çeviri</h3>
        <div className="converter-fields" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* FROM */}
          <div className="converter-row" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="number"
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
              placeholder="Miktar"
              className="convert-input"
              style={{
                ...S.di,
                flex: "1 1 120px",
                minWidth: 0,
                fontSize: 14,
                padding: "10px 12px",
                fontFamily: "'JetBrains Mono',monospace"
              }}
            />
            <select
              value={convertFrom}
              onChange={(e) => setConvertFrom(e.target.value)}
              className="convert-select"
              style={{
                ...S.di,
                fontSize: 13,
                padding: "10px 12px",
                cursor: "pointer",
                minWidth: 80,
                maxWidth: 120,
                color: "#e2e8f0",
                background: "rgba(255,255,255,.04)"
              }}
            >
              {Object.keys(currencies).filter(c => c !== "TRY").map(code => (
                <option key={code} value={code} style={{ background: "#0f172a", color: "#e2e8f0" }}>{code}</option>
              ))}
            </select>
            {/* ARROW */}
            <button
              onClick={() => {
                const temp = convertFrom;
                setConvertFrom(convertTo);
                setConvertTo(temp);
              }}
              className="convert-swap-btn"
              style={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center",
                cursor: "pointer",
                padding: "8px",
                borderRadius: 8,
                transition: "all .2s",
                width: "50px",
                height: "42px",
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.1)",
                color: "#94a3b8",
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(56,189,248,.12)";
                e.currentTarget.style.borderColor = "rgba(56,189,248,.3)";
                e.currentTarget.style.color = "#7dd3fc";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,.04)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,.1)";
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="3" x2="12" y2="21"/>
                <polyline points="8 7 12 3 16 7"/>
                <polyline points="8 17 12 21 16 17"/>
              </svg>
            </button>
          </div>

          {/* TO */}
          <div className="converter-row" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div className="convert-result" style={{
              flex: "1 1 120px",
              minWidth: 0,
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 8,
              padding: "10px 12px",
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 14,
              color: convertLoading ? "#64748b" : "#e2e8f0",
              minHeight: 42,
              display: "flex",
              alignItems: "center"
            }}>
              {convertLoading ? (
                <span style={{ fontSize: 12, color: "#64748b" }}>Yükleniyor...</span>
              ) : convertAmount && convertRate !== null ? (
                (parseFloat(convertAmount) * convertRate).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
              ) : (
                <span style={{ color: "#64748b" }}>0.00</span>
              )}
            </div>
            <select
              value={convertTo}
              onChange={(e) => setConvertTo(e.target.value)}
              className="convert-select"
              style={{
                ...S.di,
                fontSize: 13,
                padding: "10px 12px",
                cursor: "pointer",
                minWidth: 80,
                maxWidth: 120,
                color: "#e2e8f0",
                background: "rgba(255,255,255,.04)"
              }}
            >
              {Object.keys(currencies).map(code => (
                <option key={code} value={code} style={{ background: "#0f172a", color: "#e2e8f0" }}>{code}</option>
              ))}
            </select>
            <div className="convert-spacer" style={{ width: "50px", flexShrink: 0 }}></div>
          </div>
        </div>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div style={S.err}>
          <span>⚠️ {error}</span>
          <button onClick={load} style={{ background: "none", border: "1px solid rgba(251,113,133,.3)", color: "#fda4af", borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer", marginLeft: 10 }}>Tekrar Dene</button>
        </div>
      )}

      {/* TABLE */}
      <div style={{ ...S.tw, animation: ready ? "fu .6s ease .15s both" : "none", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* TABLE HEADER WITH CONTROLS AND CURRENCY SELECTOR */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px 8px 12px", position: "relative", gap: 12, flexWrap: "wrap" }}>
          {/* LEFT SIDE: DATE CONTROLS AND PRESETS */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", flex: 1 }}>
            <div style={S.dg}>
              <label style={S.dl}>Başlangıç</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} style={S.di}/>
            </div>
            <span style={{ color: "#334155", fontSize: 18, paddingBottom: 7 }}>→</span>
            <div style={S.dg}>
              <label style={S.dl}>Bitiş</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={S.di}/>
            </div>
            <button onClick={load} disabled={loading} style={{ ...S.btn, opacity: loading ? .6 : 1 }}>
              {loading
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: "sp .8s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#0f172a" strokeWidth="3" fill="none" strokeDasharray="32" strokeLinecap="round"/></svg>
                    Yükleniyor…
                  </span>
                : <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    Güncelle
                  </span>
              }
            </button>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {presets.map(p => (
                <button key={p.days} onClick={() => applyPreset(p.days)} style={{
                  ...S.preset,
                  background: start === fmt(ago(p.days)) ? "rgba(56,189,248,.12)" : "rgba(255,255,255,.03)",
                  borderColor: start === fmt(ago(p.days)) ? "rgba(56,189,248,.3)" : "rgba(255,255,255,.06)",
                  color: start === fmt(ago(p.days)) ? "#7dd3fc" : "#64748b",
                }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* RIGHT SIDE: CURRENCY SELECTOR */}
          <div data-currency-selector style={{ position: "relative", zIndex: 10000 }}>
            <button 
              onClick={() => setShowCurrencySelect(!showCurrencySelect)}
              style={{
                ...S.currencyBtn,
                background: showCurrencySelect ? "rgba(192,132,252,.15)" : "rgba(192,132,252,.08)",
                borderColor: showCurrencySelect ? "rgba(192,132,252,.4)" : "rgba(192,132,252,.2)",
                color: showCurrencySelect ? "#c084fc" : "#a78bfa",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Para Birimleri Seç ({selectedCurrencies.length}/10)
              </span>
            </button>
            {showCurrencySelect && (
              <>
                <div 
                  style={{ 
                    position: "fixed", 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    background: "rgba(0,0,0,.3)", 
                    zIndex: 9999,
                    backdropFilter: "blur(2px)"
                  }} 
                  onClick={() => setShowCurrencySelect(false)}
                />
                <div data-currency-selector style={S.currencyDropdown}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                    {selectedCurrencies.length === 10 ? "Maksimum 10 kur seçildi" : `${10 - selectedCurrencies.length} kur daha seçebilirsiniz`}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                    {Object.entries(currencies).filter(([code]) => code !== "TRY").map(([code, name]) => {
                      const isSelected = selectedCurrencies.includes(code);
                      const isDisabled = !isSelected && selectedCurrencies.length >= 10;
                      return (
                        <button
                          key={code}
                          onClick={() => !isDisabled && toggleCurrency(code)}
                          disabled={isDisabled}
                          style={{
                            ...S.currencyItem,
                            background: isSelected ? "rgba(56,189,248,.12)" : "rgba(255,255,255,.02)",
                            borderColor: isSelected ? "rgba(56,189,248,.3)" : "rgba(255,255,255,.06)",
                            color: isSelected ? "#7dd3fc" : isDisabled ? "#334155" : "#94a3b8",
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            opacity: isDisabled ? 0.4 : 1,
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{code}</span>
                          <span style={{ fontSize: 10, color: isSelected ? "#7dd3fc" : "#64748b" }}>{name}</span>
                          {isSelected && <span style={{ fontSize: 10, color: "#7dd3fc" }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {loading && !rows.length ? (

          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: 16 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: `1.2fr repeat(${selectedCurrencies.length}, 1fr)`, gap: 10, marginBottom: 8 }}>
                {[0, ...selectedCurrencies.map((_, j) => j + 1)].map(j => <div key={j} style={{ height: 18, borderRadius: 6, background: "linear-gradient(90deg,rgba(255,255,255,.03) 25%,rgba(255,255,255,.06) 50%,rgba(255,255,255,.03) 75%)", backgroundSize: "200% 100%", animation: `sk 1.5s infinite ${i * .06}s` }}/>)}
              </div>
            ))}
          </div>
        ) : rows.length > 0 ? (
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, overflowX: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    {k:"date",l:"Tarih",a:"left"},
                    ...selectedCurrencies.map(code => ({k:code.toLowerCase(),l:`${code} / TRY`,a:"right"}))
                  ].map(c => (
                    <th key={c.k} onClick={() => toggle(c.k)} style={{ ...S.th, textAlign: c.a }}>
                      {c.l}
                      {sortCol === c.k ? <span style={{ marginLeft: 4, fontSize: 9 }}>{sortDir === "asc" ? "↑" : "↓"}</span> : <span style={{ marginLeft: 4, fontSize: 9, opacity: .2 }}>⇅</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const p = i > 0 ? sorted[i - 1] : null;
                  return (
                    <tr key={r.date} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                      style={{ background: hov === i ? "rgba(56,189,248,.04)" : "transparent", borderBottom: "1px solid rgba(255,255,255,.025)", transition: "background .1s", animation: ready ? `si .22s ease ${i * .015}s both` : "none" }}>
                      <td style={{ padding: "10px 18px", fontSize: 12.5, fontWeight: 500, color: "#94a3b8", whiteSpace: "nowrap" }}>{trD(r.date)}</td>
                      {selectedCurrencies.map((code, idx) => {
                        const key = code.toLowerCase();
                        const val = r[key];
                        const prevVal = p && p[key] != null ? p[key] : null;
                        const isUp = prevVal !== null && val != null ? val > prevVal : null;
                        const color = CURRENCY_COLORS[idx % CURRENCY_COLORS.length];
                        return (
                          <td key={code} style={S.tdn}>
                            <span style={{ color }}>{val != null && typeof val === 'number' ? val.toFixed(4) : '0.0000'}</span>
                            {isUp !== null && <span style={{ fontSize: 9, marginLeft: 5, color: isUp ? "#fb7185" : "#34d399", opacity: .7 }}>{isUp ? "▲" : "▼"}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : !loading && !error && (
          <div style={{ padding: 40, textAlign: "center", color: "#475569", fontSize: 13 }}>Tarih aralığı seçip Güncelle'ye basın</div>
        )}
      </div>

      {rows.length > 0 && (
        <p style={{ textAlign: "center", fontSize: 11, color: "#ffffff", marginTop: 12, marginBottom: 0, letterSpacing: .3, flexShrink: 0 }}>
          {rows.length} iş günü gösteriliyor · {trD(rows[0].date)} – {trD(rows[rows.length - 1].date)}
        </p>
      )}
    </div>
  );
}

const S = {
  root: { fontFamily: "'DM Sans',sans-serif", background: "linear-gradient(170deg,#06080f 0%,#0c1322 40%,#0f172a 100%)", height: "100vh", color: "#e2e8f0", padding: "20px 32px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", overflow: "hidden" },
  hdr: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 },
  icon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,rgba(56,189,248,.12),rgba(192,132,252,.12))", border: "1px solid rgba(56,189,248,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  badge: { display: "flex", alignItems: "center", gap: 6, background: "rgba(74,222,128,.05)", border: "1px solid rgba(74,222,128,.1)", borderRadius: 20, padding: "4px 12px" },
  ctrl: { display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 8, flexWrap: "wrap" },
  dg: { display: "flex", flexDirection: "column", gap: 3 },
  dl: { fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1 },
  di: { fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, color: "#e2e8f0", padding: "8px 10px", outline: "none", colorScheme: "dark" },
  btn: { fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, fontWeight: 600, background: "linear-gradient(135deg,#38bdf8,#818cf8)", color: "#0f172a", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 },
  preset: { fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, border: "1px solid", borderRadius: 8, padding: "5px 12px", cursor: "pointer", transition: "all .15s" },
  currencyBtn: { fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, border: "1px solid", borderRadius: 8, padding: "8px 14px", cursor: "pointer", transition: "all .15s", color: "#94a3b8", background: "rgba(255,255,255,.03)" },
  currencyDropdown: { position: "absolute", top: "100%", right: 0, marginTop: 8, background: "rgba(6,8,15,1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 12, padding: 16, zIndex: 10001, backdropFilter: "blur(16px)", boxShadow: "0 12px 48px rgba(0,0,0,.8)", minWidth: 400, maxWidth: 600 },
  currencyItem: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "8px 10px", borderRadius: 8, border: "1px solid", transition: "all .15s", textAlign: "left" },
  err: { background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.15)", borderRadius: 12, padding: "10px 16px", marginBottom: 16, fontSize: 12.5, color: "#fca5a5", display: "flex", alignItems: "center" },
  card: { background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)", borderRadius: 16, padding: "16px 18px 12px" },
  clbl: { fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1.2 },
  cval: { fontFamily: "'JetBrains Mono',monospace", fontSize: 26, fontWeight: 600, color: "#f8fafc", letterSpacing: -1.5, marginTop: 2 },
  cbot: { display: "flex", justifyContent: "space-between", fontSize: 10.5, marginTop: 8, fontFamily: "'JetBrains Mono',monospace", color: "#475569" },
  tw: { background: "rgba(255,255,255,.012)", border: "1px solid rgba(255,255,255,.04)", borderRadius: 16, flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" },
  th: { position: "sticky", top: 0, background: "rgba(12,19,34,.97)", backdropFilter: "blur(12px)", padding: "13px 18px", fontSize: 13, fontWeight: 700, color: "#ffffff", textTransform: "uppercase", letterSpacing: 1.2, borderBottom: "1px solid rgba(255,255,255,.04)", zIndex: 2, cursor: "pointer", userSelect: "none" },
  tdn: { padding: "10px 18px", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 500, textAlign: "right" },
};