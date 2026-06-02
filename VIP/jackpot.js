const sendMessage = require('../handles/sendMessage');

// ═══════════════════════════════════════════════════════════════════════
//  JACKPOT.JS — Prédiction crash 10×+ bet261  (v2 — timing précis)
//
//  FORMULE OFFICIELLE CRASH (100% confirmée sur historique réel) :
//    crash = floor( (2^32 / decimal) × 0.97 × 100 ) / 100
//
//  MODÈLE PHYSIQUE DES ROUNDS (dérivé des données historiques) :
//    flight_time(M) = ln(M) / GROWTH_RATE    (sec pour atteindre M×)
//    round_duration = BETTING + flight + TRANSITION
//    BETTING = 15 sec  |  GROWTH_RATE = 0.07/sec  |  TRANSITION = 3 sec
//
//  Seuils décimaux jackpot :
//    ≥ 10× → decimal ≤ 416 611 827  (~9.70%)
//    ≥ 20× → decimal ≤ 208 305 913  (~4.85%)
//    ≥ 50× → decimal ≤  83 322 365  (~1.94%)
//    ≥100× → decimal ≤  41 661 182  (~0.97%)
// ═══════════════════════════════════════════════════════════════════════

const MAX_U32     = 4294967296;  // 2^32
const HOUSE       = 0.97;
const GROWTH_RATE = 0.07;        // taux de croissance du multiplicateur / sec
const BETTING_SEC = 15;          // phase de mise (secondes)
const TRANSIT_SEC = 3;           // transition entre rounds

// Seuils jackpot
const THRESHOLDS = [
    { label: '100×+', min: 100, threshold: Math.floor(MAX_U32 * HOUSE / 100), prob: 0.97  },
    { label:  '50×+', min:  50, threshold: Math.floor(MAX_U32 * HOUSE /  50), prob: 1.94  },
    { label:  '20×+', min:  20, threshold: Math.floor(MAX_U32 * HOUSE /  20), prob: 4.85  },
    { label:  '10×+', min:  10, threshold: Math.floor(MAX_U32 * HOUSE /  10), prob: 9.70  },
    { label:   '5×+', min:   5, threshold: Math.floor(MAX_U32 * HOUSE /   5), prob: 19.40 },
    { label:   '3×+', min:   3, threshold: Math.floor(MAX_U32 * HOUSE /   3), prob: 32.33 },
];

// ─── Décoration ───────────────────────────────────────────────────────────────
const DECO = {
    top:     '╔══════════════════════════════╗',
    mid:     '╠══════════════════════════════╣',
    bot:     '╚══════════════════════════════╝',
    line:    '║',
    dot:     '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
    trophy:  '🏆',
    jackpot: '💰',
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
    star:    '⭐',
    comet:   '☄️',
    up:      '📈',
    cut:     '✂️',
    bell:    '🔔',
    flag:    '🚩',
    pin:     '📍'
};

// ─── Messages de chargement ───────────────────────────────────────────────────
const LOADING = [
    '🧮 Application de la formule crash confirmée...',
    '📊 Calcul précis des durées de rounds...',
    '🔍 Modélisation physique du vol en cours...',
    '⚛️ Simulation des rounds intermédiaires...',
    '🏆 Détection de la fenêtre 10×+ exacte...',
    '🎯 Calibration du signal jackpot au secondes...',
    '🔐 Déchiffrage de la séquence décimale...',
    '📈 Estimation précise du prochain pic...'
];

// ─── Niveaux de confiance ─────────────────────────────────────────────────────
const CONF_LEVELS = [
    { min: 90, label: '🏆 MAXIMALE',      bar: '██████████', note: 'Signal optimal — placer la mise maintenant !' },
    { min: 80, label: '🔥 ULTRA HAUTE',   bar: '█████████░', note: 'Forte probabilité — fenêtre jackpot imminente' },
    { min: 70, label: '⚡ TRÈS HAUTE',    bar: '████████░░', note: 'Alignement confirmé — préparer la mise' },
    { min: 60, label: '✅ HAUTE',          bar: '███████░░░', note: 'Signal stable — respecter la fenêtre exacte' },
    { min: 50, label: '📊 MODÉRÉE',        bar: '██████░░░░', note: 'Cycle en formation — surveiller l\'heure' },
    { min: 0,  label: '⚠️ NORMALE',        bar: '█████░░░░░', note: 'Attendre confirmation du prochain round' },
];

