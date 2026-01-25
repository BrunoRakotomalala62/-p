const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE_URL = 'https://calendrier-vraie.vercel.app';

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

function getMoisEmoji(mois) {
    const emojis = {
        'janvier': '❄️', 'février': '💝', 'mars': '🌸',
        'avril': '🌷', 'mai': '🌺', 'juin': '☀️',
        'juillet': '🏖️', 'août': '🌻', 'septembre': '🍂',
        'octobre': '🎃', 'novembre': '🍁', 'décembre': '🎄'
    };
    return emojis[mois.toLowerCase()] || '📅';
}

function getFeteEmoji(nom) {
    const nomLower = nom.toLowerCase();
    if (nomLower.includes('noël')) return '🎄';
    if (nomLower.includes('pâques')) return '🐰';
    if (nomLower.includes('valentin')) return '💕';
    if (nomLower.includes('travail')) return '👷';
    if (nomLower.includes('national') || nomLower.includes('victoire') || nomLower.includes('armistice')) return '🇫🇷';
    if (nomLower.includes('toussaint')) return '🕯️';
    if (nomLower.includes('assomption')) return '⛪';
    if (nomLower.includes('ascension') || nomLower.includes('pentecôte')) return '✝️';
    if (nomLower.includes('épiphanie')) return '👑';
    if (nomLower.includes('sylvestre') || nomLower.includes('an')) return '🎉';
    if (nomLower.includes('mardi gras')) return '🎭';
    return '🎊';
}

function formatCalendrierMensuel(moisData, annee) {
    const moisEmoji = getMoisEmoji(moisData.mois);
    const headerLine = '═'.repeat(28);
    
    let text = '';
    text += `╔${headerLine}╗\n`;
    text += `║ ${moisEmoji} ${moisData.mois.toUpperCase()} ${annee} ${moisEmoji}\n`;
    text += `╚${headerLine}╝\n\n`;
    
    text += `┌────┬────┬────┬────┬────┐\n`;
    text += `│ Lu │ Ma │ Me │ Je │ Ve │\n`;
    text += `├────┼────┼────┼────┼────┤\n`;
    
    moisData.semaines.forEach((semaine, index) => {
        const lu = semaine.Lundi ? String(semaine.Lundi).padStart(2, ' ') : '  ';
        const ma = semaine.Mardi ? String(semaine.Mardi).padStart(2, ' ') : '  ';
        const me = semaine.Mercredi ? String(semaine.Mercredi).padStart(2, ' ') : '  ';
        const je = semaine.Jeudi ? String(semaine.Jeudi).padStart(2, ' ') : '  ';
        const ve = semaine.Vendredi ? String(semaine.Vendredi).padStart(2, ' ') : '  ';
        
        text += `│ ${lu} │ ${ma} │ ${me} │ ${je} │ ${ve} │\n`;
        
        if (index < moisData.semaines.length - 1) {
            text += `├────┼────┼────┼────┼────┤\n`;
        }
    });
    
    text += `└────┴────┴────┴────┴────┘\n`;
    
    return text;
}

function formatJoursFeries(joursFeries, annee) {
    const headerLine = '═'.repeat(30);
    
    let text = '';
    text += `╔${headerLine}╗\n`;
    text += `║  🎉 𝐉𝐎𝐔𝐑𝐒 𝐅É𝐑𝐈É𝐒 ${annee} 🎉  ║\n`;
    text += `╠${headerLine}╣\n`;
    text += `║  📊 Total: ${joursFeries.length} jours fériés  ║\n`;
    text += `╚${headerLine}╝\n\n`;
    
    const moisGroupes = {};
    joursFeries.forEach(jour => {
        const match = jour.date.match(/(\d+)\s+(\w+)\s+(\d+)/);
        if (match) {
            const mois = match[2];
            if (!moisGroupes[mois]) {
                moisGroupes[mois] = [];
            }
            moisGroupes[mois].push(jour);
        }
    });
    
    for (const [mois, jours] of Object.entries(moisGroupes)) {
        const moisEmoji = getMoisEmoji(mois);
        text += `┏━━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
        text += `┃ ${moisEmoji} ${mois.toUpperCase()}\n`;
        text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━┛\n`;
        
        jours.forEach(jour => {
            const feteEmoji = getFeteEmoji(jour.nom);
            const dateMatch = jour.date.match(/(\d+)/);
            const dateNum = dateMatch ? dateMatch[1] : '';
            text += `   ${feteEmoji} ${dateNum} - ${jour.nom}\n`;
            text += `      📆 ${jour.jour}\n`;
        });
        text += '\n';
    }
    
    return text;
}

function formatCalendrierComplet(data) {
    const headerLine = '═'.repeat(32);
    
    let text = '';
    text += `╔${headerLine}╗\n`;
    text += `║  📅 𝐂𝐀𝐋𝐄𝐍𝐃𝐑𝐈𝐄𝐑 ${data.annee} 📅  ║\n`;
    text += `╚${headerLine}╝\n\n`;
    
    return text;
}

