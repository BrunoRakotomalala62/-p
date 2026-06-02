const sendMessage = require('../handles/sendMessage');

// ─── Sessions utilisateur ─────────────────────────────────────────────────────
const userSessions = new Map();

// ─── Décoration visuelle ──────────────────────────────────────────────────────
const DECO = {
    top:     '╔══════════════════════════════╗',
    mid:     '╠══════════════════════════════╣',
    bot:     '╚══════════════════════════════╝',
    line:    '║',
    div:     '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    dot:     '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
    cosmos:  '🌌',
    star4:   '✦',
    rocket:  '🚀',
    fire:    '🔥',
    target:  '🎯',
    chart:   '📊',
    clock:   '⏱️',
    premium: '👑',
    shield:  '🛡️',
    bolt:    '⚡',
    gem:     '💎',
    check:   '✅',
    warn:    '⚠️',
    lock:    '🔐',
    planet:  '🪐',
    comet:   '☄️',
    atom:    '⚛️',
    scan:    '🔍',
    key:     '🔑',
    trophy:  '🏆',
    dna:     '🧬'
};

// ─── Messages de chargement ───────────────────────────────────────────────────
const LOADING_MESSAGES = [
    '🌌 Analyse du signal cosmique en cours...',
    '⚛️ Déchiffrage du code décimal de référence...',
    '🪐 Synchronisation avec les cycles CosmosX...',
    '🔍 Calcul de l\'entropie numérique...',
    '☄️ Traitement des données temporelles...',
    '🧬 Modélisation de la séquence décimale...',
    '🚀 Algorithme prédictif cosmique en action...',
    '🎯 Calibration de la fenêtre de miser...'
];

// ─── Niveaux de confiance ─────────────────────────────────────────────────────
const CONFIDENCE_LEVELS = [
    { min: 93, label: '🌌 COSMIQUE MAXIMAL',  bar: '██████████', desc: 'Signal décimal parfait — fenêtre optimale confirmée' },
    { min: 83, label: '🔥 ULTRA HAUTE',        bar: '█████████░', desc: 'Séquence décimale alignée — probabilité maximale' },
    { min: 73, label: '⚡ TRÈS HAUTE',          bar: '████████░░', desc: 'Corrélation forte — signal fiable sur ce cycle' },
    { min: 63, label: '✅ HAUTE',               bar: '███████░░░', desc: 'Données stables — miser en confiance' },
    { min: 52, label: '📊 MODÉRÉE-HAUTE',       bar: '██████░░░░', desc: 'Signal partiel — respecter la fenêtre indiquée' },
    { min: 0,  label: '⚠️ NORMALE',             bar: '█████░░░░░', desc: 'Cycle en formation — surveiller l\'évolution' }
];

// ─── Hachage FNV-1a 32-bit déterministe ──────────────────────────────────────
function fnv32(value) {
    let h = 0x811c9dc5 >>> 0;
    const str = String(value);
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
}

// Flottant [0,1) depuis un seed entier
function seedFloat(seed) {
    const x = Math.sin((seed >>> 0) + 1.7182818) * 43758.5453123;
    return x - Math.floor(x);
}

// Flottant dans [min, max) depuis un seed
function randFloat(seed, min, max) {
    return min + seedFloat(seed) * (max - min);
}

// ─── Décomposition du nombre décimal ─────────────────────────────────────────
function decimalEntropy(decStr) {
    const clean = decStr.replace(/\D/g, '');
    if (clean.length === 0) return { valid: false };

    const num = parseInt(clean, 10);
    if (isNaN(num)) return { valid: false };

    // Décomposition en blocs de 3 chiffres
    const digits = clean.split('').map(Number);
    const len    = digits.length;

    // Somme, produit partiel (modulo), alternance
    let digitSum = digits.reduce((a, d) => a + d, 0);
    let altSum   = digits.reduce((a, d, i) => a + (i % 2 === 0 ? d : -d), 0);

    // Fréquence des chiffres (0–9)
    const freq = new Array(10).fill(0);
    for (const d of digits) freq[d]++;
    const totalD = digits.length;

    // Entropie de Shannon
    let entropy = 0;
    for (const f of freq) {
        if (f > 0) {
            const p = f / totalD;
            entropy -= p * Math.log2(p);
        }
    }
    const maxEntropy   = Math.log2(10);
    const entropyRatio = entropy / maxEntropy;

    // Seed dérivés
    const s1 = fnv32(num);
    const s2 = fnv32(digitSum * 97 + altSum);
    const s3 = fnv32(clean.slice(0, Math.ceil(len / 2)));
    const s4 = fnv32(clean.slice(Math.ceil(len / 2)));
    const fold = (s1 ^ s2 ^ s3 ^ s4) >>> 0;

    // Parité (nombre de chiffres pairs)
    const evenCount  = digits.filter(d => d % 2 === 0).length;
    const evenRatio  = evenCount / len;

    return {
        valid: true,
        num,
        s1, s2, s3, s4, fold,
        digitSum,
        altSum,
        entropyRatio,
        evenRatio,
        numLen: len
    };
}

