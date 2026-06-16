const sendMessage = require('../handles/sendMessage');
const axios = require('axios');

// ─── Groq ─────────────────────────────────────────────────────────────────────
const GROQ_API_KEY      = process.env.GROQ_API_KEY;
const GROQ_URL          = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL        = 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

// ─── Décoration visuelle ──────────────────────────────────────────────────────
const D = {
    top: '╔════════════════════════════════════╗',
    mid: '╠════════════════════════════════════╣',
    bot: '╚════════════════════════════════════╝',
    sep: '╠────────────────────────────────────╣',
    ln:  '║',
};
function pad(str, n) { return String(str).padEnd(n).slice(0, n); }
function row(label, value) {
    const line = `  ${label}: ${value}`;
    return `${D.ln}${pad(line, 37)}${D.ln}\n`;
}
function rowFull(text) {
    return `${D.ln}${pad('  ' + text, 37)}${D.ln}\n`;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const SCAN_ROUNDS   = 25;
const TARGET_MIN_X  = 5.0;
const MAX_HISTORY   = 60;
const ROUND_MIN_SEC = 20;
const ROUND_MAX_SEC = 38;

// ─── Stockage par utilisateur ─────────────────────────────────────────────────
const userStore = new Map();
function getStore(sid) {
    if (!userStore.has(sid)) {
        userStore.set(sid, { history: [], calibration: 1.0, awaitingResult: null, groqMessages: [] });
    }
    const s = userStore.get(sid);
    if (!s.groqMessages) s.groqMessages = [];
    return s;
}

// ─── Hash ─────────────────────────────────────────────────────────────────────
function fnv32(v) {
    let h = 0x811c9dc5 >>> 0;
    const s = String(v);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h;
}
function sf(seed) {
    const x = Math.sin((seed >>> 0) * 1.6180339887 + 2.7182818284) * 9301.0 + 49297.0;
    return x - Math.floor(x);
}

// ─── Analyse hex ──────────────────────────────────────────────────────────────
function analyzeHex(hexStr) {
    const clean = hexStr.replace(/[^0-9a-fA-F]/g, '');
    if (!clean.length) return { valid: false, entropyRatio: 0.5, nibSum: 20, nibAlt: 0, fold: fnv32(hexStr), h1: 0, h2: 0, h3: 0, h4: 0 };
    const dec     = parseInt(clean, 16);
    const nibbles = clean.split('').map(c => parseInt(c, 16));
    const nibSum  = nibbles.reduce((a, v) => a + v, 0);
    const nibAlt  = nibbles.reduce((a, v, i) => a + (i % 2 === 0 ? v : -v), 0);
    const freq    = new Array(16).fill(0);
    nibbles.forEach(n => freq[n]++);
    let entropy = 0;
    nibbles.forEach(n => { const p = freq[n] / nibbles.length; if (p > 0) entropy -= p * Math.log2(p); });
    const entropyRatio = entropy / Math.log2(16);
    const h1 = fnv32(dec), h2 = fnv32(nibSum * 31 + nibAlt);
    const h3 = fnv32(clean.slice(0, Math.ceil(clean.length / 2)));
    const h4 = fnv32(clean.slice(Math.ceil(clean.length / 2)));
    const fold = (h1 ^ h2 ^ h3 ^ h4) >>> 0;
    return { valid: true, dec, h1, h2, h3, h4, fold, nibSum, nibAlt, entropyRatio };
}

// ─── Temps ────────────────────────────────────────────────────────────────────
function parseTime(s) {
    const p = s.trim().split(':');
    if (p.length < 2) return null;
    const h = parseInt(p[0], 10), m = parseInt(p[1], 10), sec = p[2] !== undefined ? parseInt(p[2], 10) : 0;
    if ([h, m, sec].some(isNaN) || h > 23 || m > 59 || sec > 59) return null;
    return { h, m, s: sec, ts: h * 3600 + m * 60 + sec };
}
function formatTime(ts) {
    const n = ((ts % 86400) + 86400) % 86400;
    const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ─── Parseur ──────────────────────────────────────────────────────────────────
function parseInput(raw) {
    const text = raw.trim();
    const lp = /multiplicateur\s*[:=]\s*([\d.,]+)[\s\S]*?tour\s*[:=]\s*(\d+)[\s\S]*?heure\s*[:=]\s*([\d:]+)[\s\S]*?hex\s*[:=]\s*([0-9a-fA-F]+)/i;
    const lm = text.match(lp);
    if (lm) {
        const mult = parseFloat(lm[1].replace(',', '.')), tour = parseInt(lm[2], 10);
        const time = parseTime(lm[3]), hex = lm[4];
        if (!isNaN(mult) && mult >= 1.0 && !isNaN(tour) && time && /^[0-9a-fA-F]{4,}$/i.test(hex))
            return { mult, tour, time, hex };
    }
    const parts = text.split(/\s+/);
    if (parts.length >= 4) {
        const mult = parseFloat(parts[0].replace(',', '.')), tour = parseInt(parts[1], 10);
        const time = parseTime(parts[2]), hex = parts[3];
        if (!isNaN(mult) && mult >= 1.0 && !isNaN(tour) && time && /^[0-9a-fA-F]{4,}$/i.test(hex))
            return { mult, tour, time, hex };
    }
    return null;
}

// ─── Algorithme multi-signal amélioré ─────────────────────────────────────────
// Chaque round k reçoit un SCORE composite [0-100] basé sur 6 signaux indépendants.
// Seuls les rounds avec score > 70 sont "élites" → candidats ≥5×.
function scoreRound(k, mult, tour, time, hex, calibFactor, hexData) {
    const { h1, h2, h3, h4, fold, nibSum, nibAlt, entropyRatio } = hexData;

    // Signal 1 — Chaleur principale (FNV mixing Knuth)
    const master  = (fnv32(tour) ^ fnv32(time.ts) ^ fold ^ fnv32(Math.round(mult * 100))) >>> 0;
    const phase   = (h1 ^ h2 ^ h3 ^ h4) >>> 0;
    const timeMod = fnv32(time.ts ^ (tour * 0x9e3779b9)) >>> 0;
    const kMix    = Math.imul((k * 0x9e3779b9) >>> 0, master) >>> 0;
    const heatA   = fnv32(kMix ^ phase ^ fnv32(k + nibSum));
    const heatB   = fnv32(timeMod ^ fnv32(tour + k * 7919));
    const s1      = sf((heatA ^ heatB) >>> 0);          // [0,1)

    // Signal 2 — Résonance de phase (nibbles alternés × tour)
    const phaseK  = fnv32((nibAlt + k * 3) ^ fnv32(tour ^ (k * 0xdeadbeef)));
    const s2      = sf(phaseK >>> 0);

    // Signal 3 — Entropie amplifiée par le rang k
    const entrSeed = fnv32((Math.round(entropyRatio * 255) ^ (k * 13)) + tour);
    const s3       = sf(entrSeed >>> 0) * entropyRatio;  // amplifiée par entropie

    // Signal 4 — Momentum du multiplicateur précédent
    const multSig = fnv32(Math.round(mult * 100) ^ (k * 97) ^ fnv32(time.ts + k));
    const s4      = sf(multSig >>> 0) * Math.min(1, mult / 5.0);  // boost si mult entrant élevé

    // Signal 5 — Cycle temporel (pic entre 07h-23h, chaque tranche de 30min)
    const slotTs  = Math.floor(time.ts / 1800);
    const timeSig = fnv32((slotTs * 31 + k) ^ fold);
    const s5      = sf(timeSig >>> 0) * ((time.h >= 7 && time.h <= 23) ? 1.0 : 0.6);

    // Signal 6 — Parité tour + résonance k
    const parSeed = fnv32((tour % 100) ^ (k * 41) ^ (nibSum * 7));
    const s6      = sf(parSeed >>> 0);

    // Score composite pondéré [0-100]
    const raw = (s1 * 0.28) + (s2 * 0.20) + (s3 * 0.18) + (s4 * 0.14) + (s5 * 0.12) + (s6 * 0.08);
    const score = Math.round(raw * 100);

    // Durée de round variable
    const durSeed = fnv32(master ^ (k * 0xdeadbeef));
    const kDur    = ROUND_MIN_SEC + Math.round(sf(durSeed) * (ROUND_MAX_SEC - ROUND_MIN_SEC));

    // Multiplicateur estimé à partir du score
    // Score > 70 → mu élevé (log-normal, E[X] ≈ 7-20×)
    // Score 55-70 → mu moyen (E[X] ≈ 3-8×)
    // Score < 55 → mu faible (E[X] ≈ 1.2-2.5×)
    let mu, sigma;
    if (score > 70) {
        mu    = 1.9 + (score - 70) * 0.025 + entropyRatio * 0.5 + Math.log(Math.max(mult, 1)) * 0.15;
        sigma = 0.28 + (1 - entropyRatio) * 0.15;
    } else if (score > 55) {
        mu    = 1.30 + (score - 55) * 0.020 + entropyRatio * 0.30;
        sigma = 0.35 + (1 - entropyRatio) * 0.15;
    } else {
        mu    = 0.20 + entropyRatio * 0.25;
        sigma = 0.42;
    }

    const xSeed = fnv32(heatA ^ fnv32(k * 31337));
    const ySeed = fnv32(heatB ^ fnv32(k * 73856));
    const u1    = sf(xSeed) || 1e-10;
    const u2    = sf(ySeed) || 1e-10;
    const z     = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    let pm = Math.exp(mu + sigma * z) * calibFactor;
    pm = Math.max(1.01, Math.round(pm * 100) / 100);

    return {
        k, score,
        predictedMult: pm,
        predictedTour: tour + k,
        predictedTime: formatTime(time.ts + k * kDur),
        kDur, s1, s2, s3, s4, s5, s6
    };
}

function runPrediction(mult, tour, time, hexStr, calibFactor = 1.0) {
    const hexData = analyzeHex(hexStr);

    const all = [];
    for (let k = 1; k <= SCAN_ROUNDS; k++) {
        all.push(scoreRound(k, mult, tour, time, hexStr, calibFactor, hexData));
    }

    // Élites = score > 70 ET mult prédit ≥ 5×
    const elites = all.filter(c => c.score > 70 && c.predictedMult >= TARGET_MIN_X)
                      .sort((a, b) => b.score - a.score || b.predictedMult - a.predictedMult);

    // Fallback : meilleur score global si aucun élite
    const top3Elite = elites.slice(0, 3);
    const best = top3Elite.length > 0
        ? top3Elite[0]
        : all.sort((a, b) => b.predictedMult - a.predictedMult)[0];

    // Top 3 alternatifs (≥ 5× si possible)
    const alts = all.filter(c => c !== best && c.predictedMult >= TARGET_MIN_X)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3);

    return {
        best, alts, elites: top3Elite, all,
        entrRatio: Math.round(hexData.entropyRatio * 100),
        hexData,
    };
}

// ─── Calibrage ────────────────────────────────────────────────────────────────
function computeCalibration(history) {
    const confirmed = history.filter(h => h.actual !== null).slice(-15);
    if (confirmed.length < 2) return 1.0;
    const logSum  = confirmed.reduce((acc, h) => acc + Math.log(Math.max(h.actual / h.predictedMult, 0.1)), 0);
    const geoMean = Math.exp(logSum / confirmed.length);
    return Math.max(0.55, Math.min(2.0, Math.round((1.0 + (geoMean - 1.0) * 0.35) * 1000) / 1000));
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function computeStats(history) {
    const confirmed = history.filter(h => h.actual !== null);
    if (!confirmed.length) return null;
    const hits      = confirmed.filter(h => h.predictedMult >= TARGET_MIN_X && h.actual >= TARGET_MIN_X).length;
    const hitRate   = Math.round((hits / confirmed.length) * 100);
    const avgErr    = confirmed.reduce((acc, h) => acc + Math.abs(h.actual - h.predictedMult) / h.predictedMult, 0) / confirmed.length;
    const precision = Math.max(0, 100 - Math.round(avgErr * 100));
    const best      = confirmed.reduce((a, b) =>
        Math.abs(a.actual - a.predictedMult) / a.predictedMult < Math.abs(b.actual - b.predictedMult) / b.predictedMult ? a : b);
    let tendance = '→ STABLE';
    if (confirmed.length >= 6) {
        const r = confirmed.slice(-3).filter(h => h.predictedMult >= TARGET_MIN_X && h.actual >= TARGET_MIN_X).length;
        const o = confirmed.slice(-6, -3).filter(h => h.predictedMult >= TARGET_MIN_X && h.actual >= TARGET_MIN_X).length;
        if (r > o) tendance = '📈 EN HAUSSE'; else if (r < o) tendance = '📉 EN BAISSE';
    }
    return { total: history.length, nConf: confirmed.length, hits, hitRate, avgErrPct: Math.round(avgErr * 100), precision, best, tendance };
}

// ─── Groq AI — sélection du meilleur tour ≥5× ────────────────────────────────
async function callGroqPrediction(store, input, pred) {
    if (!GROQ_API_KEY) return null;
    try {
        const confirmed = store.history.filter(h => h.actual !== null).slice(-25);
        let histCtx = '';
        if (confirmed.length > 0) {
            histCtx = 'HISTORIQUE CONFIRMÉ (récent→ancien) :\n';
            confirmed.slice().reverse().forEach((h, i) => {
                const ecart = Math.round(Math.abs(h.actual - h.predictedMult) / h.predictedMult * 100);
                const ok = h.actual >= TARGET_MIN_X ? '✓≥5x' : '✗<5x';
                histCtx += `[${i+1}] Ref:${h.tour} → Prédit:Tour${h.predictedTour}×${h.predictedMult.toFixed(2)} | Réel:×${h.actual.toFixed(2)} Écart:${ecart}% ${ok}\n`;
            });
            const st = computeStats(store.history);
            if (st) histCtx += `STATS: Réussite=${st.hitRate}% Précision=±${st.avgErrPct}% Calib=${store.calibration.toFixed(3)} ${st.tendance}\n`;
        }

        // Top 8 candidats élites pour que Groq choisisse
        const candidates = pred.all
            .filter(c => c.predictedMult >= TARGET_MIN_X)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        if (candidates.length === 0) candidates.push(...pred.all.sort((a,b) => b.score - a.score).slice(0, 5));

        const candStr = candidates.map((c, i) =>
            `C${i+1}: k=+${c.k} Tour=${c.predictedTour} Mult=${c.predictedMult.toFixed(2)}x Score=${c.score} Heure=${c.predictedTime}`
        ).join('\n');

        const userMsg = `DONNÉES ACTUELLES:
Mult_ref=${input.mult.toFixed(2)}x Tour=${input.tour} Heure=${formatTime(input.time.ts)} Hex=${input.hex} Entropie=${pred.entrRatio}%

CANDIDATS ALGO (${SCAN_ROUNDS} rounds scannés):
${candStr}

${histCtx}
Analyse les patterns. Retourne UNIQUEMENT ce JSON:
{
  "tourCible": <tour entier>,
  "heureCible": "<HH:MM:SS>",
  "multCible": <décimal ≥5.0>,
  "multMin": <décimal>,
  "multMax": <décimal>,
  "confiance": <0-99>,
  "signal": "<COSMIQUE|ULTRA|FORT|MODÉRÉ>",
  "tendanceHex": "<CHAUD|NEUTRE|FROID>",
  "pattern": "<pattern détecté, max 55 chars>",
  "conseil": "<action précise, max 65 chars>",
  "delta": "<HAUSSE|STABLE|BAISSE>"
}`;

        const msgs = [
            {
                role: 'system',
                content: `Tu es le moteur de prédiction CosmosX. Ta SEULE mission : identifier parmi les candidats fournis celui qui a le plus de chances d'atteindre un multiplicateur ≥5×.
RÈGLES :
1. Retourne UNIQUEMENT du JSON valide, zéro texte autour.
2. "tourCible" DOIT être l'un des tours candidats listés.
3. "multCible" minimum 5.00, sauf si historique montre que tous les rounds récents sont bas (alors indique le meilleur disponible).
4. Analyse les patterns hex : entropie élevée (>70%) = signal plus fiable.
5. Si l'historique montre des erreurs systématiques dans un sens, corrige via "delta".
6. "confiance" : sois honnête — ne dépasse 90 que si l'historique + score sont forts.`
            },
            ...store.groqMessages.slice(-16),
            { role: 'user', content: userMsg }
        ];

        const resp = await axios.post(GROQ_URL, {
            model: GROQ_MODEL,
            messages: msgs,
            temperature: 0.15,
            max_tokens: 350,
            response_format: { type: 'json_object' }
        }, {
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            timeout: 22000
        });

        const raw = resp.data.choices[0].message.content.trim();
        store.groqMessages.push({ role: 'user', content: userMsg });
        store.groqMessages.push({ role: 'assistant', content: raw });
        if (store.groqMessages.length > 36) store.groqMessages = store.groqMessages.slice(-36);

        const g = JSON.parse(raw);
        if (!g.tourCible || !g.multCible) return null;

        return {
            tourCible:  parseInt(g.tourCible),
            heureCible: g.heureCible || pred.best.predictedTime,
            multCible:  Math.max(1.01, parseFloat(g.multCible)),
            multMin:    parseFloat(g.multMin) || parseFloat(g.multCible) * 0.55,
            multMax:    parseFloat(g.multMax) || parseFloat(g.multCible) * 1.90,
            confiance:  Math.min(99, Math.max(1, parseInt(g.confiance))),
            signal:     g.signal     || 'MODÉRÉ',
            tendance:   g.tendanceHex|| 'NEUTRE',
            pattern:    g.pattern    || 'Analyse en cours',
            conseil:    g.conseil    || 'Attendez le tour cible',
            delta:      g.delta      || 'STABLE',
        };
    } catch (err) {
        console.error('[CosmoX Groq]', err.message);
        return null;
    }
}

// ─── Extraction image (Vision) ────────────────────────────────────────────────
async function extractDataFromImage(imageUrl) {
    if (!GROQ_API_KEY) return null;
    try {
        const resp = await axios.post(GROQ_URL, {
            model: GROQ_VISION_MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: imageUrl } },
                    { type: 'text', text: `Analyse cette capture d'écran CosmosX. Retourne UNIQUEMENT ce JSON:
{"multiplicateur":<nombre>,"tour":<entier>,"heure":"<HH:MM:SS>","hex":"<code hex>"}
- TOUR = grand numéro en haut (ex: TOUR 8420302)
- MULTIPLICATEUR = nombre avec x (ex: 3.84x)
- HEURE = heure affichée (ex: 15:03:58)
- HEX = valeur HEX en bas (ex: 4098bf16)
Si introuvable → null.` }
                ]
            }],
            temperature: 0.1,
            max_tokens: 150
        }, {
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            timeout: 20000
        });

        const raw = resp.data.choices[0].message.content.trim();
        const m = raw.match(/\{[\s\S]*\}/);
        if (!m) return null;
        const d = JSON.parse(m[0]);
        if (!d.multiplicateur || !d.tour || !d.heure || !d.hex) return null;
        return {
            mult: parseFloat(d.multiplicateur),
            tour: parseInt(d.tour),
            time: parseTime(String(d.heure)),
            hex:  String(d.hex).replace(/[^0-9a-fA-F]/g, '')
        };
    } catch (err) {
        console.error('[CosmoX Vision]', err.message);
        return null;
    }
}

