
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Fonction pour envoyer des messages longs en plusieurs parties
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000; // Limite de caractères par message Facebook

    if (message.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }

    // Diviser le message en plusieurs parties intelligemment
    let startIndex = 0;
    
    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;
        
        if (endIndex < message.length) {
            // Chercher le dernier séparateur avant la limite
            const separators = ['\n\n', '\n', '. ', ', ', ' '];
            let bestBreakPoint = -1;
            
            for (const separator of separators) {
                const lastSeparator = message.lastIndexOf(separator, endIndex);
                if (lastSeparator > startIndex && (bestBreakPoint === -1 || lastSeparator > bestBreakPoint)) {
                    bestBreakPoint = lastSeparator + separator.length;
                }
            }
            
            if (bestBreakPoint !== -1) {
                endIndex = bestBreakPoint;
            }
        } else {
            endIndex = message.length;
        }
        
        const messagePart = message.substring(startIndex, endIndex);
        await sendMessage(senderId, messagePart);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Pause de 1s entre messages
        
        startIndex = endIndex;
    }
}

module.exports = async (senderId, args) => {
    try {
        // Vérifier si une requête a été fournie
        if (!args || args.trim() === '') {
            await sendMessage(senderId, "🎵 Veuillez fournir le titre d'une chanson ou un artiste.\n\n📝 Exemple: lyrics my love westlife");
            return;
        }

        // Message d'attente
        await sendMessage(senderId, "🎶 Recherche des paroles en cours... ⏳");

        // Construire l'URL de l'API
        const query = encodeURIComponent(args.trim());
        const apiUrl = `https://api-library-kohi.onrender.com/api/lyrics?query=${query}`;

        // Appel à l'API
        const response = await axios.get(apiUrl, { timeout: 30000 });

        // Vérifier la réponse
        if (response.data && response.data.status && response.data.data) {
            const { title, artist, lyrics } = response.data.data;

            // Formatter la réponse avec des emojis
            const formattedResponse = `
🎵✨ PAROLES DE CHANSON ✨🎵
━━━━━━━━━━━━━━━━━━━━━━━━━━

🎤 *Titre:* ${title}
👨‍🎤 *Artiste:* ${artist}

━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 *Paroles:*

${lyrics}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🎼 Powered by 👉 @Bruno | Lyrics API
`;

            // Envoyer la réponse avec découpage dynamique
            await sendLongMessage(senderId, formattedResponse);

        } else {
            await sendMessage(senderId, "❌ Aucune parole trouvée pour cette chanson. Veuillez vérifier le titre ou l'artiste.");
        }

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Lyrics:", error);

        // Message d'erreur stylisé
        await sendMessage(senderId, `
⚠️ *ERREUR DE RECHERCHE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la recherche des paroles.

🔄 Veuillez réessayer dans quelques instants.
💡 Assurez-vous d'avoir bien écrit le titre de la chanson.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }
};

// Informations de la commande
module.exports.info = {
    name: "lyrics",
    description: "Recherchez les paroles de vos chansons préférées",
    usage: "lyrics <titre de la chanson ou artiste>\n\nExemple: lyrics my love westlife"
};
