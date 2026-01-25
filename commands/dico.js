const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const userStates = {};

module.exports = async (senderId, prompt) => {
    try {
        const userState = userStates[senderId];

        // Format: [Letter] [Page] (e.g., A 25)
        if (prompt.match(/^([A-Z])\s*(\d+)$/i)) {
            const match = prompt.match(/^([A-Z])\s*(\d+)$/i);
            const letter = match[1].toUpperCase();
            const page = match[2];
            userStates[senderId] = { letter };
            const apiUrl = `https://dictionnairemlgfr.vercel.app/recherche?dictionnaire=${letter}&page=${page}`;
            const response = await axios.get(apiUrl);
            await handleApiResponse(response, letter, senderId);
            return;
        }

        if (userState && prompt.match(/^\d+$/)) {
            const page = prompt;
            const letter = userState.letter;
            const apiUrl = `https://dictionnairemlgfr.vercel.app/recherche?dictionnaire=${letter}&page=${page}`;
            const response = await axios.get(apiUrl);
            await handleApiResponse(response, letter, senderId);
            return;
        }

        if (prompt.toLowerCase().startsWith('dico')) {
            const args = prompt.split(' ').slice(1);
            if (args.length === 0) {
                await sendMessage(senderId, "📖 Usage :\n1. 'dico <mot>' (ex: dico chat) pour une définition simple.\n2. 'dico <lettre> <page>' (ex: dico A 0) pour le dictionnaire Malgache.");
                return;
            }

            // Simple word search (Free Public API)
            if (args.length === 1) {
                const word = args[0];
                try {
                    const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
                    const data = response.data[0];
                    let formattedResponse = `📖 Dictionnaire (Anglais):\n\n`;
                    formattedResponse += `🔤 Mot: ${data.word}\n`;
                    if (data.phonetic) formattedResponse += `🗣 Prononciation: ${data.phonetic}\n`;
                    
                    data.meanings.forEach(meaning => {
                        formattedResponse += `\n🔸 [${meaning.partOfSpeech}]\n`;
                        meaning.definitions.slice(0, 2).forEach((def, i) => {
                            formattedResponse += `${i + 1}. ${def.definition}\n`;
                            if (def.example) formattedResponse += `   📝 Ex: "${def.example}"\n`;
                        });
                    });
                    
                    await sendMessage(senderId, formattedResponse);
                    return;
                } catch (err) {
                    console.log("Dictionary API error or word not found");
                    await sendMessage(senderId, `❌ Désolé, je n'ai pas trouvé de définition pour "${word}".`);
                    return;
                }
            }

            // Malagasy Dictionary search
            if (args.length === 2) {
                const letter = args[0].toUpperCase();
                const page = args[1];

                if (!/^[A-Z]$/.test(letter) || !/^\d+$/.test(page)) {
                    await sendMessage(senderId, "Format invalide. Exemple : 'dico A 0'.");
                    return;
                }

                userStates[senderId] = { letter };
                const apiUrl = `https://dictionnairemlgfr.vercel.app/recherche?dictionnaire=${letter}&page=${page}`;
                const response = await axios.get(apiUrl);
                await handleApiResponse(response, letter, senderId);
                return;
            }
        }

        await sendMessage(senderId, "Commande non reconnue. Tapez 'dico <mot>' ou 'dico <lettre> <page>'.");
    } catch (error) {
        console.error('Erreur dico:', error.message);
        await sendMessage(senderId, "⚠️ Le service du dictionnaire Malgache est actuellement indisponible.");
    }
};

async function handleApiResponse(response, letter, senderId) {
    if (!response.data || !response.data.definitions) {
        await sendMessage(senderId, "Erreur lors de la récupération des définitions.");
        return;
    }

    const definitions = response.data.definitions.filter(def => def);

    if (definitions.length === 0) {
        await sendMessage(senderId, `Aucune définition trouvée pour ${letter}.`);
        return;
    }

    let formattedResponse = `🇲🇬 Dictionnaire Français-Malagasy 🇲🇬:\n\n`;
    formattedResponse += `❤️ Résultats pour la lettre ${letter} ❤️:\n\n`;

    definitions.forEach(def => {
        const formattedDef = def.replace(/([a-zA-Z]+)(verbe|nom|adjectif|adverbe)/, '$1 $2');
        formattedResponse += `✅ ${formattedDef}\n`;
    });

    await sendMessage(senderId, formattedResponse);
}

module.exports.info = {
    name: "dico",
    description: "Recherche dans le dictionnaire (Simple ou Malgache).",
    usage: "dico <mot> OU dico <lettre> <page>"
};