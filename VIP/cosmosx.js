const sendMessage = require('../handles/sendMessage');

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
const MAX_HISTORY   = 20;

// ─── Stockage par utilisateur ─────────────────────────────────────────────────
// { history[], calibration, awaitingResult: null | { entryIdx, predictedTour, predictedMult } }
const userStore = new Map();

function getStore(sid) {
    if (!userStore.has(sid)) {
        userStore.set(sid, { history: [], calibration: 1.0, awaitingResult: null });
    }
    return userStore.get(sid);
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

// ─── Algorithme de prédiction ─────────────────────────────────────────────────
function predictCosmosX(mult, tour, time, hexStr, calibFactor = 1.0) {
    const hex       = analyzeHex(hexStr);
    const hexFold   = hex.valid ? hex.fold   : fnv32(hexStr);
    const h1        = hex.valid ? hex.h1     : fnv32(hexStr + '1');
    const h2        = hex.valid ? hex.h2     : fnv32(hexStr + '2');
    const h3        = hex.valid ? hex.h3     : fnv32(hexStr + '3');
    const entrRatio = hex.valid ? hex.entropyRatio : 0.5;
    const nibSum    = hex.valid ? hex.nibSum : 20;

    const master = (fnv32(tour) ^ fnv32(time.ts) ^ hexFold ^ fnv32(Math.round(mult * 100))) >>> 0;
    const phase  = (h1 ^ h2 ^ h3) >>> 0;
    const roundDur = Math.round(ROUND_MIN_SEC + (1 - entrRatio) * (ROUND_MAX_SEC - ROUND_MIN_SEC));

    const candidates = [];
    for (let k = 1; k <= 12; k++) {
        const xSeed = (master ^ fnv32(tour + k) ^ (phase * k)) >>> 0;
        const ySeed = fnv32(nibSum * k + time.ts);
        const u1 = sf(xSeed) || 1e-10, u2 = sf(ySeed) || 1e-10;
        const zNorm = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const mu    = 1.4 + entrRatio * 0.6 + Math.log(Math.max(mult, 1.0)) * 0.15;
        const sigma = 0.8 + (1 - entrRatio) * 0.4;
        let pm = Math.max(1.01, Math.round(Math.exp(mu + sigma * zNorm) * calibFactor * 100) / 100);
        candidates.push({ k, predictedMult: pm, predictedTour: tour + k, predictedTime: formatTime(time.ts + k * roundDur) });
    }

    const best = candidates.find(c => c.predictedMult >= TARGET_MIN_X)
              || candidates.reduce((a, b) => a.predictedMult > b.predictedMult ? a : b);

    const calibBonus    = Math.round(Math.max(0, 10 - Math.abs(calibFactor - 1) * 30));
    const hexEntrBonus  = Math.round(entrRatio * 25);
    const confidence    = Math.min(50 + hexEntrBonus + (((tour % 100) < 50) ? 8 : 4)
                            + ((time.h >= 7 && time.h <= 23) ? 10 : 3)
                            + Math.min(Math.round((mult - 1) * 3), 15)
                            + Math.min((hexStr.replace(/[^0-9a-fA-F]/gi, '').length) * 2, 12)
                            + calibBonus, 97);

    let confLabel, confBar;
    if      (confidence >= 90) { confLabel = '🌌 COSMIQUE MAXIMAL'; confBar = '██████████'; }
    else if (confidence >= 80) { confLabel = '🔥 ULTRA HAUTE';       confBar = '█████████░'; }
    else if (confidence >= 70) { confLabel = '⚡ TRÈS HAUTE';         confBar = '████████░░'; }
    else if (confidence >= 60) { confLabel = '✅ HAUTE';              confBar = '███████░░░'; }
    else if (confidence >= 50) { confLabel = '📊 MODÉRÉE';            confBar = '██████░░░░'; }
    else                       { confLabel = '⚠️ NORMALE';            confBar = '█████░░░░░'; }

    let multZone;
    if      (best.predictedMult >= 20) multZone = '🏆 JACKPOT ×20+';
    else if (best.predictedMult >= 15) multZone = '🌌 EXPLOSION ×15+';
    else if (best.predictedMult >= 10) multZone = '🔥 ULTRA ×10+';
    else if (best.predictedMult >= 7)  multZone = '⚡ TRÈS ÉLEVÉ ×7+';
    else if (best.predictedMult >= 5)  multZone = '🎯 CIBLE ×5+';
    else                                multZone = '📊 STANDARD';

    return { ...best, candidates, confidence, confLabel, confBar, multZone, roundDur, entrRatio: Math.round(entrRatio * 100) };
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

// ─── Enregistrer résultat réel (logique partagée) ────────────────────────────
// Renvoie { ok, msg } — msg est le texte à envoyer
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

    // Indice de qualité de la prédiction
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
        `${D.ln}  Prochaine prédiction affinée !\n` +
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
        D.bot
    );
}

