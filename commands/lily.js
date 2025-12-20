const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Constantes pour les décorateurs unicode gras
const BOLD_DECORATORS = {
    title: '✨ 𝗟𝗜𝗟𝗬 ✨',
    separator: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    star: '⭐',
    heart: '💖',
    sparkle: '✨'
};

// Fonction pour diviser le texte en chunks de max 2000 caractères
const splitMessage = (text, maxLength = 1950) => {
    const chunks = [];
    let currentChunk = '';

    // Diviser par les paragraphes d'abord
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        if ((currentChunk + paragraph + '\n').length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }

            // Si un seul paragraphe est trop long, le diviser par phrases
            if (paragraph.length > maxLength) {
                const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
                for (const sentence of sentences) {
                    if ((currentChunk + sentence).length > maxLength) {
                        if (currentChunk) {
                            chunks.push(currentChunk.trim());
                        }
                        currentChunk = sentence;
                    } else {
                        currentChunk += sentence;
                    }
                }
            } else {
                currentChunk = paragraph + '\n';
            }
        } else {
            currentChunk += paragraph + '\n';
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
};

module.exports = async (senderId, userText) => {
    // Extraire le prompt en retirant le préfixe 'lily' et en supprimant les espaces superflus
    const prompt = userText.slice(5).trim();

    // Vérifier si le prompt est vide
    if (!prompt) {
        await sendMessage(senderId, `${BOLD_DECORATORS.sparkle} Veuillez fournir une question ou un sujet pour que je puisse vous aider. ${BOLD_DECORATORS.sparkle}`);
        return;
    }

    try {
        // Envoyer un message de confirmation que la requête est en cours de traitement
        await sendMessage(senderId, "📲💫 Patientez, la réponse arrive… 💫📲");

        // Générer un UID unique
        const uid = Date.now().toString();

        // Appeler l'API avec le prompt fourni
        const apiUrl = `https://api-lily.vercel.app/lily?prompt=${encodeURIComponent(prompt)}&uid=${uid}`;
        const response = await axios.get(apiUrl);

        // Récupérer la réponse de l'API
        const reply = response.data.answer || "Désolé, je n'ai pas pu obtenir de réponse.";

        // Attendre 2 secondes avant d'envoyer la réponse pour un délai naturel
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Créer la réponse formatée avec décorateurs
        const formattedReply = `${BOLD_DECORATORS.title}\n${BOLD_DECORATORS.separator}\n\n${BOLD_DECORATORS.sparkle} ${reply} ${BOLD_DECORATORS.sparkle}\n\n${BOLD_DECORATORS.separator}\n${BOLD_DECORATORS.heart} À bientôt! ${BOLD_DECORATORS.heart}`;

        // Diviser le message si trop long
        const messages = splitMessage(formattedReply);

        // Envoyer les messages successifs
        for (let i = 0; i < messages.length; i++) {
            await sendMessage(senderId, messages[i]);
            // Ajouter un délai entre les messages successifs
            if (i < messages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Lily:', error);
        await sendMessage(senderId, `${BOLD_DECORATORS.sparkle} Désolé, une erreur s'est produite lors du traitement de votre question. ${BOLD_DECORATORS.sparkle}`);
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "lily", // Le nom de la commande
    description: "Discutez avec Lily, une assistante IA prête à répondre à vos questions.", // Description de la commande
    usage: "Envoyez 'lily <votre question>' pour discuter avec l'IA." // Comment utiliser la commande
};
