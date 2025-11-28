const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE_URL = 'https://horoscope-20minute-a-jour.vercel.app';
const MAX_MESSAGE_LENGTH = 1900;
const MESSAGE_DELAY = 600;

const signDetails = {
    'bélier': { emoji: '♈', dates: '21 mars - 19 avril', element: '🔥 Feu' },
    'taureau': { emoji: '♉', dates: '20 avril - 20 mai', element: '🌍 Terre' },
    'gémeaux': { emoji: '♊', dates: '21 mai - 20 juin', element: '💨 Air' },
    'cancer': { emoji: '♋', dates: '21 juin - 22 juillet', element: '💧 Eau' },
    'lion': { emoji: '♌', dates: '23 juillet - 22 août', element: '🔥 Feu' },
    'vierge': { emoji: '♍', dates: '23 août - 22 septembre', element: '🌍 Terre' },
    'balance': { emoji: '♎', dates: '23 septembre - 22 octobre', element: '💨 Air' },
    'scorpion': { emoji: '♏', dates: '23 octobre - 21 novembre', element: '💧 Eau' },
    'sagittaire': { emoji: '♐', dates: '22 novembre - 21 décembre', element: '🔥 Feu' },
    'capricorne': { emoji: '♑', dates: '22 décembre - 19 janvier', element: '🌍 Terre' },
    'verseau': { emoji: '♒', dates: '20 janvier - 18 février', element: '💨 Air' },
    'poissons': { emoji: '♓', dates: '19 février - 20 mars', element: '💧 Eau' }
};

const sectionEmojis = {
    'Amour': '💕',
    'Argent et travail': '💼',
    'Santé': '🏥',
    'Humeur': '😊',
    'Conseil': '💡'
};

const sectionEmojisMalagasy = {
    'Fitiavana': '💕',
    'Vola sy asa': '💼',
    'Fahasalamana': '🏥',
    'Toe-tsaina': '😊',
    'Torohevitra': '💡'
};

const normalizeString = (str) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

const findSign = (input) => {
    const normalizedInput = normalizeString(input);
    for (const sign in signDetails) {
        if (normalizeString(sign) === normalizedInput) {
            return sign;
        }
    }
    return null;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const splitTextSmart = (text, maxLength) => {
    if (text.length <= maxLength) {
        return [text];
    }

    const chunks = [];
    let remainingText = text;

    while (remainingText.length > 0) {
        if (remainingText.length <= maxLength) {
            chunks.push(remainingText);
            break;
        }

        let splitIndex = remainingText.lastIndexOf('. ', maxLength);
        
        if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
            splitIndex = remainingText.lastIndexOf('\n', maxLength);
        }
        
        if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
            splitIndex = remainingText.lastIndexOf(' ', maxLength);
        }

        if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
            splitIndex = maxLength;
        }

        const chunk = remainingText.substring(0, splitIndex + 1).trim();
        chunks.push(chunk);
        remainingText = remainingText.substring(splitIndex + 1).trim();
    }

    return chunks;
};

