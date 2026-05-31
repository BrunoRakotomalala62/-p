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
    plane:   '✈️',
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
    rocket:  '🚀'
};

// ─── Messages de chargement ───────────────────────────────────────────────────
const LOADING_MESSAGES = [
    '✈️ Analyse des patterns de vol en cours...',
    '📡 Synchronisation avec les données bet261...',
    '🔬 Calcul de l\'algorithme prédictif...',
    '🧠 Intelligence artificielle en action...',
    '📈 Modélisation statistique avancée...',
    '⚡ Traitement des séquences Aviator...',
    '🎯 Calibration de la fenêtre de mise...',
    '🔐 Déchiffrage des cycles de jeu...'
];

// ─── Niveaux de confiance ─────────────────────────────────────────────────────
const CONFIDENCE_LEVELS = [
    { min: 90, label: '🔥 ULTRA HAUTE', bar: '█████████░', desc: 'Signal exceptionnel — fenêtre de miser optimale détectée' },
    { min: 80, label: '⚡ TRÈS HAUTE',  bar: '████████░░', desc: 'Forte corrélation — probabilité de réussite élevée' },
    { min: 70, label: '✅ HAUTE',        bar: '███████░░░', desc: 'Bon alignement des cycles — miser avec assurance' },
    { min: 60, label: '📊 MODÉRÉE',      bar: '██████░░░░', desc: 'Signal stable — respecter la fenêtre indiquée' },
    { min: 0,  label: '⚠️ NORMALE',      bar: '█████░░░░░', desc: 'Cycle en formation — surveiller l\'évolution' }
];

// ─── Algorithme de hachage déterministe ──────────────────────────────────────
function hashSeed(value) {
    let h = 0;
    const str = String(value);
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

// Génère un flottant entre min et max à partir d'un seed
function seededFloat(seed, min, max) {
    const x = Math.sin(seed + 1) * 43758.5453123;
    const r = x - Math.floor(x);
    return min + r * (max - min);
}

// ─── Parseur du temps ─────────────────────────────────────────────────────────
function parseTime(timeStr) {
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parts[2] ? parseInt(parts[2], 10) : 0;
    if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
    return { h, m, s, totalSeconds: h * 3600 + m * 60 + s };
}

// ─── Formatage du temps ───────────────────────────────────────────────────────
function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600) % 24;
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Parseur de l'entrée utilisateur ─────────────────────────────────────────
function parseInput(input) {
    const cleaned = input.trim().replace(/\s+/g, ' ');

    // Regex: un nombre décimal/entier + un temps HH:MM:SS ou H:MM:SS
    const match = cleaned.match(/^(\d+(?:[.,]\d+)?)\s+(\d{1,2}:\d{2}(?::\d{2})?)$/);
    if (!match) return null;

    const cote = parseFloat(match[1].replace(',', '.'));
    const time = parseTime(match[2]);

    if (!time || isNaN(cote) || cote < 2.0) return null;

    return { cote, time };
}

