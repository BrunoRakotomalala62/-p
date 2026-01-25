const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const userDictionaryRequests = {};

module.exports = async (senderId, userText) => {
    try {
        const wordToLookup = userText.trim().toLowerCase(); 

        if (!wordToLookup) {
            await sendMessage(senderId, "✨ Veuillez fournir un mot à rechercher dans le dictionnaire français.");
            return;
        }

        const apiUrl = `https://dictionnaire-francais-francais-kappa.vercel.app/recherche?dico=${encodeURIComponent(wordToLookup)}`;
        const response = await axios.get(apiUrl);

        if (response.data && response.data.word) {
            const data = response.data;
            
            let message = "";
            
            message += "╭━━━━━━━━━━━━━━━━━━━━━━━╮\n";
            message += "┃  📖 𝗗𝗜𝗖𝗧𝗜𝗢𝗡𝗡𝗔𝗜𝗥𝗘 𝗙𝗥𝗔𝗡𝗖̧𝗔𝗜𝗦  ┃\n";
            message += "╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\n";
            
            message += `🔮 𝗠𝗼𝘁 : ${data.word.toUpperCase()}\n`;
            message += "─────────────────────\n\n";
            
            if (data.type) {
                message += `🏷️ 𝗧𝘆𝗽𝗲 : ${data.type}\n\n`;
            }
            
            if (data.definitions && data.definitions.length > 0) {
                message += "📚 𝗗𝗲́𝗳𝗶𝗻𝗶𝘁𝗶𝗼𝗻𝘀 :\n";
                message += "┌─────────────────────┐\n";
                data.definitions.forEach((def) => {
                    message += `│ ${def.number}. ${def.text}\n`;
                });
                message += "└─────────────────────┘\n\n";
            }
            
            if (data.examples && data.examples.length > 0) {
                message += "💬 𝗘𝘅𝗲𝗺𝗽𝗹𝗲𝘀 :\n";
                message += "┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐\n";
                data.examples.forEach((example, index) => {
                    const cleanExample = example.replace(/\u00a0/g, ' ').replace(/\u200b/g, '').trim();
                    if (cleanExample.length > 0 && cleanExample.length < 100) {
                        message += `  ➤ « ${cleanExample} »\n`;
                    }
                });
                message += "└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘\n\n";
            }
            
            if (data.synonyms && data.synonyms.length > 0) {
                message += "🔗 𝗦𝘆𝗻𝗼𝗻𝘆𝗺𝗲𝘀 :\n";
                message += "✦ " + data.synonyms.join(" • ") + " ✦\n\n";
            }
            
            message += "═══════════════════════\n";
            message += "      🌟 𝘽𝙤𝙣𝙣𝙚 𝙡𝙚𝙘𝙩𝙪𝙧𝙚 ! 🌟\n";
            message += "═══════════════════════";

            await sendMessage(senderId, message);
        } else {
            let errorMessage = "╭━━━━━━━━━━━━━━━━━━━━━━━╮\n";
            errorMessage += "┃  📖 𝗗𝗜𝗖𝗧𝗜𝗢𝗡𝗡𝗔𝗜𝗥𝗘 𝗙𝗥𝗔𝗡𝗖̧𝗔𝗜𝗦  ┃\n";
            errorMessage += "╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\n";
            errorMessage += "❌ Désolé, le mot recherché n'a pas été trouvé dans le dictionnaire.\n\n";
            errorMessage += "💡 Conseil : Vérifiez l'orthographe du mot et réessayez.";
            
            await sendMessage(senderId, errorMessage);
        }
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Dictionnaire:', error);

        let errorMessage = "╭━━━━━━━━━━━━━━━━━━━━━━━╮\n";
        errorMessage += "┃  📖 𝗗𝗜𝗖𝗧𝗜𝗢𝗡𝗡𝗔𝗜𝗥𝗘 𝗙𝗥𝗔𝗡𝗖̧𝗔𝗜𝗦  ┃\n";
        errorMessage += "╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\n";
        errorMessage += "⚠️ Une erreur s'est produite lors de la recherche.\n\n";
        errorMessage += "🔄 Veuillez réessayer dans quelques instants.";
        
        await sendMessage(senderId, errorMessage);
    }
};

module.exports.info = {
    name: "dictionnaire",
    description: "Recherchez un mot dans le dictionnaire français et obtenez sa définition, exemples et synonymes.",
    usage: "Envoyez 'dictionnaire <mot>' pour obtenir les informations sur le mot."
};
