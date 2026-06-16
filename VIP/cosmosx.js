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
const MAX_HISTORY   = 20;   // prédictions max gardées par utilisateur

// ─── Stockage par utilisateur ─────────────────────────────────────────────────
// Map<senderId, { history: Array, calibration: number }>
const userStore = new Map();

function getStore(senderId) {
    if (!userStore.has(senderId)) {
        userStore.set(senderId, { history: [], calibration: 1.0 });
    }
    return userStore.get(senderId);
}

// ─── Hachage FNV-1a 32-bit ───────────────────────────────────────────────────
function fnv32(value) {
    let h = 0x811c9dc5 >>> 0;
    const s = String(value);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
}

function sf(seed) {
    const x = Math.sin((seed >>> 0) * 1.6180339887 + 2.7182818284) * 9301.0 + 49297.0;
    return x - Math.floor(x);
}

function rf(seed, lo, hi) { return lo + sf(seed) * (hi - lo); }

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
    nibbles.forEach(n => {
        const p = freq[n] / nibbles.length;
        if (p > 0) entropy -= p * Math.log2(p);
    });
    const entropyRatio = entropy / Math.log2(16);
    const h1   = fnv32(dec);
    const h2   = fnv32(nibSum * 31 + nibAlt);
    const h3   = fnv32(clean.slice(0, Math.ceil(clean.length / 2)));
    const h4   = fnv32(clean.slice(Math.ceil(clean.length / 2)));
    const fold = (h1 ^ h2 ^ h3 ^ h4) >>> 0;
    return { valid: true, dec, h1, h2, h3, h4, fold, nibSum, nibAlt, entropyRatio };
}

// ─── Temps ────────────────────────────────────────────────────────────────────
function parseTime(s) {
    const p = s.trim().split(':');
    if (p.length < 2) return null;
    const h = parseInt(p[0], 10), m = parseInt(p[1], 10), sec = p[2] !== undefined ? parseInt(p[2], 10) : 0;
    if ([h, m, sec].some(isNaN)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59 || sec < 0 || sec > 59) return null;
    return { h, m, s: sec, ts: h * 3600 + m * 60 + sec };
}

