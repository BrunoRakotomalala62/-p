const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE_URL = 'https://translation-neon.vercel.app';

const LANGUAGE_FLAGS = {
    'FR': '🇫🇷',
    'EN': '🇬🇧',
    'MLG': '🇲🇬',
    'ES': '🇪🇸',
    'DE': '🇩🇪',
    'IT': '🇮🇹',
    'PT': '🇵🇹',
    'ZH': '🇨🇳',
    'JA': '🇯🇵',
    'AR': '🇸🇦',
    'RU': '🇷🇺',
    'KO': '🇰🇷',
    'NL': '🇳🇱',
    'PL': '🇵🇱',
    'TR': '🇹🇷',
    'VI': '🇻🇳',
    'TH': '🇹🇭',
    'ID': '🇮🇩',
    'HI': '🇮🇳',
    'SW': '🇹🇿'
};

const LANGUAGE_NAMES = {
    'FR': 'Français',
    'EN': 'Anglais',
    'MLG': 'Malgache',
    'ES': 'Espagnol',
    'DE': 'Allemand',
    'IT': 'Italien',
    'PT': 'Portugais',
    'ZH': 'Chinois',
    'JA': 'Japonais',
    'AR': 'Arabe',
    'RU': 'Russe',
    'KO': 'Coréen',
    'NL': 'Néerlandais',
    'PL': 'Polonais',
    'TR': 'Turc',
    'VI': 'Vietnamien',
    'TH': 'Thaï',
    'ID': 'Indonésien',
    'HI': 'Hindi',
    'SW': 'Swahili'
};