// ─── Formatage du résultat principal ─────────────────────────────────────────
function buildResponse(input, pred, groq, store) {
    const g = groq;

    // Source de vérité finale
    const tourFinal  = g ? g.tourCible   : pred.best.predictedTour;
    const heureFinal = g ? g.heureCible  : pred.best.predictedTime;
    const multFinal  = g ? g.multCible   : pred.best.predictedMult;
    const multMin    = g ? g.multMin     : multFinal * 0.55;
    const multMax    = g ? g.multMax     : multFinal * 1.90;
    const conf       = g ? g.confiance   : pred.best.score;

    // Barre de confiance
    const bars = Math.round(conf / 10);
    const confBar = '█'.repeat(bars) + '░'.repeat(10 - bars);

    // Label signal
    const signal = g ? g.signal : (pred.best.score > 70 ? 'FORT' : pred.best.score > 55 ? 'MODÉRÉ' : 'FAIBLE');
    let signalIcon;
    if      (signal === 'COSMIQUE') signalIcon = '🌌 COSMIQUE';
    else if (signal === 'ULTRA')    signalIcon = '🔥 ULTRA';
    else if (signal === 'FORT')     signalIcon = '⚡ FORT';
    else                            signalIcon = '📊 MODÉRÉ';

    // Zone multiplicateur
    let zone;
    if      (multFinal >= 20) zone = '🏆 JACKPOT ×20+';
    else if (multFinal >= 15) zone = '🌌 EXPLOSION ×15+';
    else if (multFinal >= 10) zone = '🔥 ULTRA ×10+';
    else if (multFinal >= 7)  zone = '⚡ TRÈS ÉLEVÉ ×7+';
    else if (multFinal >= 5)  zone = '🎯 CIBLE ×5+';
    else                       zone = '📊 SOUS CIBLE';

    // Fenêtres alternatives (top 2, hors tour principal)
    const alts = pred.all
        .filter(c => c.predictedTour !== tourFinal && c.predictedMult >= TARGET_MIN_X)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

    const nConf    = store.history.filter(h => h.actual !== null).length;
    const calibTxt = store.calibration !== 1.0 ? `${store.calibration.toFixed(3)}` : 'neutre';
    const deltaIcon = g ? (g.delta === 'HAUSSE' ? '▲' : g.delta === 'BAISSE' ? '▼' : '●') : '●';

    let out = '';
    out += `${D.top}\n`;
    out += `${D.ln}  🌌 COSMOSX — PRÉDICTION IA v2       ${D.ln}\n`;
    out += `${D.sep}\n`;

    // Données reçues
    out += `${D.ln}  📥 DONNÉES REÇUES                   ${D.ln}\n`;
    out += `${D.ln}                                       ${D.ln}\n`;
    out += row('Mult ref ', `${input.mult.toFixed(2)}×`);
    out += row('Tour ref ', `${input.tour}`);
    out += row('Heure    ', formatTime(input.time.ts));
    out += row('Hex      ', input.hex);
    out += `${D.sep}\n`;

    // Cible principale
    out += `${D.ln}  🎯 TOUR CIBLE PRINCIPAL              ${D.ln}\n`;
    out += `${D.ln}                                       ${D.ln}\n`;
    out += row('► Tour   ', `${tourFinal}`);
    out += row('► Heure  ', heureFinal);
    out += row('► Mult   ', `${multFinal.toFixed(2)}×`);
    out += row('► Zone   ', `${multMin.toFixed(1)}× → ${multMax.toFixed(1)}×`);
    out += `${D.ln}                                       ${D.ln}\n`;
    out += rowFull(zone);
    out += `${D.sep}\n`;

    // Fenêtres alternatives
    if (alts.length > 0) {
        out += `${D.ln}  📡 FENÊTRES ALTERNATIVES            ${D.ln}\n`;
        out += `${D.ln}                                       ${D.ln}\n`;
        alts.forEach((c, i) => {
            const lbl = i === 0 ? '#2' : '#3';
            out += rowFull(`${lbl} Tour ${c.predictedTour}  ${c.predictedTime}  ×${c.predictedMult.toFixed(2)}`);
        });
        out += `${D.sep}\n`;
    }

    // Analyse Groq
    if (g) {
        const tendIcon = g.tendance === 'CHAUD' ? '🔥' : g.tendance === 'FROID' ? '❄️' : '〰️';
        out += `${D.ln}  🤖 ANALYSE IA (Groq Llama 3.3-70B) ${D.ln}\n`;
        out += `${D.ln}                                       ${D.ln}\n`;
        out += row('Pattern  ', g.pattern.slice(0, 28));
        out += row('Hex trend', `${tendIcon} ${g.tendance}`);
        out += row('Ajust.   ', `${deltaIcon} ${g.delta}`);
        out += rowFull(`💡 ${g.conseil.slice(0, 33)}`);
        out += `${D.sep}\n`;
    }

    // Confiance
    out += `${D.ln}  🛡️ CONFIANCE                         ${D.ln}\n`;
    out += `${D.ln}                                       ${D.ln}\n`;
    out += rowFull(`${confBar} ${conf}%`);
    out += row('Signal   ', signalIcon);
    out += `${D.sep}\n`;

    // Infos session
    out += `${D.ln}  ⚙️ SESSION                           ${D.ln}\n`;
    out += row('Tours scannés', SCAN_ROUNDS);
    out += row('Calibrage', calibTxt);
    if (nConf > 0) out += row('Confirmés', `${nConf} tour(s)`);
    out += `${D.sep}\n`;

    // Stratégie
    out += `${D.ln}  💡 STRATÉGIE                         ${D.ln}\n`;
    out += `${D.ln}                                       ${D.ln}\n`;
    out += rowFull('• Attendez le tour cible exact');
    out += rowFull('• Encaissez dès ×5 atteint');
    out += rowFull('• Mise max : 5% de votre bankroll');
    out += `${D.bot}\n`;

    return out;
}

