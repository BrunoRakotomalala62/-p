const axios = require('axios');
const sendMessage = require('../handles/sendMessage');
const wiki = require('wikijs').default;

const userLastSearches = {};

const DECORATIONS = {
    header: '╔══════════════════════════════╗',
    footer: '╚══════════════════════════════╝',
    divider: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    subDivider: '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
    line: '─────────────────────────────',
    bullet: '◆',
    arrow: '➤',
    star: '✦'
};

const LOADING_MESSAGES = [
    "Consultation de l'encyclopédie en cours...",
    "Exploration des connaissances...",
    "Recherche dans Wikipedia...",
    "Accès à la base de données...",
    "Fouille dans les archives du savoir..."
];

const SUCCESS_MESSAGES = [
    "Voici ce que j'ai trouvé pour toi !",
    "Information trouvée avec succès !",
    "Découvre ce savoir passionnant !",
    "L'encyclopédie a parlé !",
    "Résultat de ta recherche !"
];

const ERROR_MESSAGES = [
    "Oups ! Aucun résultat trouvé...",
    "Cette page n'existe pas encore...",
    "Le savoir se cache bien...",
    "Rien trouvé cette fois-ci..."
];

function getRandomMessage(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
}

function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

function formatSummary(summary, maxParagraphs = 3) {
    if (!summary) return '';
    
    const paragraphs = summary.split('\n').filter(p => p.trim().length > 0);
    const selectedParagraphs = paragraphs.slice(0, maxParagraphs);
    
    return selectedParagraphs.join('\n\n');
}

function getLanguageFlag(isEnglish) {
    return isEnglish ? '🇬🇧' : '🇫🇷';
}

function getLanguageName(isEnglish) {
    return isEnglish ? 'English' : 'Français';
}