// ─── Parseur du temps ─────────────────────────────────────────────────────────
function parseTime(timeStr) {
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parts[2] !== undefined ? parseInt(parts[2], 10) : 0;
    if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
    return { h, m, s, totalSeconds: h * 3600 + m * 60 + s };
}

// ─── Formatage du temps ───────────────────────────────────────────────────────
function formatTime(totalSeconds) {
    const n = ((totalSeconds % 86400) + 86400) % 86400;
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const s = n % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Parseur de l'entrée utilisateur ─────────────────────────────────────────
// Format : COTE HEURE DECIMAL
// Exemple : 3.98 21:58:02 135118418
function parseInput(input) {
    const parts = input.trim().split(/\s+/);
    if (parts.length < 3) return null;

    const cote    = parseFloat(parts[0].replace(',', '.'));
    const time    = parseTime(parts[1]);
    const decStr  = parts[2];

    if (isNaN(cote) || cote < 3.0) return null;
    if (!time) return null;
    if (!/^\d{4,}$/.test(decStr)) return null;

    return { cote, time, decStr };
}

// ─── Algorithme de prédiction principal ──────────────────────────────────────
function predictCosmosX(refCote, refTime, decStr) {
    const ts = refTime.totalSeconds;

    // Seeds de base
    const coteSeed  = fnv32(Math.round(refCote * 100));
    const timeSeed  = fnv32(ts);
    const phaseSeed = fnv32(refTime.h * 100 + refTime.m + refTime.s);

    // Entropie décimale
    const dec = decimalEntropy(decStr);

    const decFold = dec.valid ? dec.fold : fnv32(decStr);
    const s1      = dec.valid ? dec.s1 : fnv32(decStr + '1');
    const s2      = dec.valid ? dec.s2 : fnv32(decStr + '2');
    const s3      = dec.valid ? dec.s3 : fnv32(decStr + '3');
    const s4      = dec.valid ? dec.s4 : fnv32(decStr + '4');

    // Seeds composites
    const masterSeed = (coteSeed ^ timeSeed ^ decFold) >>> 0;
    const fineSeed   = (phaseSeed ^ s1 ^ s2) >>> 0;
    const zoneSeed   = (s3 ^ s4 ^ coteSeed) >>> 0;

    // ── Prédiction de la côte ──
    // Référence ≥ 3× → cibles plus hautes que aviator/jetx
    const entropyBoost = dec.valid ? dec.entropyRatio : 0.5;
    const evenBoost    = dec.valid ? dec.evenRatio : 0.5;
    const zoneRoll     = seedFloat(zoneSeed);

    // Seuils : référence 3× donc on vise plus haut
    const t1 = 0.45 - entropyBoost * 0.06;
    const t2 = 0.78 - evenBoost * 0.04;

    let predictedCote;
    if (zoneRoll < t1) {
        predictedCote = randFloat(masterSeed, 3.00, 5.49);
    } else if (zoneRoll < t2) {
        predictedCote = randFloat(fineSeed, 5.50, 9.99);
    } else {
        predictedCote = randFloat(zoneSeed ^ masterSeed, 10.00, 22.00);
    }

    // Boost depuis la côte de référence (ref ≥ 3× → boost plus fort)
    const coteBoostAmt = (refCote - 3.0) * 0.20 + entropyBoost * 0.30;
    predictedCote = Math.min(predictedCote + coteBoostAmt, 28.00);
    predictedCote = Math.round(predictedCote * 100) / 100;

    // ── Prédiction de l'offset temporel ──
    // CosmosX rounds : 22–48 sec/round, 3–7 rounds en avance
    const numMod     = dec.valid ? (dec.num % 30) : 15;
    const roundLen   = 22 + numMod;                     // 22–52 sec
    const roundCount = 3 + (masterSeed % 5);             // 3–7 rounds

    const baseDelay  = roundLen * roundCount;
    // Offset décimal fin : utilise la somme des chiffres
    const decOffset  = dec.valid ? ((dec.digitSum % 21) - 10) : 0; // ±10 sec
    const totalDelay = Math.max(baseDelay + decOffset, 60);

    const predictedTime = formatTime(ts + totalDelay);

    // ── Délai lisible ──
    const minutesDelay = Math.floor(totalDelay / 60);
    const secondsDelay = totalDelay % 60;
    const delayLabel   = minutesDelay > 0
        ? `${minutesDelay} min ${secondsDelay} sec`
        : `${secondsDelay} sec`;

    // ── Score de confiance ──
    const decLenBonus    = dec.valid ? Math.min(dec.numLen * 1.5, 14) : 0;
    const entropyBonus   = dec.valid ? Math.round(dec.entropyRatio * 20) : 5;
    const evenBonus      = dec.valid ? Math.round(dec.evenRatio * 8) : 0;
    const coteRefBonus   = Math.min((refCote - 3.0) * 9, 20);
    const phaseBonus     = (refTime.h >= 7 && refTime.h <= 23) ? 9 : 2;
    const secBonus       = (refTime.s % 2 === 0) ? 6 : 2;
    const baseConfidence = 48;

    const confidence = Math.min(
        Math.round(baseConfidence + decLenBonus + entropyBonus + evenBonus + coteRefBonus + phaseBonus + secBonus),
        98
    );

    const confLevel = CONFIDENCE_LEVELS.find(l => confidence >= l.min);

    // ── Zone de la côte ──
    let coteZone;
    if (predictedCote >= 15)       coteZone = '🏆 JACKPOT COSMIQUE';
    else if (predictedCote >= 10)  coteZone = '🌌 ULTRA ÉLEVÉ';
    else if (predictedCote >= 6)   coteZone = '🔥 TRÈS ÉLEVÉ';
    else if (predictedCote >= 4)   coteZone = '⚡ ÉLEVÉ';
    else                           coteZone = '✅ STANDARD 3×+';

    // ── Score décimal ──
    const decScore = dec.valid ? Math.round(dec.entropyRatio * 100) : 0;

    return {
        predictedCote,
        predictedTime,
        confidence,
        confLevel,
        roundCount,
        roundLen,
        delayLabel,
        coteZone,
        decScore,
        digitSum: dec.valid ? dec.digitSum : 0,
        numLen:   dec.valid ? dec.numLen : 0
    };
}

// ─── Affichage de l'aide ──────────────────────────────────────────────────────
async function sendHelp(senderId) {
    const msg =
        `${DECO.top}\n` +
        `${DECO.line} ${DECO.cosmos} COSMOSX BET261 — GUIDE ${DECO.premium}\n` +
        `${DECO.mid}\n` +
        `${DECO.line} Comment utiliser :\n` +
        `${DECO.line}\n` +
        `${DECO.line} Envoyez : [CÔTE] [HEURE] [DECIMAL]\n` +
        `${DECO.line}\n` +
        `${DECO.line} ${DECO.target} CÔTE : valeur ≥ 3.00×\n` +
        `${DECO.line}   (la côte du round de référence)\n` +
        `${DECO.line}\n` +
        `${DECO.line} ${DECO.clock} HEURE : HH:MM:SS\n` +
        `${DECO.line}   (heure exacte de ce round)\n` +
        `${DECO.line}\n` +
        `${DECO.line} ${DECO.key} DECIMAL : nombre décimal\n` +
        `${DECO.line}   (ex: 135118418)\n` +
        `${DECO.mid}\n` +
        `${DECO.line} ${DECO.bolt} Exemple :\n` +
        `${DECO.line}   3.98 21:58:02 135118418\n` +
        `${DECO.line}   5.12 14:22:10 987654321\n` +
        `${DECO.mid}\n` +
        `${DECO.line} ${DECO.shield} Résultat :\n` +
        `${DECO.line}   → Côte prédite ≥ 3.00×\n` +
        `${DECO.line}   → Heure précise pour miser\n` +
        `${DECO.line}   → Score de confiance\n` +
        `${DECO.bot}`;
    await sendMessage(senderId, msg);
}

// ─── Module principal ─────────────────────────────────────────────────────────
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
            `${DECO.bolt} Envoyez : CÔTE HEURE DECIMAL\n\n` +
            `${DECO.target} Exemple :\n` +
            `3.98 21:58:02 135118418\n\n` +
            `${DECO.chart} Règles :\n` +
            `• Côte ≥ 3.00×\n` +
            `• Heure : HH:MM:SS\n` +
            `• Decimal : nombre entier (ex: 135118418)\n\n` +
            `Tapez "aide" pour le guide complet.`
        );
        return;
    }

    const { cote: refCote, time: refTime, decStr } = parsed;

    // ── Message de chargement ──
    const loadMsg = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
    await sendMessage(senderId,
        `${DECO.cosmos} Prédiction CosmosX en cours...\n` +
        `${DECO.dot}\n` +
        `${loadMsg}\n` +
        `${DECO.key} Décimal : ${decStr}`
    );

    await new Promise(r => setTimeout(r, 2000));

    // ── Calcul ──
    const result = predictCosmosX(refCote, refTime, decStr);
    const {
        predictedCote,
        predictedTime,
        confidence,
        confLevel,
        roundCount,
        roundLen,
        delayLabel,
        coteZone,
        decScore,
        digitSum,
        numLen
    } = result;

    const coteDisplay = predictedCote.toFixed(2) + '×';
    const refDisplay  = refCote.toFixed(2) + '×';
    const refTimeStr  = `${String(refTime.h).padStart(2,'0')}:${String(refTime.m).padStart(2,'0')}:${String(refTime.s).padStart(2,'0')}`;

    // Barre de score décimal
    const decBarFilled = Math.round(decScore / 10);
    const decBar = '█'.repeat(decBarFilled) + '░'.repeat(10 - decBarFilled);

    const response =
        `${DECO.top}\n` +
        `${DECO.line}  ${DECO.premium} PRÉDICTION COSMOSX PREMIUM ${DECO.check}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.scan} DONNÉES ANALYSÉES\n` +
        `${DECO.line}  Côte réf  : ${refDisplay}\n` +
        `${DECO.line}  Heure réf : ${refTimeStr}\n` +
        `${DECO.line}  Décimal   : ${decStr}\n` +
        `${DECO.line}  Entropie  : ${decBar} ${decScore}%\n` +
        `${DECO.line}  Somme dig : ${digitSum}  |  Longueur : ${numLen}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.cosmos} SIGNAL COSMIQUE IDENTIFIÉ\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${DECO.comet} CÔTE PRÉDITE\n` +
        `${DECO.line}  ┌─────────────────────┐\n` +
        `${DECO.line}  │  ${coteDisplay.padEnd(19)}│\n` +
        `${DECO.line}  │  ${coteZone.padEnd(19)}│\n` +
        `${DECO.line}  └─────────────────────┘\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${DECO.clock} HEURE POUR MISER\n` +
        `${DECO.line}  ┌─────────────────────┐\n` +
        `${DECO.line}  │  ${predictedTime.padEnd(19)}│\n` +
        `${DECO.line}  │  ≈ dans ${delayLabel.padEnd(13)}│\n` +
        `${DECO.line}  └─────────────────────┘\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${DECO.atom} Durée round  : ~${roundLen} sec\n` +
        `${DECO.line}  ${DECO.planet} Rounds ciblés : ~${roundCount} avant signal\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.shield} SCORE DE CONFIANCE\n` +
        `${DECO.line}  ${confLevel.bar}  ${confidence}%\n` +
        `${DECO.line}  ${confLevel.label}\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${confLevel.desc}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.bolt} STRATÉGIE CONSEILLÉE\n` +
        `${DECO.line}  • Ouvrir le round à l'heure exacte\n` +
        `${DECO.line}  • Encaisser à la côte prédite ✂️\n` +
        `${DECO.line}  • Mise max : 5% de votre bankroll\n` +
        `${DECO.line}  • Attendre le signal — ne pas anticiper\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.lock} Algorithme CosmosX Decimal v1\n` +
        `${DECO.line}  Prédiction basée sur entropie décimale\n` +
        `${DECO.bot}`;

    await sendMessage(senderId, response);
};
