const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des images en attente par utilisateur
const pendingImages = {};

// Fonction pour envoyer des messages longs en plusieurs parties si nécessaire
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000;

    if (message.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }

    let startIndex = 0;

    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;

        if (endIndex < message.length) {
            const separators = ['. ', ', ', ' ', '! ', '? ', '.\n', ',\n', '!\n', '?\n', '\n\n', '\n'];
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
        await new Promise(resolve => setTimeout(resolve, 1000));

        startIndex = endIndex;
    }
}

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        const API_ENDPOINT = "https://gemimagprompt.vercel.app/";

        // Vérifier si nous avons affaire à un attachement image
        if (imageAttachments && imageAttachments.length > 0) {
            // Stocker l'URL de l'image pour cet utilisateur
            pendingImages[senderId] = imageAttachments[0].payload.url;

            // Envoyer un message confirmant la réception de l'image
            await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️");
            return { skipCommandCheck: true };
        }

        // Si le prompt est vide et qu'il n'y a pas d'image
        if ((!prompt || prompt.trim() === '') && !pendingImages[senderId]) {
            await sendMessage(senderId, "🤖✨ Bonjour! Je suis Cool AI. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question ou partagez une image pour que je puisse l'analyser!");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "✨🧠 Analyse en cours... Cool AI réfléchit à votre requête! ⏳💫");

        let response;
        let imageUrl = pendingImages[senderId] || null;

        // Construire les paramètres de la requête
        const queryParams = new URLSearchParams({
            question: prompt || "Décrivez cette photo",
            uid: senderId
        });

        // Ajouter l'image si disponible
        if (imageUrl) {
            queryParams.append('image', imageUrl);
        }

        const fullUrl = `${API_ENDPOINT}?${queryParams.toString()}`;
        response = await axios.get(fullUrl);

        // La réponse est directement le texte (pas de structure JSON complexe)
        const result = response.data;

        if (!result) {
            await sendMessage(senderId, "⚠️ Aucune réponse reçue de l'API.");
            return;
        }

        // Formater la réponse
        const formattedResponse = `
✅COOL AI MADAGASCAR🇲🇬
━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 *Votre question:* 
${prompt || "Analyse de l'image"}

✨ *Réponse:* 
${result}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Powered by 👉@Bruno | Cool AI
`;

        // Envoyer la réponse formatée
        await sendLongMessage(senderId, formattedResponse);

        // Supprimer l'image en attente après utilisation
        if (pendingImages[senderId]) {
            delete pendingImages[senderId];
        }

    } catch (error) {
        console.error("❌ Erreur Cool AI:", error?.response?.data || error.message || error);
        await sendMessage(senderId, `
⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la communication avec Cool AI.
Veuillez réessayer dans quelques instants.

🔄 Si le problème persiste, essayez une autre commande
ou contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }

    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "cool",
    description: "Discutez avec Cool AI, une IA avancée capable d'analyser du texte et des images.",
    usage: "Envoyez 'cool <question>' pour discuter avec Cool AI, ou envoyez une image suivie de questions à son sujet."
};