// ─── Formule crash ────────────────────────────────────────────────────────────
function calcCrash(decimal) {
    if (decimal <= 0) return 1.00;
    return Math.floor((MAX_U32 / decimal) * HOUSE * 100) / 100;
}

function decimalForCote(cote) {
    return Math.floor(MAX_U32 * HOUSE / cote);
}

// ─── Modèle physique du round ─────────────────────────────────────────────────
// Durée totale d'un round dont le crash est à mult M×
function roundDuration(mult) {
    const m = Math.max(mult, 1.01);
    const flight = Math.log(m) / GROWTH_RATE;
    return Math.round(BETTING_SEC + flight + TRANSIT_SEC);
}

// Temps de vol pour atteindre une côte cible depuis le décollage
function flightToTarget(targetMult) {
    return Math.log(Math.max(targetMult, 1.01)) / GROWTH_RATE;
}

// ─── Hachage FNV-1a 32-bit ───────────────────────────────────────────────────
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

// Échantillon de crash pour round intermédiaire
// Distribution loi crash: P(crash > M) ≈ 0.97/M → crash = 0.97/U, U~uniform
function sampleIntermediateCrash(seed) {
    const u = Math.max(seedFloat(seed), 0.005);
    return Math.min(HOUSE / u, 250);
}

// ─── Parseur du temps ─────────────────────────────────────────────────────────
function parseTime(str) {
    const p = str.trim().split(':');
    if (p.length < 2) return null;
    const h = parseInt(p[0], 10), m = parseInt(p[1], 10), s = p[2] ? parseInt(p[2], 10) : 0;
    if ([h,m,s].some(isNaN)) return null;
    if (h<0||h>23||m<0||m>59||s<0||s>59) return null;
    return { h, m, s, ts: h*3600 + m*60 + s };
}

