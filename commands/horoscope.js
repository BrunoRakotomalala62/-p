const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE_URL = 'https://horoscope-20minute-a-jour.vercel.app';

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

const formatHoroscopeResponse = (data, signKey) => {
    const signInfo = signDetails[signKey.toLowerCase()];
    const today = new Date();
    const dateStr = today.toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    let response = '';
    
    response += `✨🔮 𝗛𝗢𝗥𝗢𝗦𝗖𝗢𝗣𝗘 𝗗𝗨 𝗝𝗢𝗨𝗥 🔮✨\n`;
    response += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    response += `${signInfo.emoji} 𝗦𝗶𝗴𝗻𝗲: ${data.signe.toUpperCase()} ${signInfo.emoji}\n`;
    response += `📅 ${dateStr}\n`;
    response += `📆 Période: ${signInfo.dates}\n`;
    response += `${signInfo.element}\n\n`;
    
    response += `🇫🇷 ═══ 𝗙𝗥𝗔𝗡𝗖̧𝗔𝗜𝗦 ═══ 🇫🇷\n\n`;
    
    if (data.francais && data.francais.sections) {
        const sections = data.francais.sections;
        
        if (sections.Amour) {
            response += `${sectionEmojis['Amour']} 𝗔𝗺𝗼𝘂𝗿:\n${sections.Amour}\n\n`;
        }
        if (sections['Argent et travail']) {
            response += `${sectionEmojis['Argent et travail']} 𝗔𝗿𝗴𝗲𝗻𝘁 𝗲𝘁 𝘁𝗿𝗮𝘃𝗮𝗶𝗹:\n${sections['Argent et travail']}\n\n`;
        }
        if (sections.Santé) {
            response += `${sectionEmojis['Santé']} 𝗦𝗮𝗻𝘁𝗲́:\n${sections.Santé}\n\n`;
        }
        if (sections.Humeur) {
            response += `${sectionEmojis['Humeur']} 𝗛𝘂𝗺𝗲𝘂𝗿:\n${sections.Humeur}\n\n`;
        }
        if (sections.Conseil) {
            response += `${sectionEmojis['Conseil']} 𝗖𝗼𝗻𝘀𝗲𝗶𝗹:\n${sections.Conseil}\n\n`;
        }
    }
    
    response += `━━━━━━━━━━━━━━━━━━━━\n`;
    response += `🇲🇬 ═══ 𝗠𝗔𝗟𝗔𝗚𝗔𝗦𝗬 ═══ 🇲🇬\n\n`;
    
    if (data.malagasy && data.malagasy.sections) {
        const sections = data.malagasy.sections;
        
        if (sections.Fitiavana) {
            response += `${sectionEmojisMalagasy['Fitiavana']} 𝗙𝗶𝘁𝗶𝗮𝘃𝗮𝗻𝗮:\n${sections.Fitiavana}\n\n`;
        }
        if (sections['Vola sy asa']) {
            response += `${sectionEmojisMalagasy['Vola sy asa']} 𝗩𝗼𝗹𝗮 𝘀𝘆 𝗮𝘀𝗮:\n${sections['Vola sy asa']}\n\n`;
        }
        if (sections.Fahasalamana) {
            response += `${sectionEmojisMalagasy['Fahasalamana']} 𝗙𝗮𝗵𝗮𝘀𝗮𝗹𝗮𝗺𝗮𝗻𝗮:\n${sections.Fahasalamana}\n\n`;
        }
        if (sections['Toe-tsaina']) {
            response += `${sectionEmojisMalagasy['Toe-tsaina']} 𝗧𝗼𝗲-𝘁𝘀𝗮𝗶𝗻𝗮:\n${sections['Toe-tsaina']}\n\n`;
        }
        if (sections.Torohevitra) {
            response += `${sectionEmojisMalagasy['Torohevitra']} 𝗧𝗼𝗿𝗼𝗵𝗲𝘃𝗶𝘁𝗿𝗮:\n${sections.Torohevitra}\n\n`;
        }
    }
    
    response += `━━━━━━━━━━━━━━━━━━━━\n`;
    response += `🌟 Bonne journée ! 🌟\n`;
    response += `✨ Source: 20 Minutes ✨`;
    
    return response;
};

const formatSignList = () => {
    let response = '';
    
    response += `✨🔮 𝗟𝗜𝗦𝗧𝗘 𝗗𝗘𝗦 𝗦𝗜𝗚𝗡𝗘𝗦 🔮✨\n`;
    response += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    response += `📜 Choisissez votre signe:\n\n`;
    
    for (const sign in signDetails) {
        const info = signDetails[sign];
        const capitalizedSign = sign.charAt(0).toUpperCase() + sign.slice(1);
        response += `${info.emoji} ${capitalizedSign}\n`;
        response += `   📅 ${info.dates}\n`;
        response += `   ${info.element}\n\n`;
    }
    
    response += `━━━━━━━━━━━━━━━━━━━━\n`;
    response += `💡 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻:\n`;
    response += `Tapez: horoscope <signe>\n`;
    response += `Exemple: horoscope lion`;
    
    return response;
};

module.exports = async (senderId, message) => {
    try {
        const userMessage = message.trim().toLowerCase();

        if (userMessage === 'horoscope') {
            const signList = formatSignList();
            await sendMessage(senderId, signList);
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
            const formattedResponse = formatHoroscopeResponse(response.data, signKey);
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await sendMessage(senderId, formattedResponse);
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