async function sendChunkedMessages(senderId, message, delayMs = 1500) {
    const chunks = splitMessageIntoChunks(message);
    
    for (let i = 0; i < chunks.length; i++) {
        let chunkToSend = chunks[i];
        
        if (chunks.length > 1) {
            chunkToSend = `📄 [${i + 1}/${chunks.length}]\n\n${chunkToSend}`;
        }
        
        await sendMessage(senderId, chunkToSend);
        
        if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

module.exports = async (senderId, args) => {
    try {
        const input = args ? args.trim().toLowerCase() : '';
        const currentYear = new Date().getFullYear();
        
        let annee = currentYear;
        let mode = 'complet';
        
        const yearMatch = input.match(/\d{4}/);
        if (yearMatch) {
            annee = parseInt(yearMatch[0]);
        }
        
        if (input.includes('ferie') || input.includes('férié') || input.includes('fete') || input.includes('fête')) {
            mode = 'feries';
        } else if (input.includes('mois')) {
            mode = 'mensuel';
            const moisNoms = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                             'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
            for (const mois of moisNoms) {
                if (input.includes(mois)) {
                    mode = 'mois_specifique';
                    annee = yearMatch ? parseInt(yearMatch[0]) : currentYear;
                    break;
                }
            }
        }
        
        if (!args || args.trim() === '' || input === 'help' || input === 'aide') {
            const helpMessage = `
╔══════════════════════════════╗
║  📅 𝐀𝐈𝐃𝐄 - Calendrier  📅   ║
╠══════════════════════════════╣
║                              ║
║  📝 𝐔𝐬𝐚𝐠𝐞:                   ║
║                              ║
║  🔹 calendrier 2025          ║
║     → Calendrier complet     ║
║                              ║
║  🔹 calendrier fériés 2025   ║
║     → Jours fériés           ║
║                              ║
║  🔹 calendrier               ║
║     → Année en cours         ║
║                              ║
╚══════════════════════════════╝`;
            await sendMessage(senderId, helpMessage);
            return;
        }
        
        const loadingMessages = [
            `📅 Préparation du calendrier ${annee}...`,
            `🔄 Chargement des données ${annee}...`,
            `⏳ Un instant, je consulte le calendrier ${annee}...`
        ];
        const randomLoading = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
        await sendMessage(senderId, randomLoading);
        
        if (mode === 'feries') {
            const response = await axios.get(`${API_BASE_URL}/recherche?calendrier=${annee}`, { timeout: 15000 });
            
            if (!response.data.success) {
                throw new Error('Erreur API');
            }
            
            const formattedMessage = formatJoursFeries(response.data.joursFeries, annee);
            await sendChunkedMessages(senderId, formattedMessage);
            
        } else {
            const response = await axios.get(`${API_BASE_URL}/calendriers/${annee}`, { timeout: 15000 });
            
            if (!response.data.success) {
                throw new Error('Erreur API');
            }
            
            const headerText = formatCalendrierComplet(response.data);
            await sendMessage(senderId, headerText);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const moisOrdre = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                              'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
            
            let calendriersBatch = '';
            let batchCount = 0;
            
            for (let i = 0; i < moisOrdre.length; i++) {
                const moisNom = moisOrdre[i];
                const moisData = response.data.calendriers[moisNom];
                
                if (moisData) {
                    const moisFormatted = formatCalendrierMensuel(moisData, annee);
                    
                    if ((calendriersBatch + moisFormatted).length > 1800) {
                        if (calendriersBatch) {
                            await sendChunkedMessages(senderId, calendriersBatch, 1000);
                            await new Promise(resolve => setTimeout(resolve, 1500));
                        }
                        calendriersBatch = moisFormatted;
                    } else {
                        calendriersBatch += moisFormatted + '\n';
                    }
                    batchCount++;
                    
                    if (batchCount % 3 === 0 && calendriersBatch) {
                        await sendChunkedMessages(senderId, calendriersBatch, 1000);
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        calendriersBatch = '';
                    }
                }
            }
            
            if (calendriersBatch) {
                await sendChunkedMessages(senderId, calendriersBatch, 1000);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            if (response.data.joursFeries && response.data.joursFeries.liste) {
                const feriesText = formatJoursFeries(response.data.joursFeries.liste, annee);
                await sendChunkedMessages(senderId, feriesText);
            }
            
            const footerText = `
╔══════════════════════════════╗
║  ✨ Calendrier ${annee} complet ✨ ║
║     💫 Bonne planification! 💫   ║
╚══════════════════════════════╝`;
            await sendMessage(senderId, footerText);
        }
        
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API calendrier:", error);
        
        const errorMessage = `
╔════════════════════════════╗
║  ❌ 𝐄𝐑𝐑𝐄𝐔𝐑               ║
╠════════════════════════════╣
║                            ║
║  Impossible de récupérer   ║
║  le calendrier demandé.    ║
║                            ║
║  💡 Conseils:              ║
║  • Vérifiez l'année        ║
║  • Réessayez plus tard     ║
║                            ║
╚════════════════════════════╝`;
        
        await sendMessage(senderId, errorMessage);
    }
};

module.exports.info = {
    name: "calendrier",
    description: "Affiche le calendrier complet avec les jours fériés pour une année donnée, avec un format élégant et dynamique.",
    usage: "Envoyez 'calendrier <année>' pour le calendrier complet, ou 'calendrier fériés <année>' pour les jours fériés uniquement."
};