module.exports = async (senderId, prompt, api) => {
    try {
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, `
📚 𝗪𝗜𝗞𝗜𝗣𝗘𝗗𝗜𝗔 - 𝗚𝗨𝗜𝗗𝗘
${DECORATIONS.header}
L'encyclopédie libre à portée de main !
${DECORATIONS.footer}

🔍 𝗖𝗢𝗠𝗠𝗘𝗡𝗧 𝗨𝗧𝗜𝗟𝗜𝗦𝗘𝗥
${DECORATIONS.divider}

🇫🇷 𝗥𝗲𝗰𝗵𝗲𝗿𝗰𝗵𝗲 𝗲𝗻 𝗳𝗿𝗮𝗻𝗰̧𝗮𝗶𝘀:
${DECORATIONS.arrow} wikipedia Madagascar
${DECORATIONS.arrow} wikipedia Albert Einstein
${DECORATIONS.arrow} wikipedia Intelligence artificielle

🇬🇧 𝗥𝗲𝗰𝗵𝗲𝗿𝗰𝗵𝗲 𝗲𝗻 𝗮𝗻𝗴𝗹𝗮𝗶𝘀:
${DECORATIONS.arrow} wikipedia en Artificial Intelligence
${DECORATIONS.arrow} wikipedia en Madagascar

💡 𝗔𝗦𝗧𝗨𝗖𝗘
${DECORATIONS.subDivider}
Ajoute "en" après wikipedia pour
chercher en anglais !
            `.trim());
            return;
        }

        const loadingMsg = getRandomMessage(LOADING_MESSAGES);
        await sendMessage(senderId, `
🔍 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦
${DECORATIONS.divider}
📖 ${loadingMsg}
⏳ Veuillez patienter...
        `.trim());

        let content = prompt.trim();
        let url = 'https://fr.wikipedia.org/w/api.php';
        let isEnglish = false;
        
        const args = content.split(' ');
        if (args[0].toLowerCase() === 'en') {
            url = 'https://en.wikipedia.org/w/api.php';
            content = args.slice(1).join(' ');
            isEnglish = true;
        }

        if (!content) {
            await sendMessage(senderId, `
❌ 𝗧𝗘𝗥𝗠𝗘 𝗠𝗔𝗡𝗤𝗨𝗔𝗡𝗧
${DECORATIONS.divider}
Veuillez entrer un terme à rechercher.

💡 Exemple: wikipedia Madagascar
            `.trim());
            return;
        }

        userLastSearches[senderId] = content;

        const page = await wiki({ apiUrl: url }).page(content).catch(async () => {
            return null;
        });

        if (!page) {
            const errorMsg = getRandomMessage(ERROR_MESSAGES);
            await sendMessage(senderId, `
😔 𝗔𝗨𝗖𝗨𝗡 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧
${DECORATIONS.header}
${errorMsg}
${DECORATIONS.footer}

🔍 Recherche: "${content}"
${getLanguageFlag(isEnglish)} Langue: ${getLanguageName(isEnglish)}

💡 𝗖𝗢𝗡𝗦𝗘𝗜𝗟𝗦
${DECORATIONS.subDivider}
${DECORATIONS.bullet} Vérifie l'orthographe
${DECORATIONS.bullet} Essaie avec d'autres termes
${DECORATIONS.bullet} Utilise le nom complet

🔄 Exemple: wikipedia France
            `.trim());
            return;
        }

        const summary = await page.summary();
        const pageUrl = await page.url();
        
        let pageImage = null;
        try {
            const images = await page.images();
            if (images && images.length > 0) {
                const validImages = images.filter(img => 
                    !img.includes('svg') && 
                    !img.includes('Commons-logo') &&
                    !img.includes('Wiktionary') &&
                    !img.includes('Wikiquote') &&
                    !img.includes('Portal') &&
                    !img.includes('Edit-clear') &&
                    (img.includes('.jpg') || img.includes('.png') || img.includes('.jpeg'))
                );
                if (validImages.length > 0) {
                    pageImage = validImages[0];
                }
            }
        } catch (imgErr) {
            console.log('Image non disponible:', imgErr.message);
        }

        const successMsg = getRandomMessage(SUCCESS_MESSAGES);
        const formattedSummary = formatSummary(summary, 4);

        await sendMessage(senderId, `
📚 𝗪𝗜𝗞𝗜𝗣𝗘𝗗𝗜𝗔
${DECORATIONS.header}
✨ ${successMsg}
${DECORATIONS.footer}
        `.trim());

        await new Promise(resolve => setTimeout(resolve, 300));

        if (pageImage) {
            try {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: pageImage,
                            is_reusable: true
                        }
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (imgError) {
                console.log('Erreur envoi image Wikipedia:', imgError.message);
            }
        }

        const titleFormatted = content.charAt(0).toUpperCase() + content.slice(1);
        
        await sendMessage(senderId, `
┏━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 📖 ${titleFormatted.toUpperCase()}
┣━━━━━━━━━━━━━━━━━━━━━━━━━
┃ ${getLanguageFlag(isEnglish)} ${getLanguageName(isEnglish)} Wikipedia
┗━━━━━━━━━━━━━━━━━━━━━━━━━
        `.trim());

        await new Promise(resolve => setTimeout(resolve, 200));

        const MAX_LENGTH = 1800;
        
        if (formattedSummary.length <= MAX_LENGTH) {
            await sendMessage(senderId, `
📝 𝗥𝗘́𝗦𝗨𝗠𝗘́
${DECORATIONS.line}

${formattedSummary}
            `.trim());
        } else {
            const parts = [];
            let currentPart = '';
            const sentences = formattedSummary.split('. ');
            
            for (const sentence of sentences) {
                if ((currentPart + sentence).length < MAX_LENGTH - 100) {
                    currentPart += (currentPart ? '. ' : '') + sentence;
                } else {
                    if (currentPart) parts.push(currentPart + '.');
                    currentPart = sentence;
                }
            }
            if (currentPart) parts.push(currentPart);

            for (let i = 0; i < parts.length; i++) {
                const partHeader = i === 0 ? `📝 𝗥𝗘́𝗦𝗨𝗠𝗘́ (${i + 1}/${parts.length})\n${DECORATIONS.line}\n\n` : `📝 𝗦𝗨𝗜𝗧𝗘 (${i + 1}/${parts.length})\n${DECORATIONS.line}\n\n`;
                await sendMessage(senderId, partHeader + parts[i]);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        await sendMessage(senderId, `
🔗 𝗟𝗜𝗘𝗡 𝗦𝗢𝗨𝗥𝗖𝗘
${DECORATIONS.subDivider}
${pageUrl}
        `.trim());

        await new Promise(resolve => setTimeout(resolve, 200));

        await sendMessage(senderId, `
${DECORATIONS.divider}
💡 𝗔𝗨𝗧𝗥𝗘𝗦 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘𝗦
${DECORATIONS.subDivider}
🔄 Tape "wikipedia <terme>" 
pour une nouvelle recherche

${getLanguageFlag(!isEnglish)} Essaie en ${getLanguageName(!isEnglish)} :
wikipedia ${isEnglish ? '' : 'en '}${content}
${DECORATIONS.divider}
✦ 𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗯𝘆 𝗪𝗶𝗸𝗶𝗽𝗲𝗱𝗶𝗮 ✦
        `.trim());

    } catch (error) {
        console.error("Erreur lors de la recherche Wikipedia:", error);
        
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗜𝗡𝗔𝗧𝗧𝗘𝗡𝗗𝗨𝗘
${DECORATIONS.header}
Une erreur s'est produite lors
de la recherche sur Wikipedia.
${DECORATIONS.footer}

💡 𝗖𝗢𝗡𝗦𝗘𝗜𝗟𝗦
${DECORATIONS.subDivider}
${DECORATIONS.bullet} Réessaie dans quelques instants
${DECORATIONS.bullet} Vérifie l'orthographe du terme
${DECORATIONS.bullet} Essaie avec d'autres mots-clés

🔄 Exemple: wikipedia France
        `.trim());
    }
    
    return { skipCommandCheck: true };
};

module.exports.info = {
    name: "wikipedia",
    description: "Recherche des informations sur Wikipedia en français ou en anglais.",
    usage: "Envoyez 'wikipedia <terme>' pour rechercher en français ou 'wikipedia en <terme>' pour rechercher en anglais."
};
