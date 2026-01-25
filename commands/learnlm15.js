
const axios = require('axios');
const sendMessage = require('../handles/sendMessage'); // Importer la fonction sendMessage

// Stockage des IDs de session par utilisateur pour maintenir les conversations continues
const userSessionIds = {};

// URL de base pour l'API Sonnet 3.7
const API_BASE_URL = 'https://zaikyoov3-up.up.railway.app/api/learnlm1-5';

// Stockage des images en attente
const pendingImages = {};

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
            await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️");
            return { skipCommandCheck: true };
        }

        // Si le prompt est vide (commande 'claude' sans texte)
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖✨ Bonjour! Je suis Learnlm, votre assistant IA. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question ou partagez une image pour que je puisse l'analyser!");
            return;
        }

        // Envoyer un message d'attente stylisé
        await sendMessage(senderId, "✨🧠 Analyse en cours... Learnlm réfléchit à votre requête avec intelligence artificielle supérieure! ⏳💫");

        let response;
        
        // Vérifier si nous avons une image en attente pour cet utilisateur
        if (pendingImages[senderId]) {
            const imageUrl = pendingImages[senderId];
            
            // Construire l'URL de l'API avec l'image
            const apiUrl = `${API_BASE_URL}?prompt=${encodeURIComponent(prompt)}&uid=${userSessionIds[senderId]}&img=${encodeURIComponent(imageUrl)}`;
            
            // Appel à l'API avec l'image
            response = await axios.get(apiUrl);
        } else {
            // Appel à l'API sans image (texte seulement)
            const apiUrl = `${API_BASE_URL}?prompt=${encodeURIComponent(prompt)}&uid=${userSessionIds[senderId]}`;
            response = await axios.get(apiUrl);
        }
        
        // Récupérer la réponse de l'API
        const { reply, session_id, author } = response.data;
        
        // Mettre à jour l'ID de session si nécessaire
        if (session_id) {
            userSessionIds[senderId] = session_id;
        }

        // Créer une réponse formatée et stylisée
        const formattedReply = `
✅Leanlm 1-5🇲🇬
━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 *Votre question:* 
${prompt}

✨ *Réponse:* 
${reply}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Powered by 👉@Bruno | Learnlm 1-5
`;

        // Envoyer la réponse formatée
        await sendMessage(senderId, formattedReply);
        
        // Si c'était une demande liée à une image, on peut maintenant la conserver
        // pour les futures questions mais on ne la mentionne plus dans les messages
        
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Learnlm15 :", error);
        
        // Message d'erreur stylisé
        await sendMessage(senderId, `
⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la communication avec Claude.
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
    name: "claude",
    description: "Discutez avec learnlm 1-5, une IA avancée capable d'analyser du texte et des images.",
    usage: "Envoyez 'learnlm15 <question>' pour discuter avec Learnlm, ou envoyez une image suivie de questions à son sujet."
};