// ─── Résultat confirmé ────────────────────────────────────────────────────────
function applyResult(store, tourNum, actualMx) {
    const idx = store.history.findLastIndex(h => h.predictedTour === tourNum && h.actual === null);
    if (idx === -1) return { ok: false };

    store.history[idx].actual      = actualMx;
    store.history[idx].confirmedAt = new Date().toLocaleTimeString('fr-FR');
    const oldCalib    = store.calibration;
    store.calibration = computeCalibration(store.history);
    store.awaitingResult = null;

    const pred     = store.history[idx].predictedMult;
    const errPct   = Math.round(Math.abs(actualMx - pred) / pred * 100);
    const hit      = actualMx >= TARGET_MIN_X;
    const hitLabel = hit ? '✅ CIBLE ATTEINTE !' : '❌ Sous la cible';
    const cDelta   = store.calibration - oldCalib;
    const cInfo    = Math.abs(cDelta) > 0.005
        ? `${oldCalib.toFixed(3)} → ${store.calibration.toFixed(3)} ${cDelta > 0 ? '▲' : '▼'}`
        : `stable (${store.calibration.toFixed(3)})`;

    let qual;
    if      (errPct <= 10) qual = '🌌 Précision parfaite';
    else if (errPct <= 25) qual = '🔥 Très bonne';
    else if (errPct <= 50) qual = '✅ Bonne';
    else if (errPct <= 80) qual = '📊 Correcte';
    else                   qual = '⚠️ Écart fort — recalibrage';

    return { ok: true, msg:
        `${D.top}\n` +
        `${D.ln}  📊 RÉSULTAT CONFIRMÉ                 ${D.ln}\n` +
        `${D.sep}\n` +
        row('Tour     ', tourNum) +
        row('Prédit   ', `${pred.toFixed(2)}×`) +
        row('Réel     ', `${actualMx.toFixed(2)}×`) +
        row('Écart    ', `±${errPct}%`) +
        row('Qualité  ', qual) +
        row('Statut   ', hitLabel) +
        `${D.sep}\n` +
        `${D.ln}  🧬 APPRENTISSAGE IA                  ${D.ln}\n` +
        row('Calibrage', cInfo) +
        rowFull('Groq affine la prochaine analyse !') +
        `${D.bot}`
    };
}

