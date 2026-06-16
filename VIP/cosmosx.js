const sendMessage = require('../handles/sendMessage');
const axios = require('axios');

// ─── Clé Groq intégrée ────────────────────────────────────────────────────────
const GROQ_API_KEY = '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';
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

// ─── Décoration visuelle ──────────────────────────────────────────────────────
const D = {
    top: '╔════════════════════════════════════╗',
    mid: '╠════════════════════════════════════╣',
    bot: '╚════════════════════════════════════╝',
    sep: '║────────────────────────────────────║',
    ln:  '║',
};

// ─── Constantes CosmosX ───────────────────────────────────────────────────────
const ROUND_MIN_SEC = 20;
const ROUND_MAX_SEC = 38;
const TARGET_MIN_X  = 5.0;
const MAX_HISTORY   = 50;

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

// ─── FNV-1a 32-bit ───────────────────────────────────────────────────────────
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
    if (!clean.length) return { valid: false };
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

// ─── Parseur entrée principale ────────────────────────────────────────────────
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

// ─── Algorithme de prédiction mathématique ────────────────────────────────────
function predictCosmosX(mult, tour, time, hexStr, calibFactor = 1.0) {
    const hex       = analyzeHex(hexStr);
    const hexFold   = hex.valid ? hex.fold   : fnv32(hexStr);
    const h1        = hex.valid ? hex.h1     : fnv32(hexStr + '1');
    const h2        = hex.valid ? hex.h2     : fnv32(hexStr + '2');
    const h3        = hex.valid ? hex.h3     : fnv32(hexStr + '3');
    const h4        = hex.valid ? hex.h4     : fnv32(hexStr + '4');
    const entrRatio = hex.valid ? hex.entropyRatio : 0.5;
    const nibSum    = hex.valid ? hex.nibSum : 20;

    const master  = (fnv32(tour) ^ fnv32(time.ts) ^ hexFold ^ fnv32(Math.round(mult * 100))) >>> 0;
    const phase   = (h1 ^ h2 ^ h3 ^ h4) >>> 0;
    const timeMod = fnv32(time.ts ^ (tour * 0x9e3779b9)) >>> 0;

    const threshSeed = fnv32(master ^ timeMod);
    const HOT_THRESH = 0.60 + sf(threshSeed) * 0.22;

    const candidates = [];
    for (let k = 1; k <= 12; k++) {
        const kMix    = Math.imul((k * 0x9e3779b9) >>> 0, master) >>> 0;
        const heatA   = fnv32(kMix ^ phase ^ fnv32(k + nibSum));
        const heatB   = fnv32(timeMod ^ fnv32(tour + k * 7919));
        const heat    = sf((heatA ^ heatB) >>> 0);

        let mu, sigma;
        if (heat > HOT_THRESH) {
            mu    = 2.2 + entrRatio * 0.7 + Math.log(Math.max(mult, 1)) * 0.20;
            sigma = 0.30 + (1 - entrRatio) * 0.20;
        } else if (heat > HOT_THRESH - 0.20) {
            mu    = 1.45 + entrRatio * 0.45;
            sigma = 0.35 + (1 - entrRatio) * 0.15;
        } else {
            mu    = 0.25 + entrRatio * 0.30;
            sigma = 0.40 + (1 - entrRatio) * 0.20;
        }

        const xSeed = fnv32(heatA ^ fnv32(k * 31337));
        const ySeed = fnv32(heatB ^ fnv32(k * 73856));
        const u1    = sf(xSeed) || 1e-10;
        const u2    = sf(ySeed) || 1e-10;
        const z     = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

        let pm = Math.exp(mu + sigma * z) * calibFactor;
        pm = Math.max(1.01, Math.round(pm * 100) / 100);

        const durSeed = fnv32(master ^ (k * 0xdeadbeef));
        const kDur    = ROUND_MIN_SEC + Math.round(sf(durSeed) * (ROUND_MAX_SEC - ROUND_MIN_SEC));

        candidates.push({
            k,
            heat: Math.round(heat * 100),
            predictedMult: pm,
            predictedTour: tour + k,
            predictedTime: formatTime(time.ts + k * kDur),
            kDur,
        });
    }

    const above5   = candidates.filter(c => c.predictedMult >= TARGET_MIN_X);
    const best     = above5.length > 0
        ? above5.reduce((a, b) => a.predictedMult > b.predictedMult ? a : b)
        : candidates.reduce((a, b) => a.predictedMult > b.predictedMult ? a : b);

    const roundDur = best.kDur;

    const calibBonus    = Math.round(Math.max(0, 10 - Math.abs(calibFactor - 1) * 30));
    const hexEntrBonus  = Math.round(entrRatio * 25);
    const confidence    = Math.min(50 + hexEntrBonus + (((tour % 100) < 50) ? 8 : 4)
                            + ((time.h >= 7 && time.h <= 23) ? 10 : 3)
                            + Math.min(Math.round((mult - 1) * 3), 15)
                            + Math.min((hexStr.replace(/[^0-9a-fA-F]/gi, '').length) * 2, 12)
                            + calibBonus, 97);

    return { ...best, candidates, confidence, roundDur, entrRatio: Math.round(entrRatio * 100) };
}

