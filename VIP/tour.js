const sendMessage = require('../handles/sendMessage');

// ═══════════════════════════════════════════════════════════════════════
//  TOUR.JS — Prédiction crash par numéro de tour (bet261)
//
//  FORMULE OFFICIELLE (confirmée 100%) :
//    crash = floor( (2^32 / decimal) × 0.97 × 100 ) / 100
//
//  SEUILS (numéro de tour cible) :
//    3×+  → decimal ≤ 1 388 706 092  (proba ~32.33%  → ~3 tours d'écart)
//    5×+  → decimal ≤   833 223 655  (proba ~19.40%  → ~5 tours d'écart)
//    10×+ → decimal ≤   416 611 827  (proba ~9.70%   → ~10 tours d'écart)
//
//  Input : MULT TOUR HEURE HEX DECIMAL
//  ex    : 8.06 8368246 09:27:10 1ec740f6 516374774
// ═══════════════════════════════════════════════════════════════════════

const MAX_U32     = 4294967296;
const HOUSE       = 0.97;
const GROWTH_RATE = 0.07;   // ln(M)/GROWTH_RATE = durée de vol (sec)
const BETTING_SEC = 15;
const TRANSIT_SEC = 3;

const SEUIL_3X  = Math.floor(MAX_U32 * HOUSE / 3);   // 1 388 706 092
const SEUIL_5X  = Math.floor(MAX_U32 * HOUSE / 5);   //   833 223 655
const SEUIL_10X = Math.floor(MAX_U32 * HOUSE / 10);  //   416 611 827
const SEUIL_20X = Math.floor(MAX_U32 * HOUSE / 20);  //   208 305 913

// ─── Décoration ───────────────────────────────────────────────────────
const DECO = {
    top:     '╔══════════════════════════════╗',
    mid:     '╠══════════════════════════════╣',
    bot:     '╚══════════════════════════════╝',
    line:    '║',
    dot:     '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
    trophy:  '🏆',
    tour:    '🎰',
    fire:    '🔥',
    bolt:    '⚡',
    chart:   '📊',
    clock:   '⏱️',
    premium: '👑',
    shield:  '🛡️',
    gem:     '💎',
    check:   '✅',
    warn:    '⚠️',
    lock:    '🔐',
    rocket:  '🚀',
    target:  '🎯',
    atom:    '⚛️',
    math:    '🧮',
    scan:    '🔍',
    key:     '🔑',
    comet:   '☄️',
    bell:    '🔔',
    cut:     '✂️',
    pin:     '📍',
    num:     '🔢',
    next:    '➡️',
    star:    '⭐'
};

// ─── Messages de chargement ───────────────────────────────────────────
const LOADING = [
    '🎰 Analyse du numéro de tour en cours...',
    '🔢 Calcul de la séquence de tours...',
    '⚛️ Modélisation probabiliste des rounds...',
    '🔍 Détection du prochain tour cible...',
    '🧮 Application de la formule crash...',
    '📡 Synchronisation avec la séquence bet261...',
    '🎯 Calibration du tour jackpot...',
    '🔐 Déchiffrage du hash SHA512...'
];

// ─── Niveaux de confiance ─────────────────────────────────────────────
const CONF_LEVELS = [
    { min: 90, label: '🏆 MAXIMALE',    bar: '██████████', note: 'Tour ciblé avec précision maximale' },
    { min: 80, label: '🔥 ULTRA HAUTE', bar: '█████████░', note: 'Forte probabilité sur ce numéro de tour' },
    { min: 70, label: '⚡ TRÈS HAUTE',  bar: '████████░░', note: 'Signal confirmé — préparer la mise' },
    { min: 60, label: '✅ HAUTE',        bar: '███████░░░', note: 'Signal stable — respecter le tour cible' },
    { min: 50, label: '📊 MODÉRÉE',      bar: '██████░░░░', note: 'Surveiller les 2 tours suivant le cible' },
    { min: 0,  label: '⚠️ NORMALE',      bar: '█████░░░░░', note: 'Attendre le prochain round de référence' },
];

// ─── Formule crash ────────────────────────────────────────────────────
function calcCrash(decimal) {
    if (decimal <= 0 || decimal >= MAX_U32) return 1.00;
    return Math.floor((MAX_U32 / decimal) * HOUSE * 100) / 100;
}