const chunkMessages = (sections, maxLength = MAX_MESSAGE_LENGTH) => {
    const chunks = [];
    let currentChunk = '';

    for (const section of sections) {
        if (section.length > maxLength) {
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            const splitParts = splitTextSmart(section, maxLength);
            chunks.push(...splitParts);
        } else if ((currentChunk + section).length > maxLength) {
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = section;
        } else {
            currentChunk += section;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
};

const buildHoroscopeSections = (data, signKey) => {
    const signInfo = signDetails[signKey.toLowerCase()];
    const today = new Date();
    const dateStr = today.toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    const sections = [];
    
    let header = '';
    header += `✨🔮 𝗛𝗢𝗥𝗢𝗦𝗖𝗢𝗣𝗘 𝗗𝗨 𝗝𝗢𝗨𝗥 🔮✨\n`;
    header += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    header += `${signInfo.emoji} 𝗦𝗶𝗴𝗻𝗲: ${data.signe.toUpperCase()} ${signInfo.emoji}\n`;
    header += `📅 ${dateStr}\n`;
    header += `📆 Période: ${signInfo.dates}\n`;
    header += `${signInfo.element}\n`;
    sections.push(header);

    let frenchHeader = `\n🇫🇷 ═══ 𝗙𝗥𝗔𝗡𝗖̧𝗔𝗜𝗦 ═══ 🇫🇷\n`;
    sections.push(frenchHeader);

    if (data.francais && data.francais.sections) {
        const frSections = data.francais.sections;
        
        if (frSections.Amour) {
            sections.push(`\n${sectionEmojis['Amour']} 𝗔𝗺𝗼𝘂𝗿:\n${frSections.Amour}\n`);
        }
        if (frSections['Argent et travail']) {
            sections.push(`\n${sectionEmojis['Argent et travail']} 𝗔𝗿𝗴𝗲𝗻𝘁 𝗲𝘁 𝘁𝗿𝗮𝘃𝗮𝗶𝗹:\n${frSections['Argent et travail']}\n`);
        }
        if (frSections.Santé) {
            sections.push(`\n${sectionEmojis['Santé']} 𝗦𝗮𝗻𝘁𝗲́:\n${frSections.Santé}\n`);
        }
        if (frSections.Humeur) {
            sections.push(`\n${sectionEmojis['Humeur']} 𝗛𝘂𝗺𝗲𝘂𝗿:\n${frSections.Humeur}\n`);
        }
        if (frSections.Conseil) {
            sections.push(`\n${sectionEmojis['Conseil']} 𝗖𝗼𝗻𝘀𝗲𝗶𝗹:\n${frSections.Conseil}\n`);
        }
    }

    let separator = `\n━━━━━━━━━━━━━━━━━━━━\n`;
    separator += `🇲🇬 ═══ 𝗠𝗔𝗟𝗔𝗚𝗔𝗦𝗬 ═══ 🇲🇬\n`;
    sections.push(separator);

    if (data.malagasy && data.malagasy.sections) {
        const mgSections = data.malagasy.sections;
        
        if (mgSections.Fitiavana) {
            sections.push(`\n${sectionEmojisMalagasy['Fitiavana']} 𝗙𝗶𝘁𝗶𝗮𝘃𝗮𝗻𝗮:\n${mgSections.Fitiavana}\n`);
        }
        if (mgSections['Vola sy asa']) {
            sections.push(`\n${sectionEmojisMalagasy['Vola sy asa']} 𝗩𝗼𝗹𝗮 𝘀𝘆 𝗮𝘀𝗮:\n${mgSections['Vola sy asa']}\n`);
        }
        if (mgSections.Fahasalamana) {
            sections.push(`\n${sectionEmojisMalagasy['Fahasalamana']} 𝗙𝗮𝗵𝗮𝘀𝗮𝗹𝗮𝗺𝗮𝗻𝗮:\n${mgSections.Fahasalamana}\n`);
        }
        if (mgSections['Toe-tsaina']) {
            sections.push(`\n${sectionEmojisMalagasy['Toe-tsaina']} 𝗧𝗼𝗲-𝘁𝘀𝗮𝗶𝗻𝗮:\n${mgSections['Toe-tsaina']}\n`);
        }
        if (mgSections.Torohevitra) {
            sections.push(`\n${sectionEmojisMalagasy['Torohevitra']} 𝗧𝗼𝗿𝗼𝗵𝗲𝘃𝗶𝘁𝗿𝗮:\n${mgSections.Torohevitra}\n`);
        }
    }

    let footer = `\n━━━━━━━━━━━━━━━━━━━━\n`;
    footer += `🌟 Bonne journée ! 🌟\n`;
    footer += `✨ Source: 20 Minutes ✨`;
    sections.push(footer);

    return sections;
};

const formatSignList = () => {
    const sections = [];
    
    let header = '';
    header += `✨🔮 𝗟𝗜𝗦𝗧𝗘 𝗗𝗘𝗦 𝗦𝗜𝗚𝗡𝗘𝗦 🔮✨\n`;
    header += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    header += `📜 Choisissez votre signe:\n\n`;
    sections.push(header);
    
    let signList = '';
    for (const sign in signDetails) {
        const info = signDetails[sign];
        const capitalizedSign = sign.charAt(0).toUpperCase() + sign.slice(1);
        signList += `${info.emoji} ${capitalizedSign}\n`;
        signList += `   📅 ${info.dates}\n`;
        signList += `   ${info.element}\n\n`;
    }
    sections.push(signList);
    
    let footer = `━━━━━━━━━━━━━━━━━━━━\n`;
    footer += `💡 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻:\n`;
    footer += `Tapez: horoscope <signe>\n`;
    footer += `Exemple: horoscope lion`;
    sections.push(footer);
    
    return sections;
};

const sendChunkedMessages = async (senderId, sections) => {
    const chunks = chunkMessages(sections);
    const totalChunks = chunks.length;
    
    for (let i = 0; i < chunks.length; i++) {
        let messageToSend = chunks[i];
        
        if (totalChunks > 1 && i < totalChunks - 1) {
            messageToSend += `\n\n⏳ (${i + 1}/${totalChunks})`;
        } else if (totalChunks > 1) {
            messageToSend += `\n\n✅ (${i + 1}/${totalChunks})`;
        }
        
        await sendMessage(senderId, messageToSend);
        
        if (i < chunks.length - 1) {
            await delay(MESSAGE_DELAY);
        }
    }
};

module.exports = async (senderId, message) => {
    try {
        const userMessage = message.trim().toLowerCase();

        if (userMessage === 'horoscope') {
            const signSections = formatSignList();
            await sendChunkedMessages(senderId, signSections);
            return;
        }

        const parts = userMessage.split(' ');
        if (parts.length < 2) {
            await sendMessage(senderId, "⚠️ Veuillez spécifier un signe.\n\n💡 Exemple: horoscope lion\n\nTapez 'horoscope' pour voir la liste des signes.");
            return;
        }

        const signInput = parts.slice(1).join(' ');
        const signKey = findSign(signInput);

        if (!signKey) {
            await sendMessage(senderId, `❌ Signe "${signInput}" non reconnu.\n\n💡 Tapez 'horoscope' pour voir la liste des signes disponibles.`);
            return;
        }

        const signInfo = signDetails[signKey];
        const capitalizedSign = signKey.charAt(0).toUpperCase() + signKey.slice(1);
        
        await sendMessage(senderId, `${signInfo.emoji} 𝗖𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁...\n\n🔮 Préparation de l'horoscope pour ${capitalizedSign}...\n⏳ Veuillez patienter...`);

        const apiUrl = `${API_BASE_URL}/recherche?titre=${encodeURIComponent(capitalizedSign)}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });

        if (response.data && response.data.success) {
            const horoscopeSections = buildHoroscopeSections(response.data, signKey);
            
            await delay(800);
            
            await sendChunkedMessages(senderId, horoscopeSections);
        } else {
            await sendMessage(senderId, `❌ Erreur: ${response.data.error || "Impossible de récupérer l'horoscope."}`);
        }

    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Horoscope:', error);
        
        let errorMessage = "❌ 𝗘𝗿𝗿𝗲𝘂𝗿\n\n";
        errorMessage += "Désolé, une erreur s'est produite lors de l'obtention de votre horoscope.\n\n";
        errorMessage += "💡 Veuillez réessayer dans quelques instants.";
        
        await sendMessage(senderId, errorMessage);
    }
};

module.exports.info = {
    name: "horoscope",
    description: "Obtenez votre horoscope du jour en français et en malgache selon votre signe astrologique.",
    usage: "Envoyez 'horoscope' pour voir la liste des signes ou 'horoscope <signe>' pour obtenir l'horoscope (par exemple : horoscope lion)."
};