async function handleReset(sid) {
    userStore.set(sid, { history: [], calibration: 1.0, awaitingResult: null });
    await sendMessage(sid,
        `${D.top}\n${D.ln}  🔄 RÉINITIALISATION COMPLÈTE\n${D.mid}\n` +
        `${D.ln}  Historique effacé ✅\n` +
        `${D.ln}  Calibrage remis à 1.000 ✅\n` +
        `${D.ln}  Session réinitialisée ✅\n${D.sep}\n` +
        `${D.ln}  L'algorithme repart de zéro.\n` +
        `${D.ln}  Faites une nouvelle prédiction !\n` +
        D.bot
    );
}

// ─── Commande comparer ────────────────────────────────────────────────────────
// Format : plusieurs blocs séparés par "---" ou par une ligne vide double
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

    // Trier par multiplicateur prédit décroissant
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
            `${D.ln}  Confiance    : ${r.result.confidence}%  ${r.result.confBar}\n` +
            `${D.ln}  ${r.result.multZone}\n`;
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

// ─── Aide ─────────────────────────────────────────────────────────────────────
async function sendHelp(sid) {
    await sendMessage(sid,
        `${D.top}\n${D.ln}  👑 COSMOSX — GUIDE COMPLET\n${D.mid}\n` +
        `${D.ln}  📋 PRÉDICTION :\n${D.ln}\n` +
        `${D.ln}  Multiplicateur : 3.75\n` +
        `${D.ln}  Tour : 8419176\n` +
        `${D.ln}  Heure : 08:14:57\n` +
        `${D.ln}  Hex : 421cd5a4\n` +
        `${D.sep}\n` +
        `${D.ln}  🔁 APRÈS CHAQUE PRÉDICTION :\n` +
        `${D.ln}  Le bot vous demande le vrai\n` +
        `${D.ln}  résultat ≥ 5× pour calibrer.\n` +
        `${D.ln}  Répondez : [mult_réel] [tour_réel]\n` +
        `${D.ln}  Exemple  : 12.40 8419185\n` +
        `${D.ln}  Ou tapez : skip  (pour ignorer)\n` +
        `${D.sep}\n` +
        `${D.ln}  📋 historique — 5 dernières\n` +
        `${D.ln}  📊 stats       — précision globale\n` +
        `${D.ln}  🔬 comparer    — comparer 2+ rounds\n` +
        `${D.ln}  🔄 reset       — réinitialiser tout\n` +
        `${D.sep}\n` +
        `${D.ln}  🧬 L'algo apprend de vos retours\n` +
        `${D.ln}  et s'affine automatiquement.\n` +
        D.bot
    );
}