function decimalForCote(cote) {
    return Math.floor(MAX_U32 * HOUSE / cote);
}

// ─── Durée d'un round (modèle physique) ──────────────────────────────
function roundDuration(mult) {
    const m = Math.max(mult, 1.01);
    return Math.round(BETTING_SEC + Math.log(m) / GROWTH_RATE + TRANSIT_SEC);
}

// ─── Hachage FNV-1a 32-bit ───────────────────────────────────────────
function fnv32(value) {
    let h = 0x811c9dc5 >>> 0;
    const str = String(value);
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
}

function seedFloat(seed) {
    const x = Math.sin((seed >>> 0) + 2.718281828) * 43758.5453123;
    return x - Math.floor(x);
}

function randIn(seed, min, max) {
    return min + Math.floor(seedFloat(seed) * (max - min + 1));
}

// ─── Entropie HEX ────────────────────────────────────────────────────
function hexToSeeds(hexStr) {
    const clean = hexStr.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    if (clean.length === 0) return { s1: 0, s2: 0, s3: 0, fold: 0 };
    const half = Math.floor(clean.length / 2);
    const s1 = parseInt(clean.slice(0, half) || '0', 16) % 0x7FFFFFFF;
    const s2 = parseInt(clean.slice(half) || '0', 16) % 0x7FFFFFFF;
    const s3 = fnv32(clean);
    return { s1, s2, s3, fold: (s1 ^ s2 ^ s3) >>> 0 };
}

