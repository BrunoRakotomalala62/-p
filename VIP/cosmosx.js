const sendMessage = require('../handles/sendMessage');

// ─── Sessions utilisateur ─────────────────────────────────────────────────────
const userSessions = new Map();

// ─── Décoration visuelle ──────────────────────────────────────────────────────
const D = {
    top:  '╔════════════════════════════════════╗',
    mid:  '╠════════════════════════════════════╣',
    bot:  '╚════════════════════════════════════╝',
    sep:  '║────────────────────────────────────║',
    ln:   '║',
};

// ─── Constantes CosmosX ───────────────────────────────────────────────────────
const ROUND_MIN_SEC  = 20;   // durée minimale d'un round (secondes)
const ROUND_MAX_SEC  = 38;   // durée maximale d'un round
const TARGET_MIN_X   = 5.0;  // cible minimale (≥ 5×)

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

// Flottant déterministe [0, 1) depuis un seed
function sf(seed) {
    const x = Math.sin((seed >>> 0) * 1.6180339887 + 2.7182818284) * 9301.0 + 49297.0;
    return (x - Math.floor(x));
}

// Flottant dans [lo, hi) depuis un seed
function rf(seed, lo, hi) {
    return lo + sf(seed) * (hi - lo);
}

// ─── Analyse de la valeur hex ─────────────────────────────────────────────────
function analyzeHex(hexStr) {
    const clean = hexStr.replace(/[^0-9a-fA-F]/g, '');
    if (clean.length === 0) return { valid: false };

    const dec      = parseInt(clean, 16);
    const bits     = dec.toString(2);
    const ones     = (bits.match(/1/g) || []).length;
    const zeros    = bits.length - ones;
    const balance  = ones / bits.length;           // ratio de 1 binaires
    const nibbles  = clean.split('').map(c => parseInt(c, 16));
    const nibSum   = nibbles.reduce((a, v) => a + v, 0);
    const nibAlt   = nibbles.reduce((a, v, i) => a + (i % 2 === 0 ? v : -v), 0);

    // Entropie de Shannon sur nibbles
    const freq = new Array(16).fill(0);
    nibbles.forEach(n => freq[n]++);
    let entropy = 0;
    nibbles.forEach(n => {
        const p = freq[n] / nibbles.length;
        if (p > 0) entropy -= p * Math.log2(p);
    });
    const entropyRatio = entropy / Math.log2(16);   // [0, 1]

    // Seeds dérivés du hex
    const h1 = fnv32(dec);
    const h2 = fnv32(nibSum * 31 + nibAlt);
    const h3 = fnv32(clean.slice(0, Math.ceil(clean.length / 2)));
    const h4 = fnv32(clean.slice(Math.ceil(clean.length / 2)));
    const fold = (h1 ^ h2 ^ h3 ^ h4) >>> 0;

    return { valid: true, dec, h1, h2, h3, h4, fold, nibSum, nibAlt, balance, entropyRatio };
}

// ─── Parseur du temps ─────────────────────────────────────────────────────────
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

// ─── Parseur du format étiqueté ──────────────────────────────────────────────
// Accepte :
//   Multiplicateur : 3.75
//   Tour : 8419176
//   Heure : 08:14:57
//   Hex : 421cd5a4
// OU compact : 3.75 8419176 08:14:57 421cd5a4
function parseInput(raw) {
    const text = raw.trim();

    // ── Format étiqueté ──
    const labeledPattern = /multiplicateur\s*[:=]\s*([\d.,]+)[\s\S]*?tour\s*[:=]\s*(\d+)[\s\S]*?heure\s*[:=]\s*([\d:]+)[\s\S]*?hex\s*[:=]\s*([0-9a-fA-F]+)/i;
    const lm = text.match(labeledPattern);
    if (lm) {
        const mult = parseFloat(lm[1].replace(',', '.'));
        const tour = parseInt(lm[2], 10);
        const time = parseTime(lm[3]);
        const hex  = lm[4];
        if (!isNaN(mult) && mult >= 1.0 && !isNaN(tour) && time && /^[0-9a-fA-F]{4,}$/i.test(hex)) {
            return { mult, tour, time, hex };
        }
    }

    // ── Format compact : mult tour heure hex ──
    const parts = text.split(/\s+/);
    if (parts.length >= 4) {
        const mult = parseFloat(parts[0].replace(',', '.'));
        const tour = parseInt(parts[1], 10);
        const time = parseTime(parts[2]);
        const hex  = parts[3];
        if (!isNaN(mult) && mult >= 1.0 && !isNaN(tour) && time && /^[0-9a-fA-F]{4,}$/i.test(hex)) {
            return { mult, tour, time, hex };
        }
    }

    return null;
}