// ─── Commandes secondaires ────────────────────────────────────────────────────
async function handleResult(sid, args) {
    const store = getStore(sid);
    const parts = args.trim().split(/\s+/);
    if (parts.length < 2) {
        await sendMessage(sid, `⚠️ Format : résultat [tour] [mult_réel]\nEx : résultat 8419185 12.40`);
        return;
    }
    const tourNum  = parseInt(parts[0], 10);
    const actualMx = parseFloat(parts[1].replace(',', '.'));
    if (isNaN(tourNum) || isNaN(actualMx) || actualMx < 1.0) {
        await sendMessage(sid, `⚠️ Valeurs invalides.`); return;
    }
    const { ok, msg } = applyResult(store, tourNum, actualMx);
    if (!ok) {
        await sendMessage(sid, `🔍 Aucune prédiction en attente pour le tour ${tourNum}.`); return;
    }
    await sendMessage(sid, msg);
}

async function handleHistory(sid) {
    const store = getStore(sid);
    if (!store.history.length) {
        await sendMessage(sid, `📋 Aucune prédiction enregistrée.`); return;
    }
    const last5 = store.history.slice(-5).reverse();
    let out = `${D.top}\n${D.ln}  📋 HISTORIQUE — 5 DERNIÈRES         ${D.ln}\n${D.sep}\n`;
    out += row('Calibrage', store.calibration.toFixed(3));
    out += `${D.sep}\n`;
    last5.forEach((h, i) => {
        const num    = store.history.length - i;
        const status = h.actual === null ? '⏳ Attente'
            : h.actual >= TARGET_MIN_X ? `✅ ×${h.actual.toFixed(2)}` : `❌ ×${h.actual.toFixed(2)}`;
        const err = h.actual !== null ? `  ±${Math.round(Math.abs(h.actual - h.predictedMult) / h.predictedMult * 100)}%` : '';
        out += rowFull(`#${num} Tour${h.predictedTour} → ×${h.predictedMult.toFixed(2)} ${status}${err}`);
    });
    out += `${D.bot}`;
    await sendMessage(sid, out);
}

