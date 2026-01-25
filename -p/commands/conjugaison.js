const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

function splitMessageIntoChunks(message, maxLength = 2000) {
    const chunks = [];
    let startIndex = 0;
    
    while (startIndex < message.length) {
        let endIndex = startIndex + maxLength;
        
        if (endIndex < message.length) {
            const separators = ['\n\n', '\n', '. ', ', ', ' • ', '• ', ' : ', ' - ', ' ', '/', ')', ']'];
            let bestBreakPoint = -1;
            
            for (const separator of separators) {
                const lastSeparator = message.lastIndexOf(separator, endIndex);
                if (lastSeparator > startIndex && (bestBreakPoint === -1 || lastSeparator > bestBreakPoint)) {
                    bestBreakPoint = lastSeparator + (separator === '\n' || separator === '\n\n' ? 1 : separator.length);
                }
            }
            
            if (bestBreakPoint !== -1) {
                endIndex = bestBreakPoint;
            }
        } else {
            endIndex = message.length;
        }
        
        const messagePart = message.substring(startIndex, endIndex);
        chunks.push(messagePart);
        startIndex = endIndex;
    }
    
    return chunks;
}

function getModeEmoji(modeName) {
    const modeEmojis = {
        'indicatif': '📖',
        'conditionnel': '🎭',
        'subjonctif': '💭',
        'impératif': '📣',
        'participe': '📝',
        'infinitif': '🔤'
    };
    const lowerMode = modeName.toLowerCase();
    for (const [key, emoji] of Object.entries(modeEmojis)) {
        if (lowerMode.includes(key)) return emoji;
    }
    return '📌';
}

function getTempsEmoji(tempsName) {
    const tempsEmojis = {
        'présent': '⚡',
        'passé composé': '✨',
        'passé simple': '📜',
        'passé': '⌛',
        'imparfait': '🌅',
        'plus-que-parfait': '🏛️',
        'futur simple': '🔮',
        'futur antérieur': '🌟',
        'futur': '🚀'
    };
    const lowerTemps = tempsName.toLowerCase();
    for (const [key, emoji] of Object.entries(tempsEmojis)) {
        if (lowerTemps.includes(key)) return emoji;
    }
    return '⏰';
}