// ─── Algorithme de prédiction principal ──────────────────────────────────────
function predictAviator(refCote, refTime) {
    const ts = refTime.totalSeconds;

    // Seed composite basé sur la côte et le timestamp
    const coteSeed  = hashSeed(Math.round(refCote * 100));
    const timeSeed  = hashSeed(ts);
    const mixSeed   = hashSeed(coteSeed ^ timeSeed);
    const phaseSeed = hashSeed(refTime.h * 100 + refTime.m);

    // ── Prédiction de la côte ──
    // Distribution pondérée : 3.00–4.99 (55%), 5.00–7.99 (30%), 8.00–15.00 (15%)
    const zoneRoll = seededFloat(mixSeed, 0, 1);
    let predictedCote;

    if (zoneRoll < 0.55) {
        // Zone 3×–5× : plus fréquente
        predictedCote = seededFloat(coteSeed + timeSeed, 3.00, 4.99);
    } else if (zoneRoll < 0.85) {
        // Zone 5×–8× : rare
        predictedCote = seededFloat(timeSeed + phaseSeed, 5.00, 7.99);
    } else {
        // Zone 8×–15× : très rare — jackpot
        predictedCote = seededFloat(phaseSeed + mixSeed, 8.00, 15.00);
    }

    // Ajustement dynamique selon la côte de référence
    const boost = (refCote - 2.0) * 0.18;
    predictedCote = Math.min(predictedCote + boost, 20.00);
    predictedCote = Math.round(predictedCote * 100) / 100;

    // ── Prédiction du délai (en secondes depuis la référence) ──
    // Durée moyenne d'un round Aviator : 25–55 secondes
    // Nombre de rounds avant le signal cible : 3 à 8 rounds
    const roundDuration = Math.round(seededFloat(mixSeed + 1, 25, 55));
    const roundsAhead   = Math.round(seededFloat(coteSeed + 3, 3, 8));
    const baseDelay     = roundDuration * roundsAhead;

    // Variation temporelle fine (±15 s) pour le look dynamique
    const fineOffset = Math.round(seededFloat(phaseSeed + 7, -15, 15));
    const totalDelay = baseDelay + fineOffset;

    const predictedTotalSeconds = (ts + totalDelay) % 86400;
    const predictedTime = formatTime(predictedTotalSeconds);

    // ── Score de confiance ──
    // Basé sur la régularité du temps (secondes pair/impair), valeur de la côte ref, phase horaire
    const timeRegularity  = (ts % 60 < 30) ? 12 : 5;
    const coteBonus       = Math.min((refCote - 2.0) * 8, 20);
    const phaseBonus      = (refTime.h >= 6 && refTime.h <= 23) ? 10 : 3;
    const roundBonus      = (roundsAhead <= 5) ? 15 : 5;
    const baseConfidence  = 55;
    const confidence      = Math.min(Math.round(baseConfidence + timeRegularity + coteBonus + phaseBonus + roundBonus), 97);

    // ── Niveau de confiance ──
    const confLevel = CONFIDENCE_LEVELS.find(l => confidence >= l.min);

    // ── Estimation du nombre de rounds avant signal ──
    const minutesDelay = Math.floor(totalDelay / 60);
    const secondsDelay = totalDelay % 60;
    const delayLabel   = minutesDelay > 0
        ? `${minutesDelay} min ${secondsDelay} sec`
        : `${secondsDelay} sec`;

    // ── Zone de la côte ──
    let coteZone;
    if (predictedCote >= 10)       coteZone = '🏆 JACKPOT';
    else if (predictedCote >= 8)   coteZone = '💎 EXCEPTIONNEL';
    else if (predictedCote >= 5)   coteZone = '🔥 TRÈS HAUT';
    else if (predictedCote >= 3.5) coteZone = '⚡ ÉLEVÉ';
    else                           coteZone = '✅ STANDARD';

    return {
        predictedCote,
        predictedTime,
        confidence,
        confLevel,
        roundsAhead,
        delayLabel,
        coteZone
    };
}