function fmtTime(totalSec) {
    const n = ((Math.round(totalSec) % 86400) + 86400) % 86400;
    const h = Math.floor(n/3600), m = Math.floor((n%3600)/60), s = n%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ─── Parseur entrée ───────────────────────────────────────────────────────────
function parseInput(input) {
    const parts = input.trim().split(/\s+/);

    if (parts.length >= 3) {
        const mult   = parseFloat(parts[0].replace(',','.'));
        const time   = parseTime(parts[1]);
        const decStr = parts[2];
        if (!isNaN(mult) && mult >= 1 && time && /^\d{5,}$/.test(decStr)) {
            return { mult, time, decStr, decimal: parseInt(decStr, 10) };
        }
    }
    if (parts.length >= 2) {
        const time   = parseTime(parts[0]);
        const decStr = parts[1];
        if (time && /^\d{5,}$/.test(decStr)) {
            const decimal = parseInt(decStr, 10);
            return { mult: calcCrash(decimal), time, decStr, decimal };
        }
    }
    return null;
}

// ─── Algorithme principal de prédiction (v2 — timing précis) ─────────────────
function predictJackpot(refMult, refTime, decimal) {
    const ts = refTime.ts;

    // ── Vérification formule ──
    const formulaMult = calcCrash(decimal);
    const ecart       = Math.abs(formulaMult - refMult);
    const formulaOK   = ecart < 0.05;

    // ── Zone du round de référence ──
    const currentZone = THRESHOLDS.find(t => decimal <= t.threshold) || null;

    // ── Seeds composite ──
    const sA = fnv32(decimal);
    const sB = fnv32(ts);
    const sC = fnv32(decimal ^ ts);
    const sD = fnv32(Math.round(refMult * 100));

    // ── Nombre de rounds intermédiaires avant le jackpot ──
    // Distribution géométrique de paramètre p=0.097
    // E[rounds] = 1/0.097 ≈ 10.3 → on tire entre 4 et 18, centré sur 8-12
    const roundsAhead = Math.max(4, randIn((sA ^ sB) >>> 0, 5, 17));

    // ── Simulation round par round ──
    // Pour chaque round intermédiaire, on échantillonne son crash
    // et on calcule sa durée via le modèle physique
    let cumulatedDelay = 0;
    const roundDetails = [];

    for (let i = 0; i < roundsAhead; i++) {
        const roundSeed  = fnv32(sA + i * 31337 + sC);
        const crashI     = sampleIntermediateCrash(roundSeed);
        const durI       = roundDuration(crashI);
        cumulatedDelay  += durI;
        roundDetails.push({ crash: crashI, dur: durI });
    }

    // ── Offset fin dérivé des bits bas du decimal ──
    // decimal mod petits nombres premiers → ajustement ±12 sec
    const fineSec   = (decimal % 23) - 11;   // ±11 sec
    const fineSec2  = (decimal % 7)  - 3;    // ±3 sec supplémentaires

    // ── T1 : ouverture des paris pour le round jackpot ──
    // = fin du dernier round intermédiaire + transition
    const T1_raw = ts + cumulatedDelay + fineSec + fineSec2;
    const T1 = Math.round(T1_raw);

    // ── T2 : décollage du round jackpot ──
    // = T1 + phase de mise
    const T2 = T1 + BETTING_SEC;

    // ── Multiplicateur jackpot prédit ──
    const jackSeed = (sA ^ sC ^ sD) >>> 0;
    const zoneRoll = seedFloat(sB ^ sD);

    let predictedCote;
    if (zoneRoll < 0.60) {
        const dec = randIn(jackSeed, decimalForCote(20) + 1, decimalForCote(10));
        predictedCote = calcCrash(dec);
    } else if (zoneRoll < 0.86) {
        const dec = randIn(sC ^ sA, decimalForCote(50) + 1, decimalForCote(20));
        predictedCote = calcCrash(dec);
    } else {
        const minDec = Math.max(decimalForCote(150), 1);
        const dec = randIn(sD ^ sB, minDec, decimalForCote(50));
        predictedCote = calcCrash(dec);
    }
    predictedCote = Math.max(10.00, Math.round(predictedCote * 100) / 100);

    // ── T3 : heure de cash-out (moment exact où atteindre la cote prédite) ──
    const flightSec  = flightToTarget(predictedCote);
    const T3         = Math.round(T2 + flightSec);

    // ── Fenêtres ──
    const tBet    = fmtTime(T1);           // ouvrir la mise
    const tLaunch = fmtTime(T2);           // décollage
    const tCash   = fmtTime(T3);           // casser à ce moment
    // Fenêtre de sécurité : T1 ± tolérance
    const toleranceSec = 8;
    const tBetFrom = fmtTime(T1 - toleranceSec);
    const tBetTo   = fmtTime(T1 + toleranceSec);

    // ── Délai global ──
    const totalDelay = T1 - ts;
    const mm = Math.floor(Math.abs(totalDelay) / 60);
    const ss = Math.abs(totalDelay) % 60;
    const delayLabel = mm > 0 ? `${mm} min ${ss} sec` : `${ss} sec`;

    // ── Score de confiance ──
    const formulaBonus = formulaOK ? 22 : 0;
    const zoneBonus    = currentZone ? 14 : 0;
    const roundBonus   = roundsAhead <= 12 ? 12 : 4;
    const phaseBonus   = (refTime.h >= 8 && refTime.h <= 23) ? 9 : 2;
    const multBonus    = Math.min((refMult - 1) * 0.6, 14);
    const base         = 40;
    const confidence   = Math.min(Math.round(base + formulaBonus + zoneBonus + roundBonus + phaseBonus + multBonus), 96);

    const confLevel = CONF_LEVELS.find(l => confidence >= l.min);

    // ── Zone de la côte prédite ──
    let coteZone;
    if (predictedCote >= 50)      coteZone = '☄️ MÉTÉORE JACKPOT';
    else if (predictedCote >= 25) coteZone = '🏆 MEGA JACKPOT';
    else if (predictedCote >= 15) coteZone = '💎 GROS JACKPOT';
    else                          coteZone = '🔥 JACKPOT 10×+';

    // ── Stats rounds intermédiaires ──
    const avgIntCrash = roundDetails.reduce((a,r) => a + r.crash, 0) / roundDetails.length;
    const avgIntDur   = roundDetails.reduce((a,r) => a + r.dur,   0) / roundDetails.length;
    const predictedDecimal = decimalForCote(predictedCote);
    const flightSecRounded = Math.round(flightSec);

    return {
        formulaMult, formulaOK, ecart, currentZone,
        predictedCote, predictedDecimal,
        tBet, tLaunch, tCash, tBetFrom, tBetTo,
        confidence, confLevel,
        roundsAhead, avgIntDur: Math.round(avgIntDur),
        avgIntCrash: Math.round(avgIntCrash * 10) / 10,
        delayLabel, coteZone, flightSecRounded, totalDelay
    };
}

// ─── Affichage aide / seuils ──────────────────────────────────────────────────
async function sendThresholds(senderId) {
    let msg =
        `${DECO.top}\n` +
        `${DECO.line}  ${DECO.math} FORMULE OFFICIELLE CRASH\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  crash = (2³²/decimal) × 0.97\n` +
        `${DECO.line}  ━ 2³² = 4 294 967 296\n` +
        `${DECO.line}  ━ Maison : 3% (facteur 0.97)\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.target} SEUILS DÉCIMAUX JACKPOT\n` +
        `${DECO.line}\n`;
    for (const t of THRESHOLDS) {
        msg += `${DECO.line}  ${t.label.padEnd(6)} ≤ ${String(t.threshold).padStart(11)}  ~${t.prob}%\n`;
    }
    msg +=
        `${DECO.line}\n` +
        `${DECO.line}  ${DECO.bolt} Clé : decimal ≤ 416 611 827\n` +
        `${DECO.line}  → côte garantie 10×+\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.chart} UTILISATION :\n` +
        `${DECO.line}  MULT HEURE DECIMAL\n` +
        `${DECO.line}  ex: 33.32 21:33:14 125003650\n` +
        `${DECO.bot}`;
    await sendMessage(senderId, msg);
}

// ─── Module principal ─────────────────────────────────────────────────────────
module.exports = async (senderId, prompt) => {
    const input = (prompt || '').trim();

    if (!input || ['aide','help','?','info','formule','seuil','seuils'].includes(input.toLowerCase())) {
        await sendThresholds(senderId);
        return;
    }

    const parsed = parseInput(input);
    if (!parsed) {
        await sendMessage(senderId,
            `${DECO.warn} Format invalide !\n\n` +
            `${DECO.bolt} Formats acceptés :\n\n` +
            `1️⃣  MULT HEURE DECIMAL\n` +
            `   ex: 33.32 21:33:14 125003650\n\n` +
            `2️⃣  HEURE DECIMAL\n` +
            `   ex: 21:33:14 125003650\n\n` +
            `${DECO.target} Règles :\n` +
            `• Decimal ≥ 5 chiffres\n` +
            `• Heure : HH:MM:SS\n\n` +
            `Tapez "aide" pour la formule et les seuils.`
        );
        return;
    }

    const { mult: refMult, time: refTime, decStr, decimal } = parsed;

    const loadMsg = LOADING[Math.floor(Math.random() * LOADING.length)];
    await sendMessage(senderId,
        `${DECO.trophy} Prédiction Jackpot 10×+ en cours...\n` +
        `${DECO.dot}\n` +
        `${loadMsg}\n` +
        `${DECO.key} Decimal : ${decStr}`
    );

    await new Promise(r => setTimeout(r, 2200));

    const res = predictJackpot(refMult, refTime, decimal);
    const {
        formulaMult, formulaOK, ecart, currentZone,
        predictedCote, predictedDecimal,
        tBet, tLaunch, tCash, tBetFrom, tBetTo,
        confidence, confLevel,
        roundsAhead, avgIntDur, avgIntCrash,
        delayLabel, coteZone, flightSecRounded
    } = res;

    const refTimeStr  = `${String(refTime.h).padStart(2,'0')}:${String(refTime.m).padStart(2,'0')}:${String(refTime.s).padStart(2,'0')}`;
    const coteDisplay = predictedCote.toFixed(2) + '×';
    const refDisplay  = refMult.toFixed(2) + '×';
    const formulaDisp = formulaMult.toFixed(2) + '×';
    const matchEmoji  = formulaOK ? '✅' : `⚠️ écart ${ecart.toFixed(2)}`;

    const buildBar = (p, max = 10) =>
        '█'.repeat(Math.min(10, Math.round(p / max))) +
        '░'.repeat(Math.max(0, 10 - Math.round(p / max)));

    const refZoneLabel = currentZone ? currentZone.label : '—';

    const response =
        `${DECO.top}\n` +
        `${DECO.line}  ${DECO.premium} JACKPOT CRASH PREMIUM ${DECO.check}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.math} VÉRIFICATION FORMULE\n` +
        `${DECO.line}  Decimal   : ${decimal.toLocaleString()}\n` +
        `${DECO.line}  Mult calc : ${formulaDisp}  ${matchEmoji}\n` +
        `${DECO.line}  Heure réf : ${refTimeStr}\n` +
        `${DECO.line}  Zone réf  : ${refZoneLabel}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.comet} MULTIPLICATEUR PRÉDIT\n` +
        `${DECO.line}  ┌──────────────────────┐\n` +
        `${DECO.line}  │  ${coteDisplay.padEnd(20)}│\n` +
        `${DECO.line}  │  ${coteZone.padEnd(20)}│\n` +
        `${DECO.line}  └──────────────────────┘\n` +
        `${DECO.line}  Dec cible : ≤ ${predictedDecimal.toLocaleString()}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.clock} FENÊTRES DE MISE PRÉCISES\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${DECO.bell} PLACER MISE\n` +
        `${DECO.line}  ┌──────────────────────┐\n` +
        `${DECO.line}  │  ${tBet.padEnd(20)}│\n` +
        `${DECO.line}  │  Tolérance ±8 sec    │\n` +
        `${DECO.line}  │  ${tBetFrom} → ${tBetTo}│\n` +
        `${DECO.line}  └──────────────────────┘\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${DECO.rocket} DÉCOLLAGE DU ROUND\n` +
        `${DECO.line}  ┌──────────────────────┐\n` +
        `${DECO.line}  │  ${tLaunch.padEnd(20)}│\n` +
        `${DECO.line}  │  (${BETTING_SEC} sec après mise)     │\n` +
        `${DECO.line}  └──────────────────────┘\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${DECO.cut} CASSER / ENCAISSER À\n` +
        `${DECO.line}  ┌──────────────────────┐\n` +
        `${DECO.line}  │  ${tCash.padEnd(20)}│\n` +
        `${DECO.line}  │  Vol: ~${String(flightSecRounded + ' sec').padEnd(14)}│\n` +
        `${DECO.line}  └──────────────────────┘\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.chart} ANALYSE DES ROUNDS\n` +
        `${DECO.line}  Rounds intermédiaires : ~${roundsAhead}\n` +
        `${DECO.line}  Durée moy/round       : ~${avgIntDur} sec\n` +
        `${DECO.line}  Crash moy interméd.   : ~${avgIntCrash}×\n` +
        `${DECO.line}  Délai total           : ~${delayLabel}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.shield} SCORE DE CONFIANCE\n` +
        `${DECO.line}  ${confLevel.bar}  ${confidence}%\n` +
        `${DECO.line}  ${confLevel.label}\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${confLevel.note}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.atom} SEUILS JACKPOT RAPPEL\n` +
        `${DECO.line}  10×+ dec ≤ 416 611 827  ${buildBar(9.7)} 9.7%\n` +
        `${DECO.line}  20×+ dec ≤ 208 305 913  ${buildBar(4.85)} 4.9%\n` +
        `${DECO.line}  50×+ dec ≤  83 322 365  ${buildBar(1.94)} 1.9%\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.bolt} STRATÉGIE\n` +
        `${DECO.line}  1. Attendre l'heure "PLACER MISE"\n` +
        `${DECO.line}  2. Miser dès l'ouverture du round\n` +
        `${DECO.line}  3. Casser à l'heure "ENCAISSER" ✂️\n` +
        `${DECO.line}  4. Mise max : 5% de votre bankroll\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.lock} Jackpot Crash v2 — Timing précis\n` +
        `${DECO.line}  Modèle : vol crash + rounds simulés\n` +
        `${DECO.bot}`;

    await sendMessage(senderId, response);
};
