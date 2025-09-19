
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// URL de base de l'API Grok-2-Vision
const API_BASE_URL = "https://zaikyoov3-up.up.railway.app/api/grok-2-vision";

// Stocker les images en attente d'analyse pour chaque utilisateur
const pendingImages = {};

// Stocker les IDs de session pour chaque utilisateur
const userSessionIds = {};

// Fonction pour obtenir la date et l'heure actuelles formatées
const getCurrentDateTime = () => {
    const now = new Date();
    return now.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        // Initialiser l'ID de session si ce n'est pas déjà fait
        if (!userSessionIds[senderId]) {
            userSessionIds[senderId] = senderId; // Utiliser senderId comme ID de session
        }

        // Vérifier si nous avons affaire à un attachement image
        if (imageAttachments && imageAttachments.length > 0) {
            // Stocker l'URL de l'image pour cet utilisateur
            pendingImages[senderId] = imageAttachments[0].payload.url;
            
            // Envoyer un message confirmant la réception de l'image
            await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Quelle est votre question concernant cette photo? Je suis prêt à l'analyser avec Grok-2! 🔍🖼️");
            return { skipCommandCheck: true };
        }

        // Si le prompt est "effacer" ou "reset", effacer l'image en attente
        if (prompt.trim().toLowerCase() === 'effacer' || prompt.trim().toLowerCase() === 'reset') {
            if (pendingImages[senderId]) {
                delete pendingImages[senderId];
                await sendMessage(senderId, "🗑️ Image effacée. Vous pouvez maintenant envoyer une nouvelle image à analyser.");
            } else {
                await sendMessage(senderId, "❓ Il n'y a pas d'image à effacer actuellement.");
            }
            return;
        }
        
        // Si le prompt est vide (commande 'grok2' sans texte)
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖✨ Bonjour! Je suis Grok-2 Vision, votre assistant d'analyse d'images. Comment puis-je vous aider aujourd'hui? Partagez une image et posez-moi une question à son sujet!");
            return;
        }

        // Envoyer un message d'attente stylisé
        await sendMessage(senderId, "✨🧠 Analyse en cours... Grok-2 examine votre requête avec intelligence artificielle avancée! ⏳💫");

        let response;

        // Vérifier si nous avons une image en attente pour cet utilisateur
        if (pendingImages[senderId]) {
            const imageUrl = pendingImages[senderId];

            // Construire l'URL de l'API avec l'image
            const apiUrl = `${API_BASE_URL}?prompt=${encodeURIComponent(prompt)}&uid=${userSessionIds[senderId]}&img=${encodeURIComponent(imageUrl)}`;
            
            // Appeler l'API
            const { data } = await axios.get(apiUrl);
            response = data;

            // Ne pas effacer l'image après traitement pour permettre d'autres questions
            // L'image reste accessible pour les questions suivantes
        } else {
            // Si pas d'image active mais l'utilisateur a peut-être utilisé la commande grok2 directement
            if (prompt.toLowerCase().startsWith('grok2')) {
                await sendMessage(senderId, "🖼️ Pour utiliser Grok-2 Vision, veuillez d'abord envoyer une image que je dois analyser. Ensuite, posez votre question!");
            } else {
                // Si l'utilisateur a déjà envoyé une commande grok2 mais il n'y a pas d'image active
                await sendMessage(senderId, "🔍 Je ne trouve pas d'image récente à analyser. Pourriez-vous renvoyer l'image pour que je puisse répondre à votre question?");
            }
            return;
        }

        // Ajouter la date et l'heure actuelles à la réponse
        const dateTime = getCurrentDateTime();
        const formattedResponse = `✨ *Analyse Grok-2* ✨\n\n${response.reply}\n\n📅 ${dateTime}`;

        // Envoyer la réponse finale
        await sendMessage(senderId, formattedResponse);

        // Confirmer que l'utilisateur peut continuer à poser des questions sur cette image
        await sendMessage(senderId, "💡 Vous pouvez continuer à me poser d'autres questions sur cette même image. L'analyse reste active!");

        // Si l'API renvoie une erreur
        if (response.error) {
            await sendMessage(senderId, `⚠️ Une erreur s'est produite: ${response.error}`);
        }

    } catch (error) {
        console.error("Erreur dans la commande grok2:", error);
        await sendMessage(senderId, "⚠️ Une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer plus tard.");
    }
};