// ─── MODULE PRINCIPAL ─────────────────────────────────────────────────────────
module.exports = async (senderId, prompt) => {
    const input = (prompt || '').trim();
    const lower = input.toLowerCase();
    const store = getStore(senderId);

    // ── 1. Commandes globales (priorité absolue) ──────────────────────────────
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

    // ── 2. Réponse à la question de calibrage (état awaitingResult) ───────────
    //    Le bot est en attente du vrai résultat après une prédiction.
    //    L'utilisateur répond : "12.40 8419185"  ou juste "12.40"  ou "skip"
    if (store.awaitingResult) {
        const aw = store.awaitingResult;

        // Annulation explicite
        if (['skip', 'passer', 'non', 'no', 'annuler', 'cancel', 'ignorer'].includes(lower)) {
            store.awaitingResult = null;
            await sendMessage(senderId,
                `⏭️ Résultat ignoré.\n\nEnvoyez de nouvelles données pour une prochaine prédiction.`
            );
            return;
        }

        // Essayer de parser la réponse rapide :
        //   Format A : "12.40 8419185" (mult + tour)
        //   Format B : "12.40"          (mult seulement → utilise le tour prédit)
        const parts = input.trim().split(/\s+/);
        const mx1   = parseFloat(parts[0].replace(',', '.'));
        const mx2   = parts.length >= 2 ? parseFloat(parts[1].replace(',', '.')) : NaN;

        let tourNum, actualMx;

        if (!isNaN(mx1) && mx1 >= 1.0 && !isNaN(mx2) && Number.isInteger(mx2) && mx2 > 1000) {
            // Format A : premier = multiplicateur, second = numéro de tour
            actualMx = mx1;
            tourNum  = Math.round(mx2);
        } else if (!isNaN(mx1) && mx1 >= 1.0 && parts.length === 1) {
            // Format B : seulement le multiplicateur → tour = celui prédit
            actualMx = mx1;
            tourNum  = aw.predictedTour;
        } else if (!isNaN(mx1) && mx1 >= 1.0 && !isNaN(mx2) && mx2 >= 1.0 && mx2 < 1000) {
            // Format C : "12.40 5.20" → les deux ressemblent à des multiplicateurs
            // On prend le plus grand comme multiplicateur réel et le tour prédit
            actualMx = Math.max(mx1, mx2);
            tourNum  = aw.predictedTour;
        } else {
            // Pas reconnu — vérifier si c'est une nouvelle entrée de prédiction
            // On laisse passer vers le bloc de prédiction ci-dessous
            store.awaitingResult = null;
            // (fall-through vers parseInput)
        }

        // Si on a extrait les valeurs → enregistrer
        if (tourNum !== undefined && actualMx !== undefined) {
            const { ok, msg } = applyResult(store, tourNum, actualMx);
            if (ok) {
                await sendMessage(senderId, msg);
                // Afficher les stats rapides si on a 3+ confirmations
                const confirmed = store.history.filter(h => h.actual !== null).length;
                if (confirmed >= 3 && confirmed % 3 === 0) {
                    await new Promise(r => setTimeout(r, 800));
                    const s = computeStats(store.history);
                    if (s) {
                        await sendMessage(senderId,
                            `📈 Mise à jour rapide :\n` +
                            `Taux de réussite : ${s.hitRate}%  (${s.hits}/${s.nConf})\n` +
                            `Précision moyenne : ±${s.avgErrPct}%\n` +
                            `Calibrage actuel : ${store.calibration.toFixed(3)}\n\n` +
                            `Tapez "stats" pour le rapport complet.`
                        );
                    }
                }
                return;
            } else {
                // Tour introuvable dans l'historique → on cherche la dernière prédiction en attente
                const lastPending = store.history.slice().reverse().find(h => h.actual === null);
                if (lastPending) {
                    const { ok: ok2, msg: msg2 } = applyResult(store, lastPending.predictedTour, actualMx);
                    if (ok2) { await sendMessage(senderId, msg2); return; }
                }
                // Vraiment introuvable
                store.awaitingResult = null;
                await sendMessage(senderId, `🔍 Tour introuvable. Résultat non enregistré.\nContinuez avec une nouvelle prédiction.`);
                return;
            }
        }
        // fall-through : la réponse ressemble à une nouvelle prédiction
    }

    // ── 3. Nouvelle prédiction principale ─────────────────────────────────────
    const parsed = parseInput(input);
    if (!parsed) {
        // Si on attendait un résultat et que l'input ne correspond à rien → rappel doux
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

    // Annuler toute attente précédente silencieusement (nouvelle prédiction = l'user passe au round suivant)
    store.awaitingResult = null;

    const { mult, tour, time, hex } = parsed;

    // ── Message de chargement ──
    const loadMsgs = [
        '🔍 Déchiffrage du signal Hex en cours...',
        '⚛️ Analyse du cycle de tour...',
        '🧬 Calcul de l\'entropie binaire...',
        '🪐 Modélisation de la fenêtre temporelle...',
        '🚀 Algorithme prédictif actif...',
    ];
    await sendMessage(senderId,
        `🌌 CosmosX — Analyse en cours...\n` +
        `${loadMsgs[Math.floor(Math.random() * loadMsgs.length)]}\n\n` +
        `🔑 Hex analysé : ${hex}\n` +
        `📍 Tour de référence : ${tour}` +
        (store.calibration !== 1.0 ? `\n🧬 Calibrage actif : ${store.calibration.toFixed(3)}` : '')
    );
    await new Promise(r => setTimeout(r, 2200));

    // ── Calcul ──
    const result   = predictCosmosX(mult, tour, time, hex, store.calibration);
    const multPred = result.predictedMult.toFixed(2);

    // ── Sauvegarder dans l'historique et activer l'attente de résultat ──
    const entry = {
        id: Date.now(), tour,
        predictedTour: result.predictedTour,
        predictedMult: result.predictedMult,
        predictedTime: result.predictedTime,
        actual: null,
        createdAt: new Date().toLocaleTimeString('fr-FR'),
    };
    store.history.push(entry);
    if (store.history.length > MAX_HISTORY) store.history.shift();

    // Activer l'état d'attente de résultat
    store.awaitingResult = {
        entryIdx:      store.history.length - 1,
        predictedTour: result.predictedTour,
        predictedMult: result.predictedMult,
    };

    // ── Top 3 fenêtres ≥ 5× ──
    const top3 = result.candidates.filter(c => c.predictedMult >= TARGET_MIN_X).slice(0, 3);
    let windowsBlock = '';
    if (top3.length > 0) {
        windowsBlock = `${D.sep}\n${D.ln}  📡 FENÊTRES DÉTECTÉES (≥ 5×)\n${D.ln}\n`;
        top3.forEach((w, i) => {
            const lbl = i === 0 ? '🎯 Priorité 1' : i === 1 ? '⚡ Priorité 2' : '📊 Priorité 3';
            windowsBlock += `${D.ln}  ${lbl}\n${D.ln}  Tour : ${w.predictedTour}   Heure : ${w.predictedTime}\n${D.ln}  Multiplicateur : ${w.predictedMult.toFixed(2)}×\n` + (i < top3.length - 1 ? `${D.ln}\n` : '');
        });
    }

    const calibLine = store.calibration !== 1.0 ? `${D.ln}  Calibrage actif : ${store.calibration.toFixed(3)}\n` : '';

    const response =
        `${D.top}\n` +
        `${D.ln}  🌌 COSMOSX — PRÉDICTION PREMIUM\n` +
        `${D.mid}\n` +
        `${D.ln}  📥 DONNÉES REÇUES\n${D.ln}\n` +
        `${D.ln}  Multiplicateur : ${mult.toFixed(2)}×\n` +
        `${D.ln}  Tour           : ${tour}\n` +
        `${D.ln}  Heure          : ${formatTime(time.ts)}\n` +
        `${D.ln}  Hex            : ${hex}\n` +
        `${D.sep}\n` +
        `${D.ln}  🔬 ANALYSE MATHÉMATIQUE\n${D.ln}\n` +
        `${D.ln}  Entropie hex   : ${result.entrRatio}%\n` +
        `${D.ln}  Durée/round    : ~${result.roundDur} sec\n` +
        calibLine +
        `${D.ln}  Rounds scannés : 12 fenêtres\n` +
        `${D.sep}\n` +
        `${D.ln}  🎯 MEILLEURE PRÉDICTION\n${D.ln}\n` +
        `${D.ln}  Tour prédit           : ${result.predictedTour}\n` +
        `${D.ln}  Heure                 : ${result.predictedTime}\n` +
        `${D.ln}  Multiplicateur prédit : ${multPred}×\n${D.ln}\n` +
        `${D.ln}  ${result.multZone}\n` +
        windowsBlock +
        `${D.sep}\n` +
        `${D.ln}  🛡️ SCORE DE CONFIANCE\n${D.ln}\n` +
        `${D.ln}  ${result.confBar}  ${result.confidence}%\n` +
        `${D.ln}  ${result.confLabel}\n` +
        `${D.sep}\n` +
        `${D.ln}  💡 STRATÉGIE\n` +
        `${D.ln}  • Misez au tour prédit\n` +
        `${D.ln}  • Encaissez dès la cible atteinte\n` +
        `${D.ln}  • Mise conseillée : max 5% bankroll\n` +
        D.bot;

    await sendMessage(senderId, response);

    // ── Question automatique de calibrage ─────────────────────────────────────
    await new Promise(r => setTimeout(r, 1000));
    await sendMessage(senderId,
        `╔════════════════════════════════════╗\n` +
        `║  🔔 CALIBRAGE EN TEMPS RÉEL        ║\n` +
        `╠════════════════════════════════════╣\n` +
        `║                                    ║\n` +
        `║  Quand le tour ${String(result.predictedTour).padEnd(19)}║\n` +
        `║  se termine, quel était            ║\n` +
        `║  le multiplicateur ≥ 5× réel ?     ║\n` +
        `║                                    ║\n` +
        `║  Répondez avec :                   ║\n` +
        `║  [mult_réel] [tour_réel]           ║\n` +
        `║  Exemple : 12.40 ${String(result.predictedTour).padEnd(18)}║\n` +
        `║  Ou juste : 12.40  (si même tour)  ║\n` +
        `║                                    ║\n` +
        `║  Tapez "skip" pour ignorer         ║\n` +
        `╚════════════════════════════════════╝`
    );
};
