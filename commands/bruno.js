const axios = require('axios');
const sendMessage = require('../handles/sendMessage'); // Importer la fonction sendMessage

// Stockage des IDs de session par utilisateur pour maintenir les conversations continues
const userSessionIds = {};

// URL de base pour l'API Ronald
const API_BASE_URL = 'https://ronald-api-v1.vercel.app/api/ronald';

// Stockage des images en attente
const pendingImages = {};

// Fonction pour envoyer des messages longs en plusieurs parties si nécessaire
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000; // Limite de caractères par message Facebook

    if (message.length <= MAX_MESSAGE_LENGTH) {
        // Si le message est assez court, l'envoyer directement
        await sendMessage(senderId, message);
        return;
    }

    // Diviser le message en plusieurs parties intelligemment
    let startIndex = 0;

    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;

        // Si on n'est pas à la fin du message
        if (endIndex < message.length) {
            // Chercher le dernier séparateur (point, virgule, espace) avant la limite
            const separators = ['. ', ', ', ' ', '! ', '? ', '.\n', ',\n', '!\n', '?\n', '\n\n', '\n'];
            let bestBreakPoint = -1;

            // Chercher du point le plus proche de la fin jusqu'au début
            for (const separator of separators) {
                // Chercher le dernier séparateur dans la plage
                const lastSeparator = message.lastIndexOf(separator, endIndex);
                if (lastSeparator > startIndex && (bestBreakPoint === -1 || lastSeparator > bestBreakPoint)) {
                    bestBreakPoint = lastSeparator + separator.length;
                }
            }

            // Si un séparateur a été trouvé, utiliser ce point de coupure
            if (bestBreakPoint !== -1) {
                endIndex = bestBreakPoint;
            }
        } else {
            // Si c'est la dernière partie, prendre jusqu'à la fin
            endIndex = message.length;
        }

        // Extraire la partie du message
        const messagePart = message.substring(startIndex, endIndex);
        await sendMessage(senderId, messagePart);
        await new Promise(resolve => setTimeout(resolve, 1000));  // Pause de 1s entre chaque message

        // Passer à la partie suivante
        startIndex = endIndex;
    }
}

module.exports = async (senderId, prompt, api, imageAttachments) => { 
    try {
        // Vérifier si c'est une demande de réinitialisation
        if (prompt === "RESET_CONVERSATION") {
            // Supprimer l'ID de session pour forcer une nouvelle conversation
            delete userSessionIds[senderId];
            // Supprimer toute image en attente
            delete pendingImages[senderId];
            return { skipCommandCheck: true };
        }

        // Initialiser l'ID de session si ce n'est pas déjà fait
        if (!userSessionIds[senderId]) {
            userSessionIds[senderId] = senderId; // Utiliser senderId comme ID de session
        }

        // Vérifier si nous avons affaire à un attachement image
        if (imageAttachments && imageAttachments.length > 0) {
            // Stocker l'URL de l'image pour cet utilisateur
            pendingImages[senderId] = imageAttachments[0].payload.url;

            // Envoyer un message confirmant la réception de l'image
            await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️");
            return { skipCommandCheck: true };
        }

        // Si le prompt est vide (commande 'bruno' sans texte)
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖✨ Bonjour! Je suis Bruno, votre assistant IA. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question!");
            return;
        }

        // Envoyer un message d'attente stylisé
        await sendMessage(senderId, "✨🧠 Analyse en cours... Bruno réfléchit à votre requête avec intelligence artificielle supérieure! ⏳💫");

        // Construire l'URL de l'API Ronald
        const apiUrl = `${API_BASE_URL}?message=${encodeURIComponent(prompt)}`;

        // Appel à l'API Ronald
        const response = await axios.get(apiUrl);

        // Récupérer la réponse de l'API
        const { response: reply, operator, powered_by } = response.data;

        // Créer une réponse formatée selon le nouveau format demandé
        const formattedReply = `📝 REPONSE DE BRUNO 🤖\n${reply}`;

        // Envoyer la réponse formatée en utilisant la nouvelle fonction
        await sendLongMessage(senderId, formattedReply);

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Ronald:", error);

        // Message d'erreur stylisé
        await sendMessage(senderId, `
⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la communication avec Bruno.
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
    name: "Bruno",
    description: "Discutez avec Bruno, une IA avancée propulsée par Ronald IA - LLaMA 3 via Groq.",
    usage: "Envoyez 'bruno <question>' pour discuter avec Bruno."
};