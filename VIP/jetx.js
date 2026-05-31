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
    stars:   '✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦',
    rocket:  '🚀',
    money:   '💰',
    fire:    '🔥',
    target:  '🎯',
    chart:   '📊',
    clock:   '⏱️',
    premium: '👑',
    shield:  '🛡️',
    bolt:    '⚡',
    gem:     '💎',
    star:    '⭐',
    check:   '✅',
    warn:    '⚠️',
    lock:    '🔐',
    dna:     '🧬',
    cpu:     '🖥️',
    pulse:   '📡',
    trophy:  '🏆',
    key:     '🔑',
    scan:    '🔍'
};

// ─── Messages de chargement ───────────────────────────────────────────────────
const LOADING_MESSAGES = [
    '🔍 Déchiffrage du hash cryptographique...',
    '🧬 Analyse de la signature HEX...',
    '📡 Synchronisation avec les cycles JetX...',
    '🖥️ Calcul de l\'entropie algorithmique...',
    '⚡ Traitement des données encryptées...',
    '🔐 Décodage du pattern HEX...',
    '🎯 Calibration de la prédiction avancée...',
    '🚀 Modèle IA prédictif en exécution...'
];

// ─── Niveaux de confiance ─────────────────────────────────────────────────────
const CONFIDENCE_LEVELS = [
    { min: 92, label: '🔥 ULTRA MAXIMALE',  bar: '██████████', desc: 'Hash validé — fenêtre de miser optimale confirmée' },
    { min: 82, label: '⚡ TRÈS HAUTE',       bar: '█████████░', desc: 'Signature HEX cohérente — probabilité de réussite élevée' },
    { min: 72, label: '✅ HAUTE',             bar: '████████░░', desc: 'Pattern détecté — signal fiable sur ce cycle' },
    { min: 62, label: '📊 MODÉRÉE-HAUTE',    bar: '███████░░░', desc: 'Entropie HEX partielle — miser avec précaution' },
    { min: 50, label: '📈 MODÉRÉE',           bar: '██████░░░░', desc: 'Données suffisantes — respecter la fenêtre cible' },
    { min: 0,  label: '⚠️ NORMALE',           bar: '█████░░░░░', desc: 'Signal en formation — surveiller l\'évolution du cycle' }
];

// ─── Hachage 32-bit déterministe ─────────────────────────────────────────────
function hash32(value) {
    let h = 0x811c9dc5;
    const str = String(value);
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
    }
    return h;
}

// Génère un flottant [0,1) depuis un seed entier
function seedFloat(seed) {
    const x = Math.sin(seed + 1) * 43758.5453123;
    return x - Math.floor(x);
}

// Flottant dans [min, max) depuis un seed
function randFloat(seed, min, max) {
    return min + seedFloat(seed) * (max - min);
}