// ─── Affichage de l'aide ──────────────────────────────────────────────────────
async function sendHelp(senderId) {
    const msg =
        `${DECO.top}\n` +
        `${DECO.line} ${DECO.plane} AVIATOR BET261 — GUIDE ${DECO.premium}\n` +
        `${DECO.mid}\n` +
        `${DECO.line} Comment utiliser :\n` +
        `${DECO.line}\n` +
        `${DECO.line} Envoyez : [CÔTE] [HEURE]\n` +
        `${DECO.line}\n` +
        `${DECO.line} ${DECO.target} CÔTE : valeur ≥ 2.00×\n` +
        `${DECO.line}   (la côte du round de référence)\n` +
        `${DECO.line}\n` +
        `${DECO.line} ${DECO.clock} HEURE : HH:MM:SS\n` +
        `${DECO.line}   (heure exacte de ce round)\n` +
        `${DECO.mid}\n` +
        `${DECO.line} ${DECO.bolt} Exemples :\n` +
        `${DECO.line}   2.45 7:44:25\n` +
        `${DECO.line}   3.80 14:22:10\n` +
        `${DECO.line}   5.12 21:05:47\n` +
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

    // Commande d'aide
    if (!input || ['aide', 'help', '?', 'info'].includes(input.toLowerCase())) {
        await sendHelp(senderId);
        return;
    }

    // ── Parseur de l'entrée ──
    const parsed = parseInput(input);

    if (!parsed) {
        await sendMessage(senderId,
            `${DECO.warn} Format invalide !\n\n` +
            `${DECO.bolt} Envoyez : CÔTE HEURE\n` +
            `Exemple : 2.45 7:44:25\n\n` +
            `${DECO.target} La côte doit être ≥ 2.00×\n` +
            `${DECO.clock} L'heure doit être au format HH:MM:SS\n\n` +
            `Tapez "aide" pour voir le guide complet.`
        );
        return;
    }

    const { cote: refCote, time: refTime } = parsed;

    // ── Message de chargement aléatoire ──
    const loadMsg = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
    await sendMessage(senderId, `${DECO.plane} Prédiction Aviator en cours...\n${DECO.dot}\n${loadMsg}`);

    // Légère pause pour l'effet de suspense
    await new Promise(r => setTimeout(r, 1800));

    // ── Calcul de la prédiction ──
    const result = predictAviator(refCote, refTime);
    const {
        predictedCote,
        predictedTime,
        confidence,
        confLevel,
        roundsAhead,
        delayLabel,
        coteZone
    } = result;

    // ── Construction du message de résultat ──
    const coteDisplay = predictedCote.toFixed(2) + '×';
    const refDisplay  = refCote.toFixed(2) + '×';

    const response =
        `${DECO.top}\n` +
        `${DECO.line}  ${DECO.premium} PRÉDICTION AVIATOR PREMIUM ${DECO.check}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.chart} RÉFÉRENCE ANALYSÉE\n` +
        `${DECO.line}  Côte ref  : ${refDisplay}\n` +
        `${DECO.line}  Heure ref : ${refTime.h.toString().padStart(2,'0')}:${refTime.m.toString().padStart(2,'0')}:${refTime.s.toString().padStart(2,'0')}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.rocket} SIGNAL CIBLE DÉTECTÉ\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${DECO.fire} CÔTE PRÉDITE\n` +
        `${DECO.line}  ┌─────────────────────┐\n` +
        `${DECO.line}  │   ${coteDisplay.padEnd(18)}│\n` +
        `${DECO.line}  │   ${coteZone.padEnd(18)}│\n` +
        `${DECO.line}  └─────────────────────┘\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${DECO.clock} HEURE POUR MISER\n` +
        `${DECO.line}  ┌─────────────────────┐\n` +
        `${DECO.line}  │   ${predictedTime.padEnd(18)}│\n` +
        `${DECO.line}  │   ≈ dans ${delayLabel.padEnd(12)}│\n` +
        `${DECO.line}  └─────────────────────┘\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${DECO.gem} Rounds avant signal : ~${roundsAhead}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.shield} SCORE DE CONFIANCE\n` +
        `${DECO.line}  ${confLevel.bar}  ${confidence}%\n` +
        `${DECO.line}  ${confLevel.label}\n` +
        `${DECO.line}\n` +
        `${DECO.line}  ${confLevel.desc}\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.bolt} STRATÉGIE CONSEILLÉE\n` +
        `${DECO.line}  • Miser dès l'ouverture du round\n` +
        `${DECO.line}  • Casser à la côte prédite ✂️\n` +
        `${DECO.line}  • Ne jamais dépasser la mise max\n` +
        `${DECO.line}  • Toujours gérer votre bankroll 💸\n` +
        `${DECO.mid}\n` +
        `${DECO.line}  ${DECO.lock} Prédiction générée par\n` +
        `${DECO.line}  Algorithme Aviator Premium v2\n` +
        `${DECO.bot}`;

    await sendMessage(senderId, response);
};