async function handleStats(sid) {
    const store = getStore(sid);
    const st = computeStats(store.history);
    if (!st) {
        await sendMessage(sid, `📊 Pas encore de résultats confirmés.\n\nRépondez avec le vrai multiplicateur après chaque prédiction.`);
        return;
    }
    const pb  = '█'.repeat(Math.round(st.precision / 10)) + '░'.repeat(10 - Math.round(st.precision / 10));
    const cf  = store.calibration;
    const cfd = cf > 1.05 ? `▲ +${((cf-1)*100).toFixed(1)}%` : cf < 0.95 ? `▼ ${((cf-1)*100).toFixed(1)}%` : `✓ Neutre`;
    const nG  = store.groqMessages.length >> 1;
    await sendMessage(sid,
        `${D.top}\n${D.ln}  📊 STATISTIQUES PRÉCISION            ${D.ln}\n${D.sep}\n` +
        row('Total prédictions', st.total) +
        row('Confirmées       ', st.nConf) +
        `${D.sep}\n` +
        rowFull(`🎯 TAUX RÉUSSITE (≥5×)`) +
        rowFull(`${st.hits}/${st.nConf} → ${st.hitRate}%  ${st.tendance}`) +
        `${D.sep}\n` +
        rowFull(`📐 PRÉCISION MOYENNE`) +
        rowFull(`Erreur : ±${st.avgErrPct}%`) +
        rowFull(`${pb} ${st.precision}%`) +
        `${D.sep}\n` +
        rowFull(`🧬 CALIBRAGE AUTO`) +
        rowFull(`${cf.toFixed(3)}  ${cfd}`) +
        rowFull(`🤖 Groq : ${nG} analyse(s) en mémoire`) +
        `${D.bot}`
    );
}