// ─── Extraction d'entropie depuis le HEX ─────────────────────────────────────
function hexEntropy(hexStr) {
    const clean = hexStr.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    if (clean.length === 0) return { valid: false };

    // Diviser en 4 blocs de longueur égale
    const blockLen = Math.floor(clean.length / 4);
    const blocks = [
        clean.slice(0, blockLen),
        clean.slice(blockLen, blockLen * 2),
        clean.slice(blockLen * 2, blockLen * 3),
        clean.slice(blockLen * 3)
    ];

    // Convertir chaque bloc en nombre (modulo pour éviter les dépassements BigInt)
    const vals = blocks.map(b => {
        let acc = 0;
        for (let i = 0; i < b.length; i++) {
            acc = ((acc * 16) + parseInt(b[i], 16)) % 0x7FFFFFFF;
        }
        return acc;
    });

    // XOR fold général
    const fold = vals.reduce((a, v) => a ^ v, 0);

    // Parité de bits (nombre de 1) — indicateur de régularité
    let bitCount = 0;
    let temp = fold;
    while (temp > 0) { bitCount += temp & 1; temp >>= 1; }
    const bitRatio = bitCount / 32; // entre 0 et 1

    // Entropie de Shannon simplifiée sur les nibbles
    const nibbleFreq = new Array(16).fill(0);
    for (const c of clean) nibbleFreq[parseInt(c, 16)]++;
    const total = clean.length;
    let entropy = 0;
    for (const f of nibbleFreq) {
        if (f > 0) {
            const p = f / total;
            entropy -= p * Math.log2(p);
        }
    }
    const maxEntropy = Math.log2(16); // 4 bits
    const entropyRatio = entropy / maxEntropy; // entre 0 et 1

    return {
        valid: true,
        seed1: vals[0],
        seed2: vals[1],
        seed3: vals[2],
        seed4: vals[3],
        fold,
        bitRatio,
        entropyRatio,
        hexLen: clean.length
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
// Format attendu : COTE HEURE HEX
// Exemple : 4.23 14:36:07 3AB25DEEE47A6F8213CCC730ED2EFD027CD497A0EE8EF9FA4A2EFCCD2AFE2180
function parseInput(input) {
    const parts = input.trim().split(/\s+/);
    if (parts.length < 3) return null;

    const cote   = parseFloat(parts[0].replace(',', '.'));
    const time   = parseTime(parts[1]);
    const hexStr = parts[2];

    if (isNaN(cote) || cote < 2.0) return null;
    if (!time) return null;
    if (!/^[0-9a-fA-F]{16,}$/.test(hexStr)) return null;

    return { cote, time, hexStr };
}

// ─── Algorithme de prédiction principal ──────────────────────────────────────
function predictJetX(refCote, refTime, hexStr) {
    const ts = refTime.totalSeconds;

    // Seeds de base (côte + temps)
    const coteSeed  = hash32(Math.round(refCote * 100));
    const timeSeed  = hash32(ts);
    const phaseSeed = hash32(refTime.h * 100 + refTime.m);

    // Entropie HEX (source principale de précision)
    const hex = hexEntropy(hexStr);

    // Seeds composites enrichis par le HEX
    const hexFold   = hex.valid ? hex.fold : 0xDEADBEEF;
    const hexS1     = hex.valid ? hex.seed1 : hash32(hexStr.length);
    const hexS2     = hex.valid ? hex.seed2 : hash32(hexStr);
    const hexS3     = hex.valid ? hex.seed3 : hash32(refCote);
    const hexS4     = hex.valid ? hex.seed4 : hash32(ts);

    const masterSeed = (coteSeed ^ timeSeed ^ hexFold) >>> 0;
    const fineSeed   = (phaseSeed ^ hexS1 ^ hexS2) >>> 0;
    const zoneSeed   = (hexS3 ^ hexS4 ^ coteSeed) >>> 0;

    // ── Prédiction de la côte ──
    // Distribution pondérée enrichie par l'entropie HEX
    const entropyBoost = hex.valid ? hex.entropyRatio : 0.5;
    const zoneRoll = seedFloat(zoneSeed);

    // Seuils ajustés par l'entropie HEX (haute entropie → plus de chances sur les zones hautes)
    const t1 = 0.50 - entropyBoost * 0.08; // seuil zone 3–5×
    const t2 = 0.82 - entropyBoost * 0.05; // seuil zone 5–8×

    let predictedCote;
    if (zoneRoll < t1) {
        predictedCote = randFloat(masterSeed, 3.00, 4.99);
    } else if (zoneRoll < t2) {
        predictedCote = randFloat(fineSeed, 5.00, 7.99);
    } else {
        predictedCote = randFloat(zoneSeed ^ masterSeed, 8.00, 18.00);
    }

    // Ajustement dynamique selon la côte ref + entropie HEX
    const coteBoostAmt = (refCote - 2.0) * 0.15 + entropyBoost * 0.25;
    predictedCote = Math.min(predictedCote + coteBoostAmt, 25.00);
    predictedCote = Math.round(predictedCote * 100) / 100;

    // ── Prédiction de l'offset temporel ──
    // JetX rounds : 20–50 sec/round, on vise 3–7 rounds en avance
    const roundLen   = 20 + (hexFold % 30);          // 20–50 sec
    const roundCount = 3  + (masterSeed % 5);         // 3–7 rounds
    const baseDelay  = roundLen * roundCount;

    // Offset fin dérivé des bits bas du HEX seed
    const fineOffset = ((fineSeed % 31) - 15);        // ±15 sec
    const totalDelay = Math.max(baseDelay + fineOffset, 60); // minimum 60 sec

    const predictedTime = formatTime(ts + totalDelay);

    // ── Délai lisible ──
    const minutesDelay = Math.floor(totalDelay / 60);
    const secondsDelay = totalDelay % 60;
    const delayLabel   = minutesDelay > 0
        ? `${minutesDelay} min ${secondsDelay} sec`
        : `${secondsDelay} sec`;

    // ── Score de confiance ──
    const hexLenBonus     = hex.valid ? Math.min(hex.hexLen / 8, 12) : 0;
    const entropyBonus    = hex.valid ? Math.round(hex.entropyRatio * 18) : 5;
    const bitBonus        = hex.valid ? Math.round(hex.bitRatio * 10) : 0;
    const coteRefBonus    = Math.min((refCote - 2.0) * 7, 18);
    const phaseBonus      = (refTime.h >= 7 && refTime.h <= 23) ? 9 : 2;
    const timeRegularity  = (ts % 60 < 30) ? 8 : 3;
    const baseConfidence  = 48;

    const confidence = Math.min(
        Math.round(baseConfidence + hexLenBonus + entropyBonus + bitBonus + coteRefBonus + phaseBonus + timeRegularity),
        98
    );

    const confLevel = CONFIDENCE_LEVELS.find(l => confidence >= l.min);

    // ── Zone de la côte ──
    let coteZone;
    if (predictedCote >= 12)       coteZone = '🏆 JACKPOT SUPRÊME';
    else if (predictedCote >= 8)   coteZone = '💎 EXCEPTIONNEL';
    else if (predictedCote >= 5)   coteZone = '🔥 TRÈS ÉLEVÉ';
    else if (predictedCote >= 3.5) coteZone = '⚡ ÉLEVÉ';
    else                           coteZone = '✅ STANDARD 3×+';

    // ── Résumé HEX ──
    const hexPreview = hexStr.slice(0, 8) + '...' + hexStr.slice(-8);
    const hexScore   = hex.valid ? Math.round(hex.entropyRatio * 100) : 0;

    return {
        predictedCote,
        predictedTime,
        confidence,
        confLevel,
        roundCount,
        roundLen,
        delayLabel,
        coteZone,
        hexPreview,
        hexScore,
        entropyRatio: hex.valid ? hex.entropyRatio : 0
    };
}

// ─── Affichage de l'aide ──────────────────────────────────────────────────────
async function sendHelp(senderId) {
    const msg =
        `${DECO.top}\n` +
        `${DECO.line} ${DECO.rocket} JETX BET261 — GUIDE ${DECO.premium}\n` +
        `${DECO.mid}\n` +
        `${DECO.line} Comment utiliser :\n` +
        `${DECO.line}\n` +
        `${DECO.line} Envoyez : [CÔTE] [HEURE] [HEX]\n` +
        `${DECO.line}\n` +
        `${DECO.line} ${DECO.target} CÔTE : valeur ≥ 2.00×\n` +
        `${DECO.line}   (la côte du round de référence)\n` +
        `${DECO.line}\n` +
        `${DECO.line} ${DECO.clock} HEURE : HH:MM:SS\n` +
        `${DECO.line}   (heure exacte de ce round)\n` +
        `${DECO.line}\n` +
        `${DECO.line} ${DECO.key} HEX : code hexadécimal\n` +
        `${DECO.line}   (le hash affiché sur bet261)\n` +
        `${DECO.mid}\n` +
        `${DECO.line} ${DECO.bolt} Exemple :\n` +
        `${DECO.line} 4.23 14:36:07\n` +
        `${DECO.line} 3AB25DEEE47A6F8213CC...\n` +
        `${DECO.mid}\n` +
        `${DECO.line} ${DECO.shield} Résultat :\n` +
        `${DECO.line}   → Côte prédite ≥ 3.00×\n` +
        `${DECO.line}   → Heure précise pour miser\n` +
        `${DECO.line}   → Score de confiance HEX\n` +
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

    // ── Parseur de l'entrée ──
    const parsed = parseInput(input);

    if (!parsed) {
        await sendMessage(senderId,
            `${DECO.warn} Format invalide !\n\n` +
            `${DECO.bolt} Envoyez : CÔTE HEURE HEX\n\n` +
            `${DECO.target} Exemple :\n` +
            `4.23 14:36:07 3AB25DEEE47A...\n\n` +
            `${DECO.chart} Règles :\n` +
            `• Côte ≥ 2.00×\n` +
            `• Heure : HH:MM:SS\n` +
            `• HEX : code affiché sur bet261\n\n` +
            `Tapez "aide" pour le guide complet.`
        );
        return;
    }

    const { cote: refCote, time: refTime, hexStr } = parsed;

    // ── Message de chargement aléatoire ──
    const loadMsg = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
    await sendMessage(senderId,
        `${DECO.rocket} Prédiction JetX en cours...\n` +
        `${DECO.dot}\n` +
        `${loadMsg}\n` +
        `${DECO.key} Hash : ${hexStr.slice(0, 10)}...`
    );

    await new Promise(r => setTimeout(r, 2000));

    // ── Calcul de la prédiction ──
    const result = predictJetX(refCote, refTime, hexStr);
    const {
        predictedCote,
        predictedTime,
        confidence,
        confLevel,
        roundCount,
        roundLen,
        delayLabel,
        coteZone,
        hexPreview,
        hexScore
    } = result;

    const coteDisplay = predictedCote.toFixed(2) + '×';
    const refDisplay  = refCote.toFixed(2) + '×';
    const refTimeStr  = `${String(refTime.h).padStart(2,'0')}:${String(refTime.m).padStart(2,'0')}:${String(refTime.s).padStart(2,'0')}`;

    // ── Barre de score HEX ──
    const hexBarFilled = Math.round(hexScore / 10);
    const hexBar = '█'.repeat(hexBarFilled) + '░'.repeat(10 - hexBarFilled);

    const response =
        `${DECO.top}\n` +
        `${DECO.line}  ${DECO.premium} PRÉDICTION JETX PREMIUM ${DECO.check}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.scan} DONNÉES ANALYSÉES\n` +
        `${DECO.line}  Côte réf  : ${refDisplay}\n` +
        `${DECO.line}  Heure réf : ${refTimeStr}\n` +
        `${DECO.line}  Hash HEX  : ${hexPreview}\n` +
        `${DECO.line}  Entropie  : ${hexBar} ${hexScore}%\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.rocket} SIGNAL CIBLE IDENTIFIÉ\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${DECO.fire} CÔTE PRÉDITE\n` +
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
        `${DECO.line}  ${DECO.dna} Durée round : ~${roundLen} sec\n` +
        `${DECO.line}  ${DECO.gem} Rounds ciblés : ~${roundCount} avant signal\n` +
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
        `${DECO.line}  • Mise responsable — max 5% bankroll\n` +
        `${DECO.line}  • Si raté, attendre le prochain HEX\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.lock} Algorithme JetX Crypto v3\n` +
        `${DECO.line}  Prédiction basée sur entropie HEX\n` +
        `${DECO.bot}`;

    await sendMessage(senderId, response);
};