function showGuide() {
    return `
╔══════════════════════════════════════╗
║    🌍 𝗧𝗥𝗔𝗗𝗨𝗖𝗧𝗘𝗨𝗥 𝗨𝗡𝗜𝗩𝗘𝗥𝗦𝗘𝗟 🌍    ║
╠══════════════════════════════════════╣
║  Traduisez instantanément vers       ║
║  20 langues différentes !            ║
╚══════════════════════════════════════╝

📖 𝗖𝗢𝗠𝗠𝗘𝗡𝗧 𝗨𝗧𝗜𝗟𝗜𝗦𝗘𝗥 :

➤ 𝗧𝗿𝗮𝗱𝘂𝗰𝘁𝗶𝗼𝗻 𝗮𝘂𝘁𝗼𝗺𝗮𝘁𝗶𝗾𝘂𝗲 :
   translation <votre texte>
   
➤ 𝗧𝗿𝗮𝗱𝘂𝗰𝘁𝗶𝗼𝗻 𝘃𝗲𝗿𝘀 𝘂𝗻𝗲 𝗹𝗮𝗻𝗴𝘂𝗲 :
   translation <CODE> <votre texte>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 𝗘𝗫𝗘𝗠𝗣𝗟𝗘𝗦 :

• translation Bonjour tout le monde
  → Traduit automatiquement en Malgache

• translation EN Salama daholo
  → Traduit en Anglais

• translation FR Hello how are you
  → Traduit en Français

• translation JA Je t'aime
  → Traduit en Japonais

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 𝗟𝗔𝗡𝗚𝗨𝗘𝗦 𝗗𝗜𝗦𝗣𝗢𝗡𝗜𝗕𝗟𝗘𝗦 :

🇫🇷 FR - Français    🇬🇧 EN - Anglais
🇲🇬 MLG - Malgache   🇪🇸 ES - Espagnol
🇩🇪 DE - Allemand    🇮🇹 IT - Italien
🇵🇹 PT - Portugais   🇨🇳 ZH - Chinois
🇯🇵 JA - Japonais    🇸🇦 AR - Arabe
🇷🇺 RU - Russe       🇰🇷 KO - Coréen
🇳🇱 NL - Néerlandais 🇵🇱 PL - Polonais
🇹🇷 TR - Turc        🇻🇳 VI - Vietnamien
🇹🇭 TH - Thaï        🇮🇩 ID - Indonésien
🇮🇳 HI - Hindi       🇹🇿 SW - Swahili

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 𝗔𝘀𝘁𝘂𝗰𝗲 : Sans code de langue, le bot
détecte automatiquement et traduit
vers le Malgache par défaut !
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
}

function parseInput(prompt) {
    const trimmedPrompt = prompt.trim();
    const parts = trimmedPrompt.split(/\s+/);
    
    if (parts.length === 0) {
        return { targetLang: null, text: null, showHelp: true };
    }
    
    const firstWord = parts[0].toUpperCase();
    
    if (LANGUAGE_NAMES[firstWord]) {
        const text = parts.slice(1).join(' ').trim();
        if (!text) {
            return { targetLang: null, text: null, showHelp: true };
        }
        return { targetLang: firstWord, text: text, showHelp: false };
    }
    
    return { targetLang: 'MLG', text: trimmedPrompt, showHelp: false };
}

async function translateText(text, targetLang) {
    const url = `${API_BASE_URL}/translate?texte=${encodeURIComponent(text)}&langue=${targetLang}`;
    const response = await axios.get(url, { timeout: 15000 });
    return response.data;
}

function formatTranslationResult(data, originalText) {
    const sourceFlag = LANGUAGE_FLAGS[data.langue_source] || '🌐';
    const targetFlag = LANGUAGE_FLAGS[data.langue_cible] || '🌐';
    const sourceName = LANGUAGE_NAMES[data.langue_source] || data.langue_source_nom || 'Détectée';
    const targetName = LANGUAGE_NAMES[data.langue_cible] || data.langue_cible_nom;
    
    const detectionBadge = data.detection_automatique ? '🔍 Détection auto' : '';
    
    return `
╔══════════════════════════════════════╗
║     ✨ 𝗧𝗥𝗔𝗗𝗨𝗖𝗧𝗜𝗢𝗡 𝗥𝗘𝗨𝗦𝗦𝗜𝗘 ✨     ║
╚══════════════════════════════════════╝

${sourceFlag} 𝗧𝗲𝘅𝘁𝗲 𝗼𝗿𝗶𝗴𝗶𝗻𝗮𝗹 (${sourceName}) :
┌──────────────────────────────────────
│ ${data.texte_original}
└──────────────────────────────────────

${targetFlag} 𝗧𝗿𝗮𝗱𝘂𝗰𝘁𝗶𝗼𝗻 (${targetName}) :
┌──────────────────────────────────────
│ ${data.traduction}
└──────────────────────────────────────

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${detectionBadge}
${sourceFlag} ${sourceName} ➜ ${targetFlag} ${targetName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
}

module.exports = async (senderId, prompt) => {
    try {
        const { targetLang, text, showHelp } = parseInput(prompt);
        
        if (showHelp || !text) {
            await sendMessage(senderId, showGuide());
            return;
        }
        
        const targetFlag = LANGUAGE_FLAGS[targetLang] || '🌐';
        const targetName = LANGUAGE_NAMES[targetLang] || targetLang;
        
        await sendMessage(senderId, `🔄 𝗧𝗿𝗮𝗱𝘂𝗰𝘁𝗶𝗼𝗻 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀 𝘃𝗲𝗿𝘀 ${targetFlag} ${targetName}...`);
        
        const result = await translateText(text, targetLang);
        
        if (result.erreur) {
            await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝘁𝗿𝗮𝗱𝘂𝗰𝘁𝗶𝗼𝗻

${result.erreur}

💡 Tapez "translation" pour voir le guide d'utilisation.
            `.trim());
            return;
        }
        
        const formattedResult = formatTranslationResult(result, text);
        await sendMessage(senderId, formattedResult);
        
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API de traduction :", error.message);
        
        let errorMessage = `
╔══════════════════════════════════════╗
║      ❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗧𝗥𝗔𝗗𝗨𝗖𝗧𝗜𝗢𝗡 ❌      ║
╚══════════════════════════════════════╝

Une erreur s'est produite lors de la traduction.

🔧 𝗦𝗼𝗹𝘂𝘁𝗶𝗼𝗻𝘀 :
• Vérifiez votre connexion internet
• Réessayez dans quelques instants
• Assurez-vous d'utiliser un code de langue valide

💡 Tapez "translation" pour voir le guide complet.
        `.trim();
        
        await sendMessage(senderId, errorMessage);
    }
};

module.exports.info = {
    name: "translation",
    description: "Traduisez instantanément vers 20 langues : FR, EN, MLG, ES, DE, IT, PT, ZH, JA, AR, RU, KO, NL, PL, TR, VI, TH, ID, HI, SW. Détection automatique de la langue source !",
    usage: "Envoyez 'translation' pour le guide complet, ou 'translation <texte>' pour traduire automatiquement, ou 'translation <CODE> <texte>' pour choisir la langue cible."
};