function formatConjugaison(verbe, conjugaisonData) {
    const rawText = conjugaisonData.replace(/\n+/g, '\n').trim();
    
    const headerLine = '═'.repeat(25);
    const subLine = '─'.repeat(20);
    
    let formattedText = '';
    formattedText += `╔${headerLine}╗\n`;
    formattedText += `║  🔠 𝐂𝐎𝐍𝐉𝐔𝐆𝐀𝐈𝐒𝐎𝐍  🔠  ║\n`;
    formattedText += `╠${headerLine}╣\n`;
    formattedText += `║   ✦ ${verbe.toUpperCase()} ✦   \n`;
    formattedText += `╚${headerLine}╝\n\n`;
    
    const sections = rawText.split(/❤️/g);
    
    let fullInfo = (sections[0] || '') + ' ' + (sections[1] || '');
    fullInfo = fullInfo.replace(/✅[^\n]*\n?/g, '').replace(/\s+/g, ' ').trim();
    
    if (fullInfo) {
        formattedText += `┌${subLine}┐\n`;
        formattedText += `│ 📚 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐓𝐈𝐎𝐍𝐒 │\n`;
        formattedText += `└${subLine}┘\n`;
        
        let groupe = '';
        let auxiliaire = '';
        
        const groupeMatch = fullInfo.match(/(\d+)e[r]?\s*groupe/i);
        if (groupeMatch) {
            groupe = groupeMatch[1] + (groupeMatch[1] === '1' ? 'er' : 'ème') + ' groupe';
        }
        
        if (fullInfo.toLowerCase().includes('avoir') && fullInfo.toLowerCase().includes('être')) {
            auxiliaire = 'avoir ou être';
        } else if (fullInfo.toLowerCase().includes('avoir')) {
            auxiliaire = 'avoir';
        } else if (fullInfo.toLowerCase().includes('être')) {
            auxiliaire = 'être';
        }
        
        if (groupe) {
            formattedText += `   📌 Groupe: ${groupe}\n`;
        }
        if (auxiliaire) {
            formattedText += `   🔗 Auxiliaire: ${auxiliaire}\n`;
        }
        formattedText += '\n';
    }
    
    const validModes = ['indicatif', 'conditionnel', 'subjonctif', 'impératif', 'participe', 'infinitif'];
    
    for (let i = 1; i < sections.length; i++) {
        if (sections[i] && sections[i].trim()) {
            const [modeName, ...tempsContent] = sections[i].split(/👉/g);
            const cleanModeName = modeName.trim();
            
            if (!cleanModeName) continue;
            
            const isValidMode = validModes.some(mode => cleanModeName.toLowerCase().includes(mode));
            if (!isValidMode) continue;
            
            const modeEmoji = getModeEmoji(cleanModeName);
            
            formattedText += `\n┏━━━━━━━━━━━━━━━━━━━━━┓\n`;
            formattedText += `┃ ${modeEmoji} 𝐌𝐎𝐃𝐄: ${cleanModeName.toUpperCase()} ${modeEmoji}\n`;
            formattedText += `┗━━━━━━━━━━━━━━━━━━━━━┛\n`;
            
            tempsContent.forEach(temps => {
                if (temps && temps.trim()) {
                    const lines = temps.split('\n').filter(l => l.trim());
                    if (lines.length === 0) return;
                    
                    const tempsName = lines[0].trim();
                    const conjugaisons = lines.slice(1);
                    
                    const tempsEmoji = getTempsEmoji(tempsName);
                    
                    formattedText += `\n   ${tempsEmoji} 【${tempsName}】\n`;
                    formattedText += `   ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;
                    
                    conjugaisons.forEach((conj, index) => {
                        const trimmedConj = conj.trim();
                        if (trimmedConj) {
                            const personEmojis = ['🔹', '🔸', '🔹', '🔸', '🔹', '🔸'];
                            const emoji = personEmojis[index % personEmojis.length];
                            formattedText += `      ${emoji} ${trimmedConj}\n`;
                        }
                    });
                }
            });
        }
    }
    
    formattedText += `\n╔${'═'.repeat(30)}╗\n`;
    formattedText += `║  ✨ Conjugaison de "${verbe}" ✨  ║\n`;
    formattedText += `║     💫 Bonne étude! 💫      ║\n`;
    formattedText += `╚${'═'.repeat(30)}╝`;
    
    return formattedText;
}

module.exports = async (senderId, verbe) => {
    if (!verbe || verbe.trim() === '') {
        const helpMessage = `
╔════════════════════════╗
║  ⚠️ 𝐀𝐈𝐃𝐄 - Conjugaison  ║
╠════════════════════════╣
║                        ║
║  📝 Usage:             ║
║  conjugaison <verbe>   ║
║                        ║
║  📌 Exemple:           ║
║  conjugaison manger    ║
║  conjugaison être      ║
║  conjugaison avoir     ║
║                        ║
╚════════════════════════╝`;
        await sendMessage(senderId, helpMessage);
        return;
    }
    
    try {
        const loadingMessages = [
            `🔍 Recherche de la conjugaison de "${verbe.trim()}"...`,
            `📚 Analyse du verbe en cours...`,
            `⏳ Préparation des résultats...`
        ];
        const randomLoading = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
        await sendMessage(senderId, randomLoading);

        const apiUrl = `https://conjugaison-finale.vercel.app/conjugaison?verbe=${encodeURIComponent(verbe.trim())}`;
        const response = await axios.get(apiUrl, { timeout: 15000 });

        if (!response.data || !response.data.response) {
            throw new Error('Réponse API invalide');
        }

        const conjugaison = response.data.response;
        const formattedResponse = formatConjugaison(verbe.trim(), conjugaison);
        const messageChunks = splitMessageIntoChunks(formattedResponse);

        for (let i = 0; i < messageChunks.length; i++) {
            if (messageChunks.length > 1) {
                const partIndicator = `📄 Partie ${i + 1}/${messageChunks.length}\n\n`;
                await sendMessage(senderId, partIndicator + messageChunks[i]);
            } else {
                await sendMessage(senderId, messageChunks[i]);
            }
            
            if (i < messageChunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API de conjugaison:', error);

        let errorMessage = `
╔════════════════════════════╗
║  ❌ 𝐄𝐑𝐑𝐄𝐔𝐑               ║
╠════════════════════════════╣
║                            ║
║  Impossible de trouver     ║
║  la conjugaison de:        ║
║  "${verbe}"                ║
║                            ║
║  💡 Conseils:              ║
║  • Vérifiez l'orthographe  ║
║  • Utilisez l'infinitif    ║
║  • Réessayez plus tard     ║
║                            ║
╚════════════════════════════╝`;
        
        await sendMessage(senderId, errorMessage);
    }
};

module.exports.info = {
    name: "conjugaison",
    description: "Permet d'obtenir la conjugaison complète d'un verbe français avec une présentation élégante et structurée.",
    usage: "Envoyez 'conjugaison <verbe>' pour obtenir la conjugaison complète du verbe. Exemple: conjugaison manger"
};