async function handleReset(sid) {
    userStore.set(sid, { history: [], calibration: 1.0, awaitingResult: null, groqMessages: [] });
    await sendMessage(sid,
        `${D.top}\n${D.ln}  🔄 RÉINITIALISATION COMPLÈTE         ${D.ln}\n${D.sep}\n` +
        rowFull('Historique effacé ✅') + rowFull('Calibrage → 1.000 ✅') +
        rowFull('Mémoire Groq effacée ✅') +
        `${D.bot}`
    );
}

async function sendHelp(sid) {
    await sendMessage(sid,
        `${D.top}\n${D.ln}  👑 COSMOSX v2 — GUIDE               ${D.ln}\n${D.sep}\n` +
        `${D.ln}  📸 ENVOI PHOTO (recommandé)          ${D.ln}\n` +
        rowFull('Activez cosmosx puis envoyez') +
        rowFull('directement votre capture.') +
        `${D.sep}\n` +
        `${D.ln}  📝 ENVOI TEXTE                       ${D.ln}\n` +
        rowFull('Multiplicateur : 3.84') +
        rowFull('Tour : 8420302') +
        rowFull('Heure : 15:03:58') +
        rowFull('Hex : 4098bf16') +
        `${D.sep}\n` +
        `${D.ln}  🔁 RETOUR DE RÉSULTAT                ${D.ln}\n` +
        rowFull('Répondez : 12.40 8419185') +
        rowFull('Ou juste : 12.40') +
        rowFull('Ou tapez : skip') +
        `${D.sep}\n` +
        rowFull('📋 historique  📊 stats  🔄 reset') +
        `${D.bot}`
    );
}