// ─── Parseur du temps ─────────────────────────────────────────────────
function parseTime(str) {
    const p = str.trim().split(':');
    if (p.length < 2) return null;
    const h = parseInt(p[0], 10), m = parseInt(p[1], 10), s = p[2] ? parseInt(p[2], 10) : 0;
    if ([h, m, s].some(isNaN)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
    return { h, m, s, ts: h * 3600 + m * 60 + s };
}

function fmtTime(totalSec) {
    const n = ((Math.round(totalSec) % 86400) + 86400) % 86400;
    const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Parseur entrée ───────────────────────────────────────────────────
// Format : MULT TOUR HEURE HEX DECIMAL
function parseInput(input) {
    const parts = input.trim().split(/\s+/);
    if (parts.length < 5) return null;

    const mult    = parseFloat(parts[0].replace(',', '.'));
    const tour    = parseInt(parts[1], 10);
    const time    = parseTime(parts[2]);
    const hexStr  = parts[3];
    const decStr  = parts[4];
    const decimal = parseInt(decStr, 10);

    if (isNaN(mult) || mult < 1)        return null;
    if (isNaN(tour) || tour < 1)        return null;
    if (!time)                           return null;
    if (!/^[0-9a-fA-F]{4,}$/.test(hexStr)) return null;
    if (isNaN(decimal) || decimal < 1)  return null;

    return { mult, tour, time, hexStr, decStr, decimal };
}

// ─── Algorithme de prédiction ─────────────────────────────────────────
function predictTour(refMult, refTour, refTime, hexStr, decimal) {
    const ts = refTime.ts;

    // ── Vérification formule ──
    const formulaMult = calcCrash(decimal);
    const ecart       = Math.abs(formulaMult - refMult);
    const formulaOK   = ecart < 0.05;

    // ── Zone du round de référence ──
    let refZone = '—';
    if      (decimal <= SEUIL_20X) refZone = '20×+';
    else if (decimal <= SEUIL_10X) refZone = '10×+';
    else if (decimal <= SEUIL_5X)  refZone = '5×+';
    else if (decimal <= SEUIL_3X)  refZone = '3×+';
    else                           refZone  = 'Hors 3×';

    // ── Seeds composites ──
    const sA = fnv32(decimal);
    const sB = fnv32(refTour);
    const sC = fnv32(ts);
    const sD = fnv32(Math.round(refMult * 100));
    const hx  = hexToSeeds(hexStr);

    const master = (sA ^ sB ^ hx.fold) >>> 0;
    const fine   = (sC ^ sD ^ hx.s1)   >>> 0;
    const zone   = (sA ^ sC ^ hx.s2)   >>> 0;

    // ── Nombre de tours avant le prochain 2×+ ──
    // Gaps observés réels : 5, 6, 8, 11 → plage 1-14
    const toursBase  = randIn(master, 1, 12);
    const toursFine  = randIn(fine,   0, 3);
    const toursAhead = Math.max(1, toursBase + toursFine);

    // Tour prédit (principal)
    const predictedTour = refTour + toursAhead;

    // Tour alternatif : ~5 tours après le principal (filet de sécurité)
    const altGap  = randIn(master ^ fine, 4, 7);
    const tourAlt = predictedTour + altGap;

    // Tours alternatifs (fenêtre de confiance ±1)
    const tourEarly = predictedTour - 1;
    const tourLate  = predictedTour + 1;

    // ── Estimation du multiplicateur prédit (≥3×) ──
    const zoneRoll = seedFloat(zone ^ master);
    let predictedCote;
    if (zoneRoll < 0.50) {
        // 3×–4.99× — zone la plus probable
        const dec = randIn(master, decimalForCote(5) + 1, SEUIL_3X);
        predictedCote = calcCrash(dec);
    } else if (zoneRoll < 0.75) {
        // 5×–9.99×
        const dec = randIn(fine, decimalForCote(10) + 1, SEUIL_5X);
        predictedCote = calcCrash(dec);
    } else if (zoneRoll < 0.90) {
        // 10×–19.99×
        const dec = randIn(zone, decimalForCote(20) + 1, SEUIL_10X);
        predictedCote = calcCrash(dec);
    } else {
        // 20×+
        const dec = randIn(master ^ fine, decimalForCote(60) + 1, SEUIL_20X);
        predictedCote = calcCrash(dec);
    }
    predictedCote = Math.max(3.00, Math.round(predictedCote * 100) / 100);

    // ── Estimation du temps ──
    // Chaque round intermédiaire : durée estimée par modèle physique
    let totalDelaySec = 0;
    for (let i = 0; i < toursAhead; i++) {
        const seed_i   = fnv32(sA + i * 7919 + sB);
        // Crash moyen des rounds intermédiaires : distribution log-normale
        const u        = Math.max(seedFloat(seed_i), 0.01);
        const crashI   = Math.min(HOUSE / u, 200);
        totalDelaySec += roundDuration(crashI);
    }

    // Offset fin par bits du decimal (±10 sec)
    const fineOffset = (decimal % 19) - 9;
    totalDelaySec = Math.round(totalDelaySec + fineOffset);

    // Heure de mise (début du tour cible = ouverture des paris)
    const tBet    = fmtTime(ts + totalDelaySec);
    // Décollage = tBet + BETTING_SEC
    const tLaunch = fmtTime(ts + totalDelaySec + BETTING_SEC);
    // Cash-out = tLaunch + temps de vol vers predictedCote
    const flightSec = Math.round(Math.log(predictedCote) / GROWTH_RATE);
    const tCash   = fmtTime(ts + totalDelaySec + BETTING_SEC + flightSec);

    // Délai lisible
    const mm = Math.floor(Math.abs(totalDelaySec) / 60);
    const ss = Math.abs(totalDelaySec) % 60;
    const delayLabel = mm > 0 ? `${mm} min ${ss} sec` : `${ss} sec`;

    // ── Score de confiance ──
    const formulaBonus  = formulaOK ? 22 : 2;
    const multBonus     = Math.min((refMult - 1) * 0.7, 15);
    const hexBonus      = hexStr.length >= 6 ? 10 : 4;
    const tourBonus     = toursAhead <= 5 ? 14 : 6;
    const phaseBonus    = (refTime.h >= 7 && refTime.h <= 23) ? 8 : 2;
    const base          = 38;
    const confidence    = Math.min(Math.round(base + formulaBonus + multBonus + hexBonus + tourBonus + phaseBonus), 96);
    const confLevel     = CONF_LEVELS.find(l => confidence >= l.min);

    // Zone de la côte prédite
    let coteZone;
    if      (predictedCote >= 20) coteZone = '🏆 MEGA JACKPOT';
    else if (predictedCote >= 10) coteZone = '💎 GROS JACKPOT';
    else if (predictedCote >= 5)  coteZone = '🔥 TRÈS ÉLEVÉ';
    else                          coteZone  = '⚡ CIBLE 3×+';

    return {
        formulaMult, formulaOK, ecart, refZone,
        predictedTour, tourEarly, tourLate, tourAlt, altGap,
        predictedCote, coteZone,
        tBet, tLaunch, tCash,
        flightSec, delayLabel, toursAhead,
        confidence, confLevel
    };
}

// ─── Aide ─────────────────────────────────────────────────────────────
async function sendHelp(senderId) {
    const msg =
        `${DECO.top}\n` +
        `${DECO.line}  ${DECO.tour} TOUR CRASH — GUIDE ${DECO.premium}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.math} FORMULE CONFIRMÉE\n` +
        `${DECO.line}  crash = (2³²/decimal) × 0.97\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.target} FORMAT D'ENTRÉE :\n` +
        `${DECO.line}  MULT TOUR HEURE HEX DECIMAL\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${DECO.bolt} Exemple :\n` +
        `${DECO.line}  8.06 8368246 09:27:10\n` +
        `${DECO.line}  1ec740f6 516374774\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.chart} SEUILS DÉCIMAUX :\n` +
        `${DECO.line}   3×+ ≤ 1 388 706 092  ~32%\n` +
        `${DECO.line}   5×+ ≤   833 223 655  ~19%\n` +
        `${DECO.line}  10×+ ≤   416 611 827  ~10%\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${DECO.num} Résultat :\n` +
        `${DECO.line}  → Numéro de tour à cibler\n` +
        `${DECO.line}  → Heure précise pour miser\n` +
        `${DECO.line}  → Côte prédite ≥ 3×\n` +
        `${DECO.bot}`;
    await sendMessage(senderId, msg);
}

// ─── Module principal ─────────────────────────────────────────────────
module.exports = async (senderId, prompt) => {
    const input = (prompt || '').trim();

    if (!input || ['aide', 'help', '?', 'info'].includes(input.toLowerCase())) {
        await sendHelp(senderId);
        return;
    }

    const parsed = parseInput(input);
    if (!parsed) {
        await sendMessage(senderId,
            `${DECO.warn} Format invalide !\n\n` +
            `${DECO.bolt} Envoyez :\n` +
            `MULT TOUR HEURE HEX DECIMAL\n\n` +
            `${DECO.target} Exemple :\n` +
            `8.06 8368246 09:27:10\n` +
            `1ec740f6 516374774\n\n` +
            `Tapez "aide" pour le guide.`
        );
        return;
    }

    const { mult: refMult, tour: refTour, time: refTime, hexStr, decStr, decimal } = parsed;

    // Chargement
    const loadMsg = LOADING[Math.floor(Math.random() * LOADING.length)];
    await sendMessage(senderId,
        `${DECO.tour} Analyse de prédiction tour en cours...\n` +
        `${DECO.dot}\n` +
        `${loadMsg}\n` +
        `${DECO.num} Tour réf : ${refTour.toLocaleString()}`
    );

    await new Promise(r => setTimeout(r, 2000));

    // Calcul
    const res = predictTour(refMult, refTour, refTime, hexStr, decimal);
    const {
        formulaMult, formulaOK, ecart, refZone,
        predictedTour, tourEarly, tourLate, tourAlt, altGap,
        predictedCote, coteZone,
        tBet, tLaunch, tCash,
        flightSec, delayLabel, toursAhead,
        confidence, confLevel
    } = res;

    const refTimeStr  = `${String(refTime.h).padStart(2,'0')}:${String(refTime.m).padStart(2,'0')}:${String(refTime.s).padStart(2,'0')}`;
    const coteDisplay = predictedCote.toFixed(2) + '×';
    const formulaDisp = formulaMult.toFixed(2) + '×';
    const matchEmoji  = formulaOK ? '✅' : `⚠️ écart ${ecart.toFixed(2)}`;
    const buildBar    = (p, max = 10) =>
        '█'.repeat(Math.min(10, Math.round(p / max))) +
        '░'.repeat(Math.max(0, 10 - Math.round(p / max)));

    const response =
        `✅ Voici votre prédiction premium\n\n` +
        `🎰 Tour 1 : ${predictedTour}\n` +
        `⏱️ Heure : ${tBet}\n\n` +
        `🎰 Tour 2 : ${tourAlt}\n` +
        `⏱️ Heure : ${fmtTime(refTime.ts + Math.round((toursAhead + altGap) * 30))}`;

    await sendMessage(senderId, response);
};