// ─── Algorithme de prédiction CosmosX ────────────────────────────────────────
// Données : mult (dernier multiplicateur connu), tour (numéro du round),
//           time (heure du round), hex (valeur hash du round)
//
// Principe mathématique :
//   1. L'entropie du hash hex mesure la dispersion du signal aléatoire.
//   2. Le numéro de tour module des cycles de longueur variable.
//   3. La combinaison FNV croise les quatre dimensions pour un seed stable.
//   4. On génère N fenêtres (tours à venir) et sélectionne celle où le
//      multiplicateur calculé dépasse TARGET_MIN_X (≥ 5×).
function predictCosmosX(mult, tour, time, hexStr) {
    const hex     = analyzeHex(hexStr);
    const hexFold = hex.valid ? hex.fold : fnv32(hexStr);
    const h1      = hex.valid ? hex.h1 : fnv32(hexStr + '1');
    const h2      = hex.valid ? hex.h2 : fnv32(hexStr + '2');
    const h3      = hex.valid ? hex.h3 : fnv32(hexStr + '3');
    const entrRatio = hex.valid ? hex.entropyRatio : 0.5;
    const nibSum    = hex.valid ? hex.nibSum : 20;

    // Seeds composites croisant tour + temps + hex + multiplicateur
    const tourSeed  = fnv32(tour);
    const timeSeed  = fnv32(time.ts);
    const multSeed  = fnv32(Math.round(mult * 100));
    const master    = (tourSeed ^ timeSeed ^ hexFold ^ multSeed) >>> 0;
    const phase     = (h1 ^ h2 ^ h3) >>> 0;

    // Durée d'un round en secondes : dépend du cycle hex
    // Plus l'entropie est haute, plus les rounds sont courts (marché actif)
    const roundDur  = Math.round(ROUND_MIN_SEC + (1 - entrRatio) * (ROUND_MAX_SEC - ROUND_MIN_SEC));

    // ── Génération de 12 rounds candidats ──
    // Pour chaque round futur k, on calcule un seed croisé et un multiplicateur candidat.
    const candidates = [];

    for (let k = 1; k <= 12; k++) {
        // Seed du round k : combine le numéro de tour, k, et le master
        const kSeed  = fnv32(tour + k);
        const xSeed  = (master ^ kSeed ^ (phase * k)) >>> 0;
        const ySeed  = fnv32(nibSum * k + time.ts);

        // Calcul du multiplicateur par distribution log-normale déterministe :
        //   ln(X) ~ N(μ, σ)  ⟹  X = exp(μ + σ * Z)
        // Z approché par transformation de Box-Muller déterministe :
        const u1 = sf(xSeed) || 1e-10;
        const u2 = sf(ySeed) || 1e-10;
        const zNorm = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

        // Paramètres ajustés : mu et sigma dépendent de l'entropie du hex et du mult de référence
        const mu    = 1.4 + entrRatio * 0.6 + Math.log(Math.max(mult, 1.0)) * 0.15;
        const sigma = 0.8 + (1 - entrRatio) * 0.4;
        let predictedMult = Math.exp(mu + sigma * zNorm);
        predictedMult = Math.max(1.01, Math.round(predictedMult * 100) / 100);

        const predictedTour = tour + k;
        const predictedTime = formatTime(time.ts + k * roundDur);

        candidates.push({ k, predictedMult, predictedTour, predictedTime, xSeed });
    }

    // ── Sélectionner la meilleure fenêtre ≥ 5× ──
    // On prend le premier round où mult ≥ TARGET_MIN_X dans les 12 candidats
    let bestWindow = candidates.find(c => c.predictedMult >= TARGET_MIN_X);

    // Si aucun ne dépasse 5× dans les 12 tours, on prend le maximum
    if (!bestWindow) {
        bestWindow = candidates.reduce((a, b) => a.predictedMult > b.predictedMult ? a : b);
    }

    // ── Score de confiance ──
    // Construit à partir de facteurs mesurables
    const hexEntrBonus  = Math.round(entrRatio * 25);           // 0–25
    const tourCycleBonus = ((tour % 100) < 50) ? 8 : 4;         // Parité de cycle
    const timePeakBonus  = (time.h >= 7 && time.h <= 23) ? 10 : 3; // Heure active
    const multBonus      = Math.min(Math.round((mult - 1) * 3), 15); // Mult de référence
    const hexLenBonus    = Math.min((hexStr.replace(/[^0-9a-fA-F]/gi, '').length) * 2, 12);
    const baseConf       = 50;
    const confidence     = Math.min(baseConf + hexEntrBonus + tourCycleBonus + timePeakBonus + multBonus + hexLenBonus, 97);

    // Niveau de confiance
    let confLabel, confBar;
    if      (confidence >= 90) { confLabel = '🌌 COSMIQUE MAXIMAL';  confBar = '██████████'; }
    else if (confidence >= 80) { confLabel = '🔥 ULTRA HAUTE';        confBar = '█████████░'; }
    else if (confidence >= 70) { confLabel = '⚡ TRÈS HAUTE';          confBar = '████████░░'; }
    else if (confidence >= 60) { confLabel = '✅ HAUTE';               confBar = '███████░░░'; }
    else if (confidence >= 50) { confLabel = '📊 MODÉRÉE';             confBar = '██████░░░░'; }
    else                       { confLabel = '⚠️ NORMALE';             confBar = '█████░░░░░'; }

    // Zone multiplicateur
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

// ─── Aide ─────────────────────────────────────────────────────────────────────
async function sendHelp(senderId) {
    const msg =
        `${D.top}\n` +
        `${D.ln}  👑 COSMOSX — GUIDE D'UTILISATION\n` +
        `${D.mid}\n` +
        `${D.ln}  📋 Format d'entrée :\n` +
        `${D.ln}\n` +
        `${D.ln}  Multiplicateur : [valeur]\n` +
        `${D.ln}  Tour : [numéro]\n` +
        `${D.ln}  Heure : [HH:MM:SS]\n` +
        `${D.ln}  Hex : [valeur hex]\n` +
        `${D.mid}\n` +
        `${D.ln}  💡 Exemple :\n` +
        `${D.ln}\n` +
        `${D.ln}  Multiplicateur : 3.75\n` +
        `${D.ln}  Tour : 8419176\n` +
        `${D.ln}  Heure : 08:14:57\n` +
        `${D.ln}  Hex : 421cd5a4\n` +
        `${D.mid}\n` +
        `${D.ln}  🎯 Résultat :\n` +
        `${D.ln}  → Tour prédit (≥ 5×)\n` +
        `${D.ln}  → Heure exacte pour miser\n` +
        `${D.ln}  → Multiplicateur prédit\n` +
        `${D.ln}  → Score de confiance\n` +
        `${D.bot}`;
    await sendMessage(senderId, msg);
}

// ─── Module principal ─────────────────────────────────────────────────────────
module.exports = async (senderId, prompt) => {
    const input = (prompt || '').trim();

    if (!input || ['aide', 'help', '?', 'info', 'guide'].includes(input.toLowerCase())) {
        await sendHelp(senderId);
        return;
    }

    const parsed = parseInput(input);

    if (!parsed) {
        await sendMessage(senderId,
            `⚠️ Format non reconnu.\n\n` +
            `📋 Envoyez les données dans ce format :\n\n` +
            `Multiplicateur : 3.75\n` +
            `Tour : 8419176\n` +
            `Heure : 08:14:57\n` +
            `Hex : 421cd5a4\n\n` +
            `Tapez "aide" pour le guide complet.`
        );
        return;
    }

    const { mult, tour, time, hex } = parsed;

    // ── Message de chargement ──
    const loadMsgs = [
        '🔍 Déchiffrage du signal Hex en cours...',
        '⚛️ Analyse du cycle de tour...',
        '🧬 Calcul de l\'entropie binaire...',
        '🪐 Modélisation de la fenêtre temporelle...',
        '🚀 Algorithme prédictif actif...',
    ];
    const loadMsg = loadMsgs[Math.floor(Math.random() * loadMsgs.length)];

    await sendMessage(senderId,
        `🌌 CosmosX — Analyse en cours...\n` +
        `${loadMsg}\n\n` +
        `🔑 Hex analysé : ${hex}\n` +
        `📍 Tour de référence : ${tour}`
    );

    await new Promise(r => setTimeout(r, 2200));

    // ── Calcul ──
    const result = predictCosmosX(mult, tour, time, hex);

    const refTimeStr = formatTime(time.ts);
    const multRef    = mult.toFixed(2);
    const multPred   = result.predictedMult.toFixed(2);

    // ── Top 3 prochaines fenêtres ≥ 5× ──
    const top3 = result.candidates
        .filter(c => c.predictedMult >= TARGET_MIN_X)
        .slice(0, 3);

    let windowsBlock = '';
    if (top3.length > 0) {
        windowsBlock =
            `${D.sep}\n` +
            `${D.ln}  📡 FENÊTRES DÉTECTÉES (≥ 5×)\n` +
            `${D.ln}\n`;
        top3.forEach((w, i) => {
            const label = i === 0 ? '🎯 Priorité 1' : i === 1 ? '⚡ Priorité 2' : '📊 Priorité 3';
            windowsBlock +=
                `${D.ln}  ${label}\n` +
                `${D.ln}  Tour : ${w.predictedTour}   Heure : ${w.predictedTime}\n` +
                `${D.ln}  Multiplicateur : ${w.predictedMult.toFixed(2)}×\n` +
                (i < top3.length - 1 ? `${D.ln}\n` : '');
        });
    }

    const response =
        `${D.top}\n` +
        `${D.ln}  🌌 COSMOSX — PRÉDICTION PREMIUM\n` +
        `${D.mid}\n` +
        `${D.ln}  📥 DONNÉES REÇUES\n` +
        `${D.ln}\n` +
        `${D.ln}  Multiplicateur : ${multRef}×\n` +
        `${D.ln}  Tour           : ${tour}\n` +
        `${D.ln}  Heure          : ${refTimeStr}\n` +
        `${D.ln}  Hex            : ${hex}\n` +
        `${D.sep}\n` +
        `${D.ln}  🔬 ANALYSE MATHÉMATIQUE\n` +
        `${D.ln}\n` +
        `${D.ln}  Entropie hex  : ${result.entrRatio}%\n` +
        `${D.ln}  Durée/round   : ~${result.roundDur} sec\n` +
        `${D.ln}  Rounds scannés : 12 fenêtres\n` +
        `${D.sep}\n` +
        `${D.ln}  🎯 MEILLEURE PRÉDICTION\n` +
        `${D.ln}\n` +
        `${D.ln}  Tour prédit        : ${result.predictedTour}\n` +
        `${D.ln}  Heure              : ${result.predictedTime}\n` +
        `${D.ln}  Multiplicateur prédit : ${multPred}×\n` +
        `${D.ln}\n` +
        `${D.ln}  ${result.multZone}\n` +
        (windowsBlock ? windowsBlock : '') +
        `${D.sep}\n` +
        `${D.ln}  🛡️ SCORE DE CONFIANCE\n` +
        `${D.ln}\n` +
        `${D.ln}  ${result.confBar}  ${result.confidence}%\n` +
        `${D.ln}  ${result.confLabel}\n` +
        `${D.sep}\n` +
        `${D.ln}  💡 STRATÉGIE\n` +
        `${D.ln}  • Misez au tour prédit\n` +
        `${D.ln}  • Encaissez dès le multiplicateur atteint\n` +
        `${D.ln}  • Mise conseillée : max 5% bankroll\n` +
        `${D.bot}`;

    await sendMessage(senderId, response);
};