// ─── MODULE PRINCIPAL ─────────────────────────────────────────────────────────
module.exports = async (senderId, prompt, api, imageAttachments) => {
    const store = getStore(senderId);

    // ── Gestion photo ──────────────────────────────────────────────────────────
    if (prompt === 'IMAGE_ATTACHMENT' && imageAttachments && imageAttachments.length > 0) {
        const imageUrl = imageAttachments[0].payload.url;
        await sendMessage(senderId,
            `📸 Capture reçue !\n🔍 Groq Vision extrait les données...\n⏳ Analyse en cours...`
        );

        const extracted = await extractDataFromImage(imageUrl);
        if (!extracted || !extracted.time || isNaN(extracted.mult) || isNaN(extracted.tour) || !extracted.hex) {
            await sendMessage(senderId,
                `⚠️ Extraction échouée.\n\nVérifiez que la photo montre :\n• TOUR (ex: TOUR 8420302)\n• Multiplicateur (ex: 3.84×)\n• Heure (ex: 15:03:58)\n• HEX (ex: 4098bf16)\n\nOu envoyez les données en texte.`
            );
            return;
        }

        await sendMessage(senderId,
            `✅ Données extraites !\n\n` +
            `📊 Tour  : ${extracted.tour}\n` +
            `✖️  Mult  : ${extracted.mult.toFixed(2)}×\n` +
            `🕐 Heure : ${formatTime(extracted.time.ts)}\n` +
            `🔑 Hex   : ${extracted.hex}\n\n` +
            `🌌 Prédiction en cours...`
        );
        await new Promise(r => setTimeout(r, 600));

        const txt = `Multiplicateur : ${extracted.mult}\nTour : ${extracted.tour}\nHeure : ${formatTime(extracted.time.ts)}\nHex : ${extracted.hex}`;
        return module.exports(senderId, txt, api, null);
    }

    const input = (prompt || '').trim();
    const lower = input.toLowerCase();

    // ── Commandes globales ─────────────────────────────────────────────────────
    if (!input || ['aide', 'help', '?', 'info', 'guide'].includes(lower)) { await sendHelp(senderId); return; }
    if (['historique', 'history'].includes(lower))                         { await handleHistory(senderId); return; }
    if (['stats', 'statistiques', 'stat'].includes(lower))                 { await handleStats(senderId); return; }
    if (['reset', 'réinitialiser', 'reinitialiser'].includes(lower))       { await handleReset(senderId); return; }

    const resultMatch = input.match(/^(?:résultat|resultat|result)\s+(.+)$/i);
    if (resultMatch) { await handleResult(senderId, resultMatch[1]); return; }

    // ── Réponse calibrage en attente ───────────────────────────────────────────
    if (store.awaitingResult) {
        const aw = store.awaitingResult;
        if (['skip','passer','non','no','annuler','cancel','ignorer'].includes(lower)) {
            store.awaitingResult = null;
            await sendMessage(senderId, `⏭️ Résultat ignoré. Envoyez de nouvelles données.`);
            return;
        }
        const parts = input.trim().split(/\s+/);
        const mx1   = parseFloat(parts[0].replace(',', '.'));
        const mx2   = parts.length >= 2 ? parseFloat(parts[1].replace(',', '.')) : NaN;
        let tourNum, actualMx;
        if (!isNaN(mx1) && mx1 >= 1.0 && !isNaN(mx2) && Number.isInteger(mx2) && mx2 > 1000) {
            actualMx = mx1; tourNum = Math.round(mx2);
        } else if (!isNaN(mx1) && mx1 >= 1.0 && parts.length === 1) {
            actualMx = mx1; tourNum = aw.predictedTour;
        } else if (!isNaN(mx1) && mx1 >= 1.0 && !isNaN(mx2) && mx2 >= 1.0 && mx2 < 1000) {
            actualMx = Math.max(mx1, mx2); tourNum = aw.predictedTour;
        } else {
            store.awaitingResult = null;
        }
        if (tourNum !== undefined && actualMx !== undefined) {
            const { ok, msg } = applyResult(store, tourNum, actualMx);
            if (ok) {
                await sendMessage(senderId, msg);
                const nc = store.history.filter(h => h.actual !== null).length;
                if (nc >= 3 && nc % 3 === 0) {
                    const st = computeStats(store.history);
                    if (st) {
                        await new Promise(r => setTimeout(r, 700));
                        await sendMessage(senderId,
                            `📈 Mise à jour rapide\nRéussite : ${st.hitRate}% (${st.hits}/${st.nConf})\nPrécision : ±${st.avgErrPct}%\nCal. : ${store.calibration.toFixed(3)}\n🤖 Groq : ${store.groqMessages.length >> 1} analyses`
                        );
                    }
                }
                return;
            }
            const lp = store.history.slice().reverse().find(h => h.actual === null);
            if (lp) { const { ok: ok2, msg: m2 } = applyResult(store, lp.predictedTour, actualMx); if (ok2) { await sendMessage(senderId, m2); return; } }
            store.awaitingResult = null;
            await sendMessage(senderId, `🔍 Tour introuvable. Continuez avec une nouvelle prédiction.`); return;
        }
    }

    // ── Nouvelle prédiction ────────────────────────────────────────────────────
    const parsed = parseInput(input);
    if (!parsed) {
        await sendMessage(senderId,
            `⚠️ Format non reconnu.\n\n` +
            `Envoyez :\nMultiplicateur : 3.84\nTour : 8420302\nHeure : 15:03:58\nHex : 4098bf16\n\nOu envoyez une photo de la capture.`
        );
        return;
    }

    store.awaitingResult = null;
    const { mult, tour, time, hex } = parsed;
    const nPrev = store.history.filter(h => h.actual !== null).length;

    await sendMessage(senderId,
        `🌌 CosmosX v2 — Analyse en cours\n` +
        `⚛️ Scan ${SCAN_ROUNDS} rounds + IA Groq...\n` +
        (nPrev > 0 ? `🧠 ${nPrev} tour(s) historique(s) chargé(s)\n` : '') +
        `🔑 Hex : ${hex} | Tour réf : ${tour}`
    );

    // Calcul algo + Groq en parallèle
    const pred = runPrediction(mult, tour, time, hex, store.calibration);

    const [groqResult] = await Promise.all([
        callGroqPrediction(store, { mult, tour, time, hex }, pred),
        new Promise(r => setTimeout(r, 1400))
    ]);

    const finalTour = groqResult ? groqResult.tourCible   : pred.best.predictedTour;
    const finalMult = groqResult ? groqResult.multCible   : pred.best.predictedMult;
    const finalHeur = groqResult ? groqResult.heureCible  : pred.best.predictedTime;

    const entry = {
        id: Date.now(), tour,
        predictedTour: finalTour,
        predictedMult: finalMult,
        predictedTime: finalHeur,
        actual: null,
        createdAt: new Date().toLocaleTimeString('fr-FR'),
    };
    store.history.push(entry);
    if (store.history.length > MAX_HISTORY) store.history.shift();

    store.awaitingResult = { entryIdx: store.history.length - 1, predictedTour: finalTour, predictedMult: finalMult };

    await sendMessage(senderId, buildResponse(parsed, pred, groqResult, store));

    await new Promise(r => setTimeout(r, 900));
    await sendMessage(senderId,
        `╔════════════════════════════════════╗\n` +
        `║  🔔 RETOUR RÉSULTAT                ║\n` +
        `╠════════════════════════════════════╣\n` +
        `║  Tour cible : ${pad(String(finalTour), 22)}║\n` +
        `║                                    ║\n` +
        `║  Quand ce tour se termine,         ║\n` +
        `║  quel était le multiplicateur ?    ║\n` +
        `║                                    ║\n` +
        `║  Répondez : 12.40 ${pad(String(finalTour), 17)}║\n` +
        `║  Ou juste : 12.40                  ║\n` +
        `║  Ou tapez : skip                   ║\n` +
        `╚════════════════════════════════════╝`
    );
};