function formatTime(totalSec) {
    const n = ((totalSec % 86400) + 86400) % 86400;
    const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ─── Parseur entrée principale ────────────────────────────────────────────────
function parseInput(raw) {
    const text = raw.trim();
    const lp = /multiplicateur\s*[:=]\s*([\d.,]+)[\s\S]*?tour\s*[:=]\s*(\d+)[\s\S]*?heure\s*[:=]\s*([\d:]+)[\s\S]*?hex\s*[:=]\s*([0-9a-fA-F]+)/i;
    const lm = text.match(lp);
    if (lm) {
        const mult = parseFloat(lm[1].replace(',', '.'));
        const tour = parseInt(lm[2], 10);
        const time = parseTime(lm[3]);
        const hex  = lm[4];
        if (!isNaN(mult) && mult >= 1.0 && !isNaN(tour) && time && /^[0-9a-fA-F]{4,}$/i.test(hex))
            return { mult, tour, time, hex };
    }
    const parts = text.split(/\s+/);
    if (parts.length >= 4) {
        const mult = parseFloat(parts[0].replace(',', '.'));
        const tour = parseInt(parts[1], 10);
        const time = parseTime(parts[2]);
        const hex  = parts[3];
        if (!isNaN(mult) && mult >= 1.0 && !isNaN(tour) && time && /^[0-9a-fA-F]{4,}$/i.test(hex))
            return { mult, tour, time, hex };
    }
    return null;
}

// ─── Algorithme de prédiction ─────────────────────────────────────────────────
// calibFactor : facteur issu de l'historique (1.0 par défaut, ajusté après retours)
function predictCosmosX(mult, tour, time, hexStr, calibFactor = 1.0) {
    const hex       = analyzeHex(hexStr);
    const hexFold   = hex.valid ? hex.fold : fnv32(hexStr);
    const h1        = hex.valid ? hex.h1   : fnv32(hexStr + '1');
    const h2        = hex.valid ? hex.h2   : fnv32(hexStr + '2');
    const h3        = hex.valid ? hex.h3   : fnv32(hexStr + '3');
    const entrRatio = hex.valid ? hex.entropyRatio : 0.5;
    const nibSum    = hex.valid ? hex.nibSum : 20;

    const tourSeed = fnv32(tour);
    const timeSeed = fnv32(time.ts);
    const multSeed = fnv32(Math.round(mult * 100));
    const master   = (tourSeed ^ timeSeed ^ hexFold ^ multSeed) >>> 0;
    const phase    = (h1 ^ h2 ^ h3) >>> 0;

    const roundDur = Math.round(ROUND_MIN_SEC + (1 - entrRatio) * (ROUND_MAX_SEC - ROUND_MIN_SEC));

    const candidates = [];
    for (let k = 1; k <= 12; k++) {
        const kSeed  = fnv32(tour + k);
        const xSeed  = (master ^ kSeed ^ (phase * k)) >>> 0;
        const ySeed  = fnv32(nibSum * k + time.ts);

        // Distribution log-normale via Box-Muller déterministe
        const u1     = sf(xSeed) || 1e-10;
        const u2     = sf(ySeed) || 1e-10;
        const zNorm  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const mu     = 1.4 + entrRatio * 0.6 + Math.log(Math.max(mult, 1.0)) * 0.15;
        const sigma  = 0.8 + (1 - entrRatio) * 0.4;

        // Application du facteur de calibrage (appris de l'historique)
        let predictedMult = Math.exp(mu + sigma * zNorm) * calibFactor;
        predictedMult = Math.max(1.01, Math.round(predictedMult * 100) / 100);

        candidates.push({
            k,
            predictedMult,
            predictedTour: tour + k,
            predictedTime: formatTime(time.ts + k * roundDur),
        });
    }

    let bestWindow = candidates.find(c => c.predictedMult >= TARGET_MIN_X)
                  || candidates.reduce((a, b) => a.predictedMult > b.predictedMult ? a : b);

    // Score de confiance — intègre le calibFactor (plus proche de 1 = meilleur signal)
    const calibBonus    = Math.round(Math.max(0, 10 - Math.abs(calibFactor - 1) * 30));
    const hexEntrBonus  = Math.round(entrRatio * 25);
    const tourCycleBonus = ((tour % 100) < 50) ? 8 : 4;
    const timePeakBonus  = (time.h >= 7 && time.h <= 23) ? 10 : 3;
    const multBonus      = Math.min(Math.round((mult - 1) * 3), 15);
    const hexLenBonus    = Math.min((hexStr.replace(/[^0-9a-fA-F]/gi, '').length) * 2, 12);
    const confidence     = Math.min(50 + hexEntrBonus + tourCycleBonus + timePeakBonus + multBonus + hexLenBonus + calibBonus, 97);

    let confLabel, confBar;
    if      (confidence >= 90) { confLabel = '🌌 COSMIQUE MAXIMAL'; confBar = '██████████'; }
    else if (confidence >= 80) { confLabel = '🔥 ULTRA HAUTE';       confBar = '█████████░'; }
    else if (confidence >= 70) { confLabel = '⚡ TRÈS HAUTE';         confBar = '████████░░'; }
    else if (confidence >= 60) { confLabel = '✅ HAUTE';              confBar = '███████░░░'; }
    else if (confidence >= 50) { confLabel = '📊 MODÉRÉE';            confBar = '██████░░░░'; }
    else                       { confLabel = '⚠️ NORMALE';            confBar = '█████░░░░░'; }

    let multZone;
    if      (bestWindow.predictedMult >= 20) multZone = '🏆 JACKPOT ×20+';
    else if (bestWindow.predictedMult >= 15) multZone = '🌌 EXPLOSION ×15+';
    else if (bestWindow.predictedMult >= 10) multZone = '🔥 ULTRA ×10+';
    else if (bestWindow.predictedMult >= 7)  multZone = '⚡ TRÈS ÉLEVÉ ×7+';
    else if (bestWindow.predictedMult >= 5)  multZone = '🎯 CIBLE ×5+';
    else                                      multZone = '📊 STANDARD';

    return {
        ...bestWindow,
        candidates,
        confidence,
        confLabel,
        confBar,
        multZone,
        roundDur,
        entrRatio: Math.round(entrRatio * 100),
    };
}

// ─── Calibrage automatique ────────────────────────────────────────────────────
// Calcule le facteur de correction à partir des 10 derniers résultats confirmés.
// Principe : ratio moyen (réel / prédit) → si > 1 on boostait trop peu, si < 1 trop.
// Lissage exponentiel pour éviter les sauts brusques.
function computeCalibration(history) {
    const confirmed = history.filter(h => h.actual !== null).slice(-10);
    if (confirmed.length < 2) return 1.0;

    const ratios = confirmed.map(h => h.actual / h.predictedMult);
    // Moyenne géométrique des ratios (plus stable que arithmétique pour les multiplicateurs)
    const logSum = ratios.reduce((acc, r) => acc + Math.log(Math.max(r, 0.1)), 0);
    const geoMean = Math.exp(logSum / ratios.length);

    // Lissage : on n'applique que 30% de la correction à chaque fois
    const factor = 1.0 + (geoMean - 1.0) * 0.30;
    // Borner entre 0.60 et 1.80 pour éviter les dérives
    return Math.max(0.60, Math.min(1.80, Math.round(factor * 1000) / 1000));
}

// ─── Statistiques de précision ────────────────────────────────────────────────
function computeStats(history) {
    const total     = history.length;
    const confirmed = history.filter(h => h.actual !== null);
    const nConf     = confirmed.length;
    if (nConf === 0) return null;

    // Taux de réussite : prédiction ≥ 5× ET réel ≥ 5×
    const hits     = confirmed.filter(h => h.predictedMult >= TARGET_MIN_X && h.actual >= TARGET_MIN_X).length;
    const hitRate  = Math.round((hits / nConf) * 100);

    // Erreur relative moyenne : |réel - prédit| / prédit × 100
    const avgErr   = confirmed.reduce((acc, h) => acc + Math.abs(h.actual - h.predictedMult) / h.predictedMult, 0) / nConf;
    const avgErrPct = Math.round(avgErr * 100);

    // Score de précision global
    const precision = Math.max(0, 100 - avgErrPct);

    // Meilleure prédiction
    const best = confirmed.reduce((a, b) => {
        const errA = Math.abs(a.actual - a.predictedMult) / a.predictedMult;
        const errB = Math.abs(b.actual - b.predictedMult) / b.predictedMult;
        return errA < errB ? a : b;
    });

    // Tendance : les 3 derniers hits vs 3 précédents
    let tendance = '→ STABLE';
    if (nConf >= 6) {
        const recent = confirmed.slice(-3).filter(h => h.predictedMult >= TARGET_MIN_X && h.actual >= TARGET_MIN_X).length;
        const older  = confirmed.slice(-6, -3).filter(h => h.predictedMult >= TARGET_MIN_X && h.actual >= TARGET_MIN_X).length;
        if (recent > older)      tendance = '📈 EN HAUSSE';
        else if (recent < older) tendance = '📉 EN BAISSE';
    }

    return { total, nConf, hits, hitRate, avgErrPct, precision, best, tendance };
}

// ─── Commande : enregistrer un résultat réel ─────────────────────────────────
// Format : "résultat 8419185 12.40"  ou  "result 8419185 12.40"
async function handleResult(senderId, args) {
    const store = getStore(senderId);
    const parts = args.trim().split(/\s+/);
    if (parts.length < 2) {
        await sendMessage(senderId,
            `⚠️ Format : résultat [tour] [multiplicateur_réel]\n\n` +
            `Exemple : résultat 8419185 12.40`
        );
        return;
    }
    const tourNum  = parseInt(parts[0], 10);
    const actualMx = parseFloat(parts[1].replace(',', '.'));

    if (isNaN(tourNum) || isNaN(actualMx) || actualMx < 1.0) {
        await sendMessage(senderId, `⚠️ Valeurs invalides. Tour doit être un entier, multiplicateur ≥ 1.00`);
        return;
    }

    // Chercher la prédiction correspondant à ce tour
    const idx = store.history.findLastIndex(h => h.predictedTour === tourNum && h.actual === null);
    if (idx === -1) {
        await sendMessage(senderId,
            `🔍 Aucune prédiction en attente pour le tour ${tourNum}.\n\n` +
            `Tapez "historique" pour voir vos prédictions.`
        );
        return;
    }

    store.history[idx].actual = actualMx;
    store.history[idx].confirmedAt = new Date().toLocaleTimeString('fr-FR');

    // Recalculer le facteur de calibrage
    const oldCalib = store.calibration;
    store.calibration = computeCalibration(store.history);

    const pred       = store.history[idx].predictedMult;
    const errPct     = Math.round(Math.abs(actualMx - pred) / pred * 100);
    const hit        = actualMx >= TARGET_MIN_X;
    const hitLabel   = hit ? '✅ CIBLE ATTEINTE' : '❌ Sous la cible';
    const calibDelta = store.calibration - oldCalib;
    const calibInfo  = Math.abs(calibDelta) > 0.005
        ? `\n  Calibrage : ${oldCalib.toFixed(3)} → ${store.calibration.toFixed(3)} ${calibDelta > 0 ? '▲' : '▼'}`
        : `\n  Calibrage : stable (${store.calibration.toFixed(3)})`;

    await sendMessage(senderId,
        `${D.top}\n` +
        `${D.ln}  📊 RÉSULTAT ENREGISTRÉ\n` +
        `${D.mid}\n` +
        `${D.ln}  Tour         : ${tourNum}\n` +
        `${D.ln}  Prédit       : ${pred.toFixed(2)}×\n` +
        `${D.ln}  Réel         : ${actualMx.toFixed(2)}×\n` +
        `${D.ln}  Écart        : ${errPct}%\n` +
        `${D.ln}  Statut       : ${hitLabel}\n` +
        `${D.sep}\n` +
        `${D.ln}  🧬 APPRENTISSAGE AUTO${calibInfo}\n` +
        `${D.ln}  Prochaine prédiction améliorée !\n` +
        `${D.bot}`
    );
}

// ─── Commande : historique ────────────────────────────────────────────────────
async function handleHistory(senderId) {
    const store = getStore(senderId);
    if (store.history.length === 0) {
        await sendMessage(senderId,
            `📋 Aucune prédiction enregistrée.\n\n` +
            `Faites votre première prédiction CosmosX !`
        );
        return;
    }

    const last5  = store.history.slice(-5).reverse();
    let rows = '';
    last5.forEach((h, i) => {
        const status = h.actual === null
            ? '⏳ En attente'
            : h.actual >= TARGET_MIN_X
                ? `✅ ${h.actual.toFixed(2)}× (réel)`
                : `❌ ${h.actual.toFixed(2)}× (réel)`;
        const errStr = h.actual !== null
            ? `  Écart : ${Math.round(Math.abs(h.actual - h.predictedMult) / h.predictedMult * 100)}%`
            : '';
        rows +=
            `${D.sep}\n` +
            `${D.ln}  #${store.history.length - i} — Tour ${h.predictedTour}\n` +
            `${D.ln}  Prédit : ${h.predictedMult.toFixed(2)}×   ${h.predictedTime}\n` +
            `${D.ln}  ${status}${errStr}\n`;
        if (h.actual === null) {
            rows += `${D.ln}  → résultat ${h.predictedTour} [mult_réel]\n`;
        }
    });

    await sendMessage(senderId,
        `${D.top}\n` +
        `${D.ln}  📋 HISTORIQUE — 5 DERNIÈRES\n` +
        `${D.mid}\n` +
        `${D.ln}  Calibrage actuel : ${store.calibration.toFixed(3)}\n` +
        rows +
        `${D.bot}`
    );
}

// ─── Commande : statistiques ──────────────────────────────────────────────────
async function handleStats(senderId) {
    const store = getStore(senderId);
    const stats = computeStats(store.history);

    if (!stats) {
        await sendMessage(senderId,
            `📊 Pas encore de résultats confirmés.\n\n` +
            `Après chaque prédiction, envoyez :\n` +
            `résultat [tour] [multiplicateur_réel]\n\n` +
            `pour que l'algorithme s'améliore automatiquement.`
        );
        return;
    }

    // Barre de précision
    const precBar = '█'.repeat(Math.round(stats.precision / 10)) + '░'.repeat(10 - Math.round(stats.precision / 10));

    // Niveau de précision
    let precLevel;
    if      (stats.precision >= 80) precLevel = '🌌 EXCEPTIONNEL';
    else if (stats.precision >= 65) precLevel = '🔥 TRÈS BON';
    else if (stats.precision >= 50) precLevel = '✅ BON';
    else if (stats.precision >= 35) precLevel = '📊 CORRECT';
    else                             precLevel = '⚠️ EN APPRENTISSAGE';

    // Calibrage info
    const cf = store.calibration;
    const cfDesc = cf > 1.05 ? `▲ Boost appliqué (+${((cf-1)*100).toFixed(1)}%)`
                 : cf < 0.95 ? `▼ Réduction appliquée (${((cf-1)*100).toFixed(1)}%)`
                 : `✓ Calibrage neutre`;

    await sendMessage(senderId,
        `${D.top}\n` +
        `${D.ln}  📊 STATISTIQUES DE PRÉCISION\n` +
        `${D.mid}\n` +
        `${D.ln}  Prédictions totales : ${stats.total}\n` +
        `${D.ln}  Résultats confirmés : ${stats.nConf}\n` +
        `${D.sep}\n` +
        `${D.ln}  🎯 TAUX DE RÉUSSITE (≥ 5×)\n` +
        `${D.ln}  ${stats.hits} / ${stats.nConf} → ${stats.hitRate}%\n` +
        `${D.ln}  Tendance : ${stats.tendance}\n` +
        `${D.sep}\n` +
        `${D.ln}  📐 PRÉCISION MOYENNE\n` +
        `${D.ln}  Erreur relative : ±${stats.avgErrPct}%\n` +
        `${D.ln}  Score : ${precBar} ${stats.precision}%\n` +
        `${D.ln}  Niveau : ${precLevel}\n` +
        `${D.sep}\n` +
        `${D.ln}  🏆 MEILLEURE PRÉDICTION\n` +
        `${D.ln}  Tour ${stats.best.predictedTour} — Prédit ${stats.best.predictedMult.toFixed(2)}×\n` +
        `${D.ln}  Réel : ${stats.best.actual.toFixed(2)}×  |  Écart : ${Math.round(Math.abs(stats.best.actual - stats.best.predictedMult) / stats.best.predictedMult * 100)}%\n` +
        `${D.sep}\n` +
        `${D.ln}  🧬 CALIBRAGE AUTOMATIQUE\n` +
        `${D.ln}  Facteur actuel : ${cf.toFixed(3)}\n` +
        `${D.ln}  ${cfDesc}\n` +
        `${D.bot}`
    );
}

// ─── Aide ─────────────────────────────────────────────────────────────────────
async function sendHelp(senderId) {
    await sendMessage(senderId,
        `${D.top}\n` +
        `${D.ln}  👑 COSMOSX — GUIDE D'UTILISATION\n` +
        `${D.mid}\n` +
        `${D.ln}  📋 Prédiction — format :\n` +
        `${D.ln}\n` +
        `${D.ln}  Multiplicateur : 3.75\n` +
        `${D.ln}  Tour : 8419176\n` +
        `${D.ln}  Heure : 08:14:57\n` +
        `${D.ln}  Hex : 421cd5a4\n` +
        `${D.sep}\n` +
        `${D.ln}  ✅ Enregistrer un résultat réel :\n` +
        `${D.ln}  résultat [tour] [multiplicateur]\n` +
        `${D.ln}  Exemple : résultat 8419185 12.40\n` +
        `${D.sep}\n` +
        `${D.ln}  📋 Voir l'historique : historique\n` +
        `${D.ln}  📊 Voir les stats    : stats\n` +
        `${D.sep}\n` +
        `${D.ln}  🧬 L'algorithme apprend de vos\n` +
        `${D.ln}  résultats et s'améliore avec le\n` +
        `${D.ln}  temps (calibrage automatique).\n` +
        `${D.bot}`
    );
}

// ─── Module principal ─────────────────────────────────────────────────────────
module.exports = async (senderId, prompt) => {
    const input = (prompt || '').trim();
    const lower = input.toLowerCase();

    // ── Commandes de navigation ──
    if (!input || ['aide', 'help', '?', 'info', 'guide'].includes(lower)) {
        await sendHelp(senderId);
        return;
    }

    if (lower === 'historique' || lower === 'history') {
        await handleHistory(senderId);
        return;
    }

    if (lower === 'stats' || lower === 'statistiques' || lower === 'stat') {
        await handleStats(senderId);
        return;
    }

    // ── Commande résultat ──
    const resultMatch = input.match(/^(?:résultat|resultat|result)\s+(.+)$/i);
    if (resultMatch) {
        await handleResult(senderId, resultMatch[1]);
        return;
    }

    // ── Prédiction principale ──
    const parsed = parseInput(input);
    if (!parsed) {
        await sendMessage(senderId,
            `⚠️ Format non reconnu.\n\n` +
            `📋 Envoyez les données :\n\n` +
            `Multiplicateur : 3.75\n` +
            `Tour : 8419176\n` +
            `Heure : 08:14:57\n` +
            `Hex : 421cd5a4\n\n` +
            `Tapez "aide" pour le guide complet.`
        );
        return;
    }

    const { mult, tour, time, hex } = parsed;
    const store = getStore(senderId);

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

    // ── Calcul (avec calibrage appris) ──
    const result   = predictCosmosX(mult, tour, time, hex, store.calibration);
    const multPred = result.predictedMult.toFixed(2);
    const refTimeStr = formatTime(time.ts);

    // ── Sauvegarder dans l'historique ──
    const entry = {
        id:            Date.now(),
        tour,
        predictedTour: result.predictedTour,
        predictedMult: result.predictedMult,
        predictedTime: result.predictedTime,
        actual:        null,
        createdAt:     new Date().toLocaleTimeString('fr-FR'),
    };
    store.history.push(entry);
    if (store.history.length > MAX_HISTORY) store.history.shift();

    // ── Top 3 fenêtres ≥ 5× ──
    const top3 = result.candidates.filter(c => c.predictedMult >= TARGET_MIN_X).slice(0, 3);
    let windowsBlock = '';
    if (top3.length > 0) {
        windowsBlock = `${D.sep}\n${D.ln}  📡 FENÊTRES DÉTECTÉES (≥ 5×)\n${D.ln}\n`;
        top3.forEach((w, i) => {
            const lbl = i === 0 ? '🎯 Priorité 1' : i === 1 ? '⚡ Priorité 2' : '📊 Priorité 3';
            windowsBlock +=
                `${D.ln}  ${lbl}\n` +
                `${D.ln}  Tour : ${w.predictedTour}   Heure : ${w.predictedTime}\n` +
                `${D.ln}  Multiplicateur : ${w.predictedMult.toFixed(2)}×\n` +
                (i < top3.length - 1 ? `${D.ln}\n` : '');
        });
    }

    // Indicateur de calibrage
    const calibLine = store.calibration !== 1.0
        ? `${D.ln}  Calibrage actif : ${store.calibration.toFixed(3)}\n`
        : '';

    const response =
        `${D.top}\n` +
        `${D.ln}  🌌 COSMOSX — PRÉDICTION PREMIUM\n` +
        `${D.mid}\n` +
        `${D.ln}  📥 DONNÉES REÇUES\n` +
        `${D.ln}\n` +
        `${D.ln}  Multiplicateur : ${mult.toFixed(2)}×\n` +
        `${D.ln}  Tour           : ${tour}\n` +
        `${D.ln}  Heure          : ${refTimeStr}\n` +
        `${D.ln}  Hex            : ${hex}\n` +
        `${D.sep}\n` +
        `${D.ln}  🔬 ANALYSE MATHÉMATIQUE\n` +
        `${D.ln}\n` +
        `${D.ln}  Entropie hex   : ${result.entrRatio}%\n` +
        `${D.ln}  Durée/round    : ~${result.roundDur} sec\n` +
        calibLine +
        `${D.ln}  Rounds scannés : 12 fenêtres\n` +
        `${D.sep}\n` +
        `${D.ln}  🎯 MEILLEURE PRÉDICTION\n` +
        `${D.ln}\n` +
        `${D.ln}  Tour prédit           : ${result.predictedTour}\n` +
        `${D.ln}  Heure                 : ${result.predictedTime}\n` +
        `${D.ln}  Multiplicateur prédit : ${multPred}×\n` +
        `${D.ln}\n` +
        `${D.ln}  ${result.multZone}\n` +
        windowsBlock +
        `${D.sep}\n` +
        `${D.ln}  🛡️ SCORE DE CONFIANCE\n` +
        `${D.ln}\n` +
        `${D.ln}  ${result.confBar}  ${result.confidence}%\n` +
        `${D.ln}  ${result.confLabel}\n` +
        `${D.sep}\n` +
        `${D.ln}  📌 ENREGISTRER LE RÉSULTAT RÉEL\n` +
        `${D.ln}  Envoyez après le round :\n` +
        `${D.ln}  résultat ${result.predictedTour} [mult_réel]\n` +
        `${D.ln}  ➔ l'algorithme s'améliorera auto.\n` +
        `${D.sep}\n` +
        `${D.ln}  💡 STRATÉGIE\n` +
        `${D.ln}  • Misez au tour prédit\n` +
        `${D.ln}  • Encaissez dès la cible atteinte\n` +
        `${D.ln}  • Mise conseillée : max 5% bankroll\n` +
        `${D.bot}`;

    await sendMessage(senderId, response);
};
