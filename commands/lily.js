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

// Décorateurs pour le mode romantic
const ROMANTIC_DECORATORS = {
    title: '💕 𝗟𝗜𝗟𝗬 𝗥𝗼𝗺𝗮𝗻𝘁𝗶𝗾𝘶𝗲 💕',
    separator: '❤️━━━━━━━━━━━━━━━━━━━━━━━━━━❤️',
    rose: '🌹',
    kiss: '💋',
    cupid: '💘',
    love: '❤️'
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
    let prompt = userText.slice(5).trim();

    // Déterminer le mode (romantic ou standard)
    let isRomanticMode = false;
    const romanticKeywords = ['romantic', 'romantiqu', 'amour', 'amoureux', 'séduction', 'passionné'];
    
    for (const keyword of romanticKeywords) {
        if (prompt.toLowerCase().includes(keyword)) {
            isRomanticMode = true;
            // Supprimer le mot-clé du prompt
            prompt = prompt.toLowerCase().replace(keyword, '').trim();
            break;
        }
    }

    // Vérifier si le prompt est vide
    if (!prompt) {
        const decorators = isRomanticMode ? ROMANTIC_DECORATORS : BOLD_DECORATORS;
        await sendMessage(senderId, `${decorators.sparkle || decorators.cupid} Veuillez fournir une question ou un sujet pour que je puisse vous aider. ${decorators.sparkle || decorators.cupid}`);
        return;
    }

    try {
        // Envoyer un message de confirmation que la requête est en cours de traitement
        const loadingMsg = isRomanticMode ? "💕✨ Patientez, mon amour... votre réponse arrive… 💕✨" : "📲💫 Patientez, la réponse arrive… 💫📲";
        await sendMessage(senderId, loadingMsg);

        // Générer un UID unique
        const uid = Date.now().toString();

        // Construire l'URL de l'API avec le mode approprié
        let apiUrl = `https://api-lily.vercel.app/lily?prompt=${encodeURIComponent(prompt)}&uid=${uid}`;
        if (isRomanticMode) {
            apiUrl += '&mode=romantic';
        }

        const response = await axios.get(apiUrl);

        // Récupérer la réponse de l'API
        const reply = response.data.answer || "Désolé, je n'ai pas pu obtenir de réponse.";

        // Attendre 2 secondes avant d'envoyer la réponse pour un délai naturel
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Sélectionner les décorateurs appropriés
        const decorators = isRomanticMode ? ROMANTIC_DECORATORS : BOLD_DECORATORS;
        const closingMsg = isRomanticMode ? `${decorators.rose} Avec tout mon amour... 🌹` : `${decorators.heart} À bientôt! ${decorators.heart}`;

        // Créer la réponse formatée avec décorateurs
        const formattedReply = `${decorators.title}\n${decorators.separator}\n\n${decorators.sparkle || decorators.cupid} ${reply} ${decorators.sparkle || decorators.cupid}\n\n${decorators.separator}\n${closingMsg}`;

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
        const decorators = isRomanticMode ? ROMANTIC_DECORATORS : BOLD_DECORATORS;
        await sendMessage(senderId, `${decorators.sparkle || decorators.cupid} Désolé, une erreur s'est produite lors du traitement de votre question. ${decorators.sparkle || decorators.cupid}`);
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "lily", // Le nom de la commande
    description: "Discutez avec Lily, une assistante IA prête à répondre à vos questions.", // Description de la commande
    usage: "Envoyez 'lily <votre question>' pour discuter avec l'IA." // Comment utiliser la commande
};