// ─── Calibrage ────────────────────────────────────────────────────────────────
function computeCalibration(history) {
    const confirmed = history.filter(h => h.actual !== null).slice(-10);
    if (confirmed.length < 2) return 1.0;
    const logSum  = confirmed.reduce((acc, h) => acc + Math.log(Math.max(h.actual / h.predictedMult, 0.1)), 0);
    const geoMean = Math.exp(logSum / confirmed.length);
    return Math.max(0.60, Math.min(1.80, Math.round((1.0 + (geoMean - 1.0) * 0.30) * 1000) / 1000));
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

// ─── Appel Groq AI ────────────────────────────────────────────────────────────
// Construit le contexte historique, appelle Groq et retourne la prédiction affinée
async function callGroqPrediction(store, currentInput, mathResult) {
    try {
        // ── Construire le résumé historique pour le contexte ──
        const confirmed = store.history.filter(h => h.actual !== null).slice(-20);
        let historyContext = '';
        if (confirmed.length > 0) {
            historyContext = '\n\nHISTORIQUE DES TOURS CONFIRMÉS (du plus ancien au plus récent) :\n';
            confirmed.forEach((h, i) => {
                const ecart = Math.round(Math.abs(h.actual - h.predictedMult) / h.predictedMult * 100);
                const ok = h.actual >= TARGET_MIN_X ? 'CIBLE_OK' : 'SOUS_CIBLE';
                historyContext += `[${i+1}] TourRef:${h.tour} | TourPrédit:${h.predictedTour} | PréditMult:${h.predictedMult.toFixed(2)}x | RéelMult:${h.actual.toFixed(2)}x | Écart:${ecart}% | ${ok}\n`;
            });
            const stats = computeStats(store.history);
            if (stats) {
                historyContext += `\nSTATISTIQUES SESSION : TauxRéussite=${stats.hitRate}% | PrécisionMoy=±${stats.avgErrPct}% | Calibrage=${store.calibration.toFixed(3)} | Tendance=${stats.tendance}`;
            }
        }

        // ── Top 3 fenêtres candidates de l'algorithme mathématique ──
        const top3 = mathResult.candidates
            .sort((a, b) => b.predictedMult - a.predictedMult)
            .slice(0, 3);
        const candidatesStr = top3.map((c, i) =>
            `Candidat${i+1}: Tour=${c.predictedTour} | Mult=${c.predictedMult.toFixed(2)}x | Heure=${c.predictedTime}`
        ).join('\n');

        // ── Message utilisateur pour cette prédiction ──
        const userMsg = `NOUVELLE DONNÉE À ANALYSER :
Multiplicateur actuel : ${currentInput.mult.toFixed(2)}x
Tour de référence     : ${currentInput.tour}
Heure                 : ${formatTime(currentInput.time.ts)}
Hex                   : ${currentInput.hex}
Entropie hex          : ${mathResult.entrRatio}%

RÉSULTAT ALGORITHME MATHÉMATIQUE :
Meilleure prédiction  : Tour ${mathResult.predictedTour} | Mult ${mathResult.predictedMult.toFixed(2)}x | Heure ${mathResult.predictedTime}
Confiance algorithme  : ${mathResult.confidence}%
Top 3 candidats :
${candidatesStr}
${historyContext}

Affine cette prédiction avec ton analyse. Retourne UNIQUEMENT un JSON valide avec ce format exact :
{
  "tourPredit": <numéro entier>,
  "heurePredit": "<HH:MM:SS>",
  "multPredit": <nombre décimal>,
  "multMin": <nombre décimal>,
  "multMax": <nombre décimal>,
  "confiance": <entier 0-100>,
  "signal": "<COSMIQUE|ULTRA|TRÈS ÉLEVÉ|ÉLEVÉ|MODÉRÉ>",
  "tendanceHex": "<CHAUD|NEUTRE|FROID>",
  "patternDetecte": "<description courte du pattern en français, max 60 chars>",
  "conseil": "<conseil stratégique court en français, max 80 chars>",
  "ajustement": "<HAUSSE|STABLE|BAISSE>"
}`;

        // ── Construire les messages pour Groq (historique de conversation) ──
        // On garde max 10 échanges pour éviter de dépasser les tokens
        const trimmedHistory = store.groqMessages.slice(-20);

        const messages = [
            {
                role: 'system',
                content: `Tu es CosmosX AI, un moteur d'analyse prédictif de haute précision pour le jeu CosmosX. 
Ton rôle UNIQUE est d'analyser les données cryptographiques (multiplicateur, tour, heure, hash hex) et l'historique complet de la session pour affiner les prédictions mathématiques et trouver le prochain tour avec multiplicateur élevé (≥5x).

RÈGLES ABSOLUES :
1. Tu réponds TOUJOURS et UNIQUEMENT avec un JSON valide, aucun texte autour.
2. Tu analyses les patterns dans l'historique : séquences hex, cycles de tours, tendances temporelles.
3. Tu tiens compte du calibrage actuel (${store.calibration.toFixed(3)}) pour ajuster tes prédictions.
4. Le champ "multPredit" doit toujours être ≥ 5.0 si le signal est favorable, sinon tu indiques le meilleur multiplicateur probable.
5. Tu es déterministe : pour les mêmes données + historique, tu retournes la même prédiction.
6. Analyse l'entropie hex pour détecter les patterns chauds (entropie > 70% = signal fort).
7. Si l'historique montre une tendance haussière récente, boost la confiance de +5 à +10.
8. Le "tourPredit" doit être dans les 12 prochains tours du tour de référence.`
            },
            ...trimmedHistory,
            { role: 'user', content: userMsg }
        ];

        const response = await axios.post(GROQ_URL, {
            model: GROQ_MODEL,
            messages,
            temperature: 0.2,
            max_tokens: 400,
            response_format: { type: 'json_object' }
        }, {
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 25000
        });

        const rawContent = response.data.choices[0].message.content.trim();

        // ── Sauvegarder l'échange dans l'historique Groq ──
        store.groqMessages.push({ role: 'user', content: userMsg });
        store.groqMessages.push({ role: 'assistant', content: rawContent });
        if (store.groqMessages.length > 40) store.groqMessages = store.groqMessages.slice(-40);

        const parsed = JSON.parse(rawContent);

        // Valider les champs essentiels
        if (!parsed.tourPredit || !parsed.multPredit || !parsed.confiance) return null;

        return {
            tourPredit:      parseInt(parsed.tourPredit) || mathResult.predictedTour,
            heurePredit:     parsed.heurePredit || mathResult.predictedTime,
            multPredit:      parseFloat(parsed.multPredit) || mathResult.predictedMult,
            multMin:         parseFloat(parsed.multMin) || Math.max(1.5, parseFloat(parsed.multPredit) * 0.6),
            multMax:         parseFloat(parsed.multMax) || parseFloat(parsed.multPredit) * 1.8,
            confiance:       Math.min(99, Math.max(0, parseInt(parsed.confiance))),
            signal:          parsed.signal || 'MODÉRÉ',
            tendanceHex:     parsed.tendanceHex || 'NEUTRE',
            patternDetecte:  parsed.patternDetecte || 'Pattern standard détecté',
            conseil:         parsed.conseil || 'Mise prudente recommandée',
            ajustement:      parsed.ajustement || 'STABLE',
        };
    } catch (err) {
        console.error('[CosmoX Groq] Erreur:', err.message);
        return null;
    }
}

// ─── Formateur de la réponse enrichie ─────────────────────────────────────────
function buildEnrichedResponse(input, mathResult, groq, store) {
    const { mult, tour, time, hex } = input;

    // Choisir la source de vérité : Groq si disponible, sinon mathématique
    const tourFinal  = groq ? groq.tourPredit   : mathResult.predictedTour;
    const heureFinal = groq ? groq.heurePredit  : mathResult.predictedTime;
    const multFinal  = groq ? groq.multPredit   : mathResult.predictedMult;
    const confFinal  = groq ? groq.confiance    : mathResult.confidence;

    // Labels dynamiques selon Groq
    let confLabel, confBar;
    if      (confFinal >= 93) { confLabel = '🌌 COSMIQUE MAXIMAL';  confBar = '██████████'; }
    else if (confFinal >= 85) { confLabel = '🔥 ULTRA HAUTE';       confBar = '█████████░'; }
    else if (confFinal >= 75) { confLabel = '⚡ TRÈS HAUTE';         confBar = '████████░░'; }
    else if (confFinal >= 65) { confLabel = '✅ HAUTE';              confBar = '███████░░░'; }
    else if (confFinal >= 55) { confLabel = '📊 MODÉRÉE';            confBar = '██████░░░░'; }
    else                       { confLabel = '⚠️ NORMALE';           confBar = '█████░░░░░'; }

    let multZone;
    if      (multFinal >= 20) multZone = '🏆 JACKPOT ×20+';
    else if (multFinal >= 15) multZone = '🌌 EXPLOSION ×15+';
    else if (multFinal >= 10) multZone = '🔥 ULTRA ×10+';
    else if (multFinal >= 7)  multZone = '⚡ TRÈS ÉLEVÉ ×7+';
    else if (multFinal >= 5)  multZone = '🎯 CIBLE ×5+';
    else                       multZone = '📊 STANDARD';

    const ajustIcon = groq
        ? (groq.ajustement === 'HAUSSE' ? '▲ GROQ +' : groq.ajustement === 'BAISSE' ? '▼ GROQ -' : '● GROQ ≈')
        : '● ALGO';
    const calibLine = store.calibration !== 1.0
        ? `${D.ln}  Calibrage actif : ${store.calibration.toFixed(3)}\n`
        : '';

    // Top 3 fenêtres candidates
    const top3 = mathResult.candidates
        .filter(c => c.predictedMult >= TARGET_MIN_X)
        .sort((a, b) => b.predictedMult - a.predictedMult)
        .slice(0, 3);
    let windowsBlock = '';
    if (top3.length > 0) {
        windowsBlock = `${D.sep}\n${D.ln}  📡 FENÊTRES DÉTECTÉES (≥ 5×)\n${D.ln}\n`;
        top3.forEach((w, i) => {
            const lbl = i === 0 ? '🎯 Priorité 1' : i === 1 ? '⚡ Priorité 2' : '📊 Priorité 3';
            windowsBlock += `${D.ln}  ${lbl}\n${D.ln}  Tour : ${w.predictedTour}   Heure : ${w.predictedTime}\n${D.ln}  Multiplicateur : ${w.predictedMult.toFixed(2)}×\n` + (i < top3.length - 1 ? `${D.ln}\n` : '');
        });
    }

    // Bloc Groq AI (uniquement si disponible)
    let groqBlock = '';
    if (groq) {
        const tendHexIcon = groq.tendanceHex === 'CHAUD' ? '🔥' : groq.tendanceHex === 'FROID' ? '❄️' : '〰️';
        groqBlock =
            `${D.sep}\n` +
            `${D.ln}  🤖 ANALYSE GROQ AI (Llama 3.3-70B)\n${D.ln}\n` +
            `${D.ln}  Pattern    : ${groq.patternDetecte}\n` +
            `${D.ln}  Hex trend  : ${tendHexIcon} ${groq.tendanceHex}\n` +
            `${D.ln}  Signal     : ${groq.signal}\n` +
            `${D.ln}  Fourchette : ${groq.multMin.toFixed(2)}× → ${groq.multMax.toFixed(2)}×\n` +
            `${D.ln}  Ajustement : ${ajustIcon}\n` +
            `${D.ln}  Conseil    : ${groq.conseil}\n`;
    }

    const nConf = store.history.filter(h => h.actual !== null).length;
    const sessionLine = nConf > 0
        ? `${D.ln}  Session : ${store.history.length} prédictions | ${nConf} confirmées\n`
        : '';

    return (
        `${D.top}\n` +
        `${D.ln}  🌌 COSMOSX — PRÉDICTION IA PREMIUM\n` +
        `${D.mid}\n` +
        `${D.ln}  📥 DONNÉES REÇUES\n${D.ln}\n` +
        `${D.ln}  Multiplicateur : ${mult.toFixed(2)}×\n` +
        `${D.ln}  Tour           : ${tour}\n` +
        `${D.ln}  Heure          : ${formatTime(time.ts)}\n` +
        `${D.ln}  Hex            : ${hex}\n` +
        `${D.sep}\n` +
        `${D.ln}  🔬 ANALYSE MATHÉMATIQUE\n${D.ln}\n` +
        `${D.ln}  Entropie hex   : ${mathResult.entrRatio}%\n` +
        `${D.ln}  Durée/round    : ~${mathResult.roundDur} sec\n` +
        calibLine +
        sessionLine +
        `${D.ln}  Rounds scannés : 12 fenêtres\n` +
        groqBlock +
        `${D.sep}\n` +
        `${D.ln}  🎯 PRÉDICTION FINALE (IA + ALGO)\n${D.ln}\n` +
        `${D.ln}  Tour prédit           : ${tourFinal}\n` +
        `${D.ln}  Heure                 : ${heureFinal}\n` +
        `${D.ln}  Multiplicateur prédit : ${multFinal.toFixed(2)}×\n${D.ln}\n` +
        `${D.ln}  ${multZone}\n` +
        windowsBlock +
        `${D.sep}\n` +
        `${D.ln}  🛡️ SCORE DE CONFIANCE\n${D.ln}\n` +
        `${D.ln}  ${confBar}  ${confFinal}%\n` +
        `${D.ln}  ${confLabel}\n` +
        `${D.sep}\n` +
        `${D.ln}  💡 STRATÉGIE\n` +
        `${D.ln}  • Misez au tour prédit\n` +
        `${D.ln}  • Encaissez dès la cible atteinte\n` +
        `${D.ln}  • Mise conseillée : max 5% bankroll\n` +
        D.bot
    );
}

// ─── Enregistrer résultat réel ────────────────────────────────────────────────
function applyResult(store, tourNum, actualMx) {
    const idx = store.history.findLastIndex(h => h.predictedTour === tourNum && h.actual === null);
    if (idx === -1) return { ok: false };

    store.history[idx].actual      = actualMx;
    store.history[idx].confirmedAt = new Date().toLocaleTimeString('fr-FR');
    const oldCalib   = store.calibration;
    store.calibration = computeCalibration(store.history);
    store.awaitingResult = null;

    const pred       = store.history[idx].predictedMult;
    const errPct     = Math.round(Math.abs(actualMx - pred) / pred * 100);
    const hit        = actualMx >= TARGET_MIN_X;
    const hitLabel   = hit ? '✅ CIBLE ATTEINTE !' : '❌ Sous la cible';
    const calibDelta = store.calibration - oldCalib;
    const calibInfo  = Math.abs(calibDelta) > 0.005
        ? `${oldCalib.toFixed(3)} → ${store.calibration.toFixed(3)} ${calibDelta > 0 ? '▲' : '▼'}`
        : `stable (${store.calibration.toFixed(3)})`;

    let qualité;
    if      (errPct <= 10) qualité = '🌌 Précision parfaite';
    else if (errPct <= 25) qualité = '🔥 Très bonne précision';
    else if (errPct <= 50) qualité = '✅ Bonne précision';
    else if (errPct <= 80) qualité = '📊 Précision correcte';
    else                   qualité = '⚠️ Écart important — recalibrage';

    const msg =
        `${D.top}\n` +
        `${D.ln}  📊 RÉSULTAT CONFIRMÉ\n` +
        `${D.mid}\n` +
        `${D.ln}  Tour         : ${tourNum}\n` +
        `${D.ln}  Prédit       : ${pred.toFixed(2)}×\n` +
        `${D.ln}  Réel         : ${actualMx.toFixed(2)}×\n` +
        `${D.ln}  Écart        : ±${errPct}%\n` +
        `${D.ln}  Qualité      : ${qualité}\n` +
        `${D.ln}  Statut       : ${hitLabel}\n` +
        `${D.sep}\n` +
        `${D.ln}  🧬 APPRENTISSAGE AUTO\n` +
        `${D.ln}  Calibrage : ${calibInfo}\n` +
        `${D.ln}  Groq affinera la prochaine prédiction !\n` +
        `${D.bot}`;

    return { ok: true, msg };
}

// ─── Commandes ────────────────────────────────────────────────────────────────
async function handleResult(sid, args) {
    const store = getStore(sid);
    const parts = args.trim().split(/\s+/);
    if (parts.length < 2) {
        await sendMessage(sid, `⚠️ Format : résultat [tour] [multiplicateur_réel]\nExemple : résultat 8419185 12.40`);
        return;
    }
    const tourNum  = parseInt(parts[0], 10);
    const actualMx = parseFloat(parts[1].replace(',', '.'));
    if (isNaN(tourNum) || isNaN(actualMx) || actualMx < 1.0) {
        await sendMessage(sid, `⚠️ Valeurs invalides. Tour = entier, multiplicateur ≥ 1.00`);
        return;
    }
    const { ok, msg } = applyResult(store, tourNum, actualMx);
    if (!ok) {
        await sendMessage(sid, `🔍 Aucune prédiction en attente pour le tour ${tourNum}.\nTapez "historique" pour voir vos prédictions.`);
        return;
    }
    await sendMessage(sid, msg);
}

async function handleHistory(sid) {
    const store = getStore(sid);
    if (!store.history.length) {
        await sendMessage(sid, `📋 Aucune prédiction enregistrée.\n\nFaites votre première prédiction CosmosX !`);
        return;
    }
    const last5 = store.history.slice(-5).reverse();
    let rows = '';
    last5.forEach((h, i) => {
        const num    = store.history.length - i;
        const status = h.actual === null ? '⏳ En attente'
            : h.actual >= TARGET_MIN_X ? `✅ ${h.actual.toFixed(2)}× (réel)` : `❌ ${h.actual.toFixed(2)}× (réel)`;
        const errStr = h.actual !== null ? `  Écart : ±${Math.round(Math.abs(h.actual - h.predictedMult) / h.predictedMult * 100)}%` : '';
        rows += `${D.sep}\n${D.ln}  #${num} — Tour ${h.predictedTour}\n${D.ln}  Prédit : ${h.predictedMult.toFixed(2)}×   ${h.predictedTime}\n${D.ln}  ${status}${errStr}\n`;
        if (h.actual === null) rows += `${D.ln}  ↳ résultat ${h.predictedTour} [mult_réel]\n`;
    });
    await sendMessage(sid,
        `${D.top}\n${D.ln}  📋 HISTORIQUE — 5 DERNIÈRES\n${D.mid}\n${D.ln}  Calibrage actuel : ${store.calibration.toFixed(3)}\n` + rows + D.bot
    );
}

async function handleStats(sid) {
    const store = getStore(sid);
    const stats = computeStats(store.history);
    if (!stats) {
        await sendMessage(sid,
            `📊 Pas encore de résultats confirmés.\n\nRépondez aux questions après chaque prédiction pour que l'algorithme s'améliore.`
        );
        return;
    }
    const precBar  = '█'.repeat(Math.round(stats.precision / 10)) + '░'.repeat(10 - Math.round(stats.precision / 10));
    let precLevel;
    if      (stats.precision >= 80) precLevel = '🌌 EXCEPTIONNEL';
    else if (stats.precision >= 65) precLevel = '🔥 TRÈS BON';
    else if (stats.precision >= 50) precLevel = '✅ BON';
    else if (stats.precision >= 35) precLevel = '📊 CORRECT';
    else                             precLevel = '⚠️ EN APPRENTISSAGE';
    const cf     = store.calibration;
    const cfDesc = cf > 1.05 ? `▲ Boost (+${((cf-1)*100).toFixed(1)}%)` : cf < 0.95 ? `▼ Réduction (${((cf-1)*100).toFixed(1)}%)` : `✓ Neutre`;
    await sendMessage(sid,
        `${D.top}\n${D.ln}  📊 STATISTIQUES DE PRÉCISION\n${D.mid}\n` +
        `${D.ln}  Prédictions totales : ${stats.total}\n` +
        `${D.ln}  Résultats confirmés : ${stats.nConf}\n` +
        `${D.sep}\n${D.ln}  🎯 TAUX DE RÉUSSITE (≥ 5×)\n` +
        `${D.ln}  ${stats.hits} / ${stats.nConf} → ${stats.hitRate}%\n` +
        `${D.ln}  Tendance : ${stats.tendance}\n` +
        `${D.sep}\n${D.ln}  📐 PRÉCISION MOYENNE\n` +
        `${D.ln}  Erreur relative : ±${stats.avgErrPct}%\n` +
        `${D.ln}  Score : ${precBar} ${stats.precision}%\n` +
        `${D.ln}  Niveau : ${precLevel}\n` +
        `${D.sep}\n${D.ln}  🏆 MEILLEURE PRÉDICTION\n` +
        `${D.ln}  Tour ${stats.best.predictedTour} — Prédit ${stats.best.predictedMult.toFixed(2)}×\n` +
        `${D.ln}  Réel : ${stats.best.actual.toFixed(2)}×  Écart : ±${Math.round(Math.abs(stats.best.actual - stats.best.predictedMult) / stats.best.predictedMult * 100)}%\n` +
        `${D.sep}\n${D.ln}  🧬 CALIBRAGE AUTO\n` +
        `${D.ln}  Facteur : ${cf.toFixed(3)}  ${cfDesc}\n` +
        `${D.sep}\n${D.ln}  🤖 Groq AI actif — ${store.groqMessages.length / 2 | 0} analyses en mémoire\n` +
        D.bot
    );
}

async function handleReset(sid) {
    userStore.set(sid, { history: [], calibration: 1.0, awaitingResult: null, groqMessages: [] });
    await sendMessage(sid,
        `${D.top}\n${D.ln}  🔄 RÉINITIALISATION COMPLÈTE\n${D.mid}\n` +
        `${D.ln}  Historique effacé ✅\n` +
        `${D.ln}  Calibrage remis à 1.000 ✅\n` +
        `${D.ln}  Mémoire Groq AI effacée ✅\n` +
        `${D.ln}  Session réinitialisée ✅\n${D.sep}\n` +
        `${D.ln}  L'algorithme repart de zéro.\n` +
        `${D.ln}  Faites une nouvelle prédiction !\n` +
        D.bot
    );
}

async function handleComparer(sid, raw) {
    const store  = getStore(sid);
    const blocks = raw.trim().split(/\n\s*---\s*\n|\n{2,}/);
    const parsed = blocks.map(b => parseInput(b.trim())).filter(Boolean);

    if (parsed.length < 2) {
        await sendMessage(sid,
            `⚠️ Envoyez 2 à 4 blocs de données séparés par "---"\n\n` +
            `Exemple :\n` +
            `Multiplicateur : 3.75\nTour : 8419176\nHeure : 08:14:57\nHex : 421cd5a4\n` +
            `---\n` +
            `Multiplicateur : 5.20\nTour : 8419200\nHeure : 08:25:10\nHex : 7b3fa12c`
        );
        return;
    }

    await sendMessage(sid, `🔬 Comparaison de ${parsed.length} rounds en cours...`);
    await new Promise(r => setTimeout(r, 1500));

    const results = parsed.map(p => ({
        input: p,
        result: predictCosmosX(p.mult, p.tour, p.time, p.hex, store.calibration)
    }));

    results.sort((a, b) => b.result.predictedMult - a.result.predictedMult);

    let body = '';
    results.forEach((r, i) => {
        const rank  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
        const arrow = i === 0 ? ' ← MEILLEUR' : '';
        body +=
            `${D.sep}\n` +
            `${D.ln}  ${rank} Tour réf : ${r.input.tour}${arrow}\n` +
            `${D.ln}  Tour prédit  : ${r.result.predictedTour}\n` +
            `${D.ln}  Heure        : ${r.result.predictedTime}\n` +
            `${D.ln}  Multiplicateur : ${r.result.predictedMult.toFixed(2)}×\n` +
            `${D.ln}  Confiance    : ${r.result.confidence}%\n`;
    });

    await sendMessage(sid,
        `${D.top}\n` +
        `${D.ln}  🔬 COMPARAISON — ${results.length} ROUNDS\n` +
        `${D.mid}\n` +
        `${D.ln}  Calibrage actif : ${store.calibration.toFixed(3)}\n` +
        body +
        `${D.sep}\n` +
        `${D.ln}  💡 Misez sur le round classé 🥇\n` +
        `${D.ln}  Meilleur signal détecté ci-dessus.\n` +
        D.bot
    );
}

async function sendHelp(sid) {
    await sendMessage(sid,
        `${D.top}\n${D.ln}  👑 COSMOSX — GUIDE COMPLET\n${D.mid}\n` +
        `${D.ln}  📋 PRÉDICTION :\n${D.ln}\n` +
        `${D.ln}  Multiplicateur : 3.75\n` +
        `${D.ln}  Tour : 8419176\n` +
        `${D.ln}  Heure : 08:14:57\n` +
        `${D.ln}  Hex : 421cd5a4\n` +
        `${D.sep}\n` +
        `${D.ln}  🤖 GROQ AI (Llama 3.3-70B) :\n` +
        `${D.ln}  Analyse l'historique complet\n` +
        `${D.ln}  et affine chaque prédiction.\n` +
        `${D.ln}  Plus vous utilisez, plus il\n` +
        `${D.ln}  apprend vos patterns.\n` +
        `${D.sep}\n` +
        `${D.ln}  🔁 APRÈS CHAQUE PRÉDICTION :\n` +
        `${D.ln}  Répondez : [mult_réel] [tour_réel]\n` +
        `${D.ln}  Exemple  : 12.40 8419185\n` +
        `${D.ln}  Ou tapez : skip  (pour ignorer)\n` +
        `${D.sep}\n` +
        `${D.ln}  📋 historique — 5 dernières\n` +
        `${D.ln}  📊 stats       — précision globale\n` +
        `${D.ln}  🔬 comparer    — comparer 2+ rounds\n` +
        `${D.ln}  🔄 reset       — réinitialiser tout\n` +
        `${D.sep}\n` +
        `${D.ln}  🧬 L'algo + Groq apprennent\n` +
        `${D.ln}  et s'affinent automatiquement.\n` +
        D.bot
    );
}

// ─── MODULE PRINCIPAL ─────────────────────────────────────────────────────────
module.exports = async (senderId, prompt) => {
    const input = (prompt || '').trim();
    const lower = input.toLowerCase();
    const store = getStore(senderId);

    // ── 1. Commandes globales ─────────────────────────────────────────────────
    if (!input || ['aide', 'help', '?', 'info', 'guide'].includes(lower)) {
        await sendHelp(senderId); return;
    }
    if (lower === 'historique' || lower === 'history') {
        await handleHistory(senderId); return;
    }
    if (lower === 'stats' || lower === 'statistiques' || lower === 'stat') {
        await handleStats(senderId); return;
    }
    if (lower === 'reset' || lower === 'réinitialiser' || lower === 'reinitialiser') {
        await handleReset(senderId); return;
    }
    if (lower.startsWith('comparer') || lower.startsWith('compare')) {
        const payload = input.replace(/^comparer?\s*/i, '').trim();
        await handleComparer(senderId, payload || input); return;
    }

    const resultMatch = input.match(/^(?:résultat|resultat|result)\s+(.+)$/i);
    if (resultMatch) {
        await handleResult(senderId, resultMatch[1]); return;
    }

    // ── 2. Réponse calibrage en attente ───────────────────────────────────────
    if (store.awaitingResult) {
        const aw = store.awaitingResult;

        if (['skip', 'passer', 'non', 'no', 'annuler', 'cancel', 'ignorer'].includes(lower)) {
            store.awaitingResult = null;
            await sendMessage(senderId, `⏭️ Résultat ignoré.\n\nEnvoyez de nouvelles données pour une prochaine prédiction.`);
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
                const confirmed = store.history.filter(h => h.actual !== null).length;
                if (confirmed >= 3 && confirmed % 3 === 0) {
                    await new Promise(r => setTimeout(r, 800));
                    const s = computeStats(store.history);
                    if (s) {
                        await sendMessage(senderId,
                            `📈 Mise à jour rapide :\n` +
                            `Taux de réussite : ${s.hitRate}%  (${s.hits}/${s.nConf})\n` +
                            `Précision moyenne : ±${s.avgErrPct}%\n` +
                            `Calibrage actuel : ${store.calibration.toFixed(3)}\n` +
                            `🤖 Groq a ${store.groqMessages.length / 2 | 0} analyses en mémoire\n\n` +
                            `Tapez "stats" pour le rapport complet.`
                        );
                    }
                }
                return;
            } else {
                const lastPending = store.history.slice().reverse().find(h => h.actual === null);
                if (lastPending) {
                    const { ok: ok2, msg: msg2 } = applyResult(store, lastPending.predictedTour, actualMx);
                    if (ok2) { await sendMessage(senderId, msg2); return; }
                }
                store.awaitingResult = null;
                await sendMessage(senderId, `🔍 Tour introuvable. Résultat non enregistré.\nContinuez avec une nouvelle prédiction.`);
                return;
            }
        }
    }

    // ── 3. Nouvelle prédiction principale ─────────────────────────────────────
    const parsed = parseInput(input);
    if (!parsed) {
        const reminder = store.awaitingResult
            ? `\n\n💬 Rappel : répondez avec le vrai résultat ou tapez "skip".`
            : `\n\nTapez "aide" pour le guide complet.`;
        await sendMessage(senderId,
            `⚠️ Format non reconnu.\n\n` +
            `📋 Envoyez les données :\n\n` +
            `Multiplicateur : 3.75\n` +
            `Tour : 8419176\n` +
            `Heure : 08:14:57\n` +
            `Hex : 421cd5a4` + reminder
        );
        return;
    }

    store.awaitingResult = null;
    const { mult, tour, time, hex } = parsed;

    // ── Message de chargement ──
    const nPrev = store.history.filter(h => h.actual !== null).length;
    const loadLine = nPrev > 0
        ? `🧠 Groq analyse ${nPrev} tours historiques...`
        : `🔍 Première analyse — Groq initialise le modèle...`;

    await sendMessage(senderId,
        `🌌 CosmosX — Analyse IA en cours...\n` +
        `⚛️ Calcul algorithmique + ${loadLine}\n\n` +
        `🔑 Hex analysé : ${hex}\n` +
        `📍 Tour de référence : ${tour}` +
        (store.calibration !== 1.0 ? `\n🧬 Calibrage actif : ${store.calibration.toFixed(3)}` : '')
    );

    // ── Calcul mathématique (synchrone) ──
    const mathResult = predictCosmosX(mult, tour, time, hex, store.calibration);

    // ── Appel Groq AI (asynchrone, en parallèle avec délai d'attente) ──
    const [groqResult] = await Promise.all([
        callGroqPrediction(store, { mult, tour, time, hex }, mathResult),
        new Promise(r => setTimeout(r, 1500))
    ]);

    // ── Sauvegarder dans l'historique ──
    const finalMult = groqResult ? groqResult.multPredit : mathResult.predictedMult;
    const finalTour = groqResult ? groqResult.tourPredit : mathResult.predictedTour;

    const entry = {
        id: Date.now(), tour,
        predictedTour: finalTour,
        predictedMult: finalMult,
        predictedTime: groqResult ? groqResult.heurePredit : mathResult.predictedTime,
        actual: null,
        createdAt: new Date().toLocaleTimeString('fr-FR'),
    };
    store.history.push(entry);
    if (store.history.length > MAX_HISTORY) store.history.shift();

    store.awaitingResult = {
        entryIdx:      store.history.length - 1,
        predictedTour: finalTour,
        predictedMult: finalMult,
    };

    // ── Construire et envoyer la réponse enrichie ──
    const response = buildEnrichedResponse(parsed, mathResult, groqResult, store);
    await sendMessage(senderId, response);

    // ── Question automatique de calibrage ──
    await new Promise(r => setTimeout(r, 1000));
    await sendMessage(senderId,
        `╔════════════════════════════════════╗\n` +
        `║  🔔 CALIBRAGE EN TEMPS RÉEL        ║\n` +
        `╠════════════════════════════════════╣\n` +
        `║                                    ║\n` +
        `║  Quand le tour ${String(finalTour).padEnd(19)}║\n` +
        `║  se termine, quel était            ║\n` +
        `║  le multiplicateur ≥ 5× réel ?     ║\n` +
        `║                                    ║\n` +
        `║  Répondez avec :                   ║\n` +
        `║  [mult_réel] [tour_réel]           ║\n` +
        `║  Exemple : 12.40 ${String(finalTour).padEnd(18)}║\n` +
        `║  Ou juste : 12.40  (si même tour)  ║\n` +
        `║                                    ║\n` +
        `║  Tapez "skip" pour ignorer         ║\n` +
        `╚════════════════════════════════════╝`
    );
};
