
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stocker les sessions utilisateurs (image + historique)
const userSessions = {};

module.exports = async (senderId, prompt, attachments) => {
    try {
        // Si l'utilisateur envoie une image
        if (attachments && attachments.length > 0) {
            const imageAttachment = attachments.find(att => att.type === 'image');
            
            if (imageAttachment) {
                // Stocker l'URL de l'image pour cet utilisateur
                userSessions[senderId] = {
                    imageUrl: imageAttachment.payload.url,
                    conversationActive: true
                };
                
                await sendMessage(senderId, "📸 Merci beaucoup pour cette photo et j'ai bien reçu ! Quelle est votre question concernant cette photo ? 🤔");
                return { skipCommandCheck: true };
            }
        }
        
        // Si l'utilisateur pose une question et a une session active
        if (userSessions[senderId] && userSessions[senderId].conversationActive) {
            const imageUrl = userSessions[senderId].imageUrl;
            
            if (!prompt || prompt.trim() === '') {
                await sendMessage(senderId, "❓ Veuillez poser une question concernant l'image.");
                return { skipCommandCheck: true };
            }
            
            // Message d'attente
            await sendMessage(senderId, "🔍 Analyse de votre image en cours... Veuillez patienter ! ⏳");
            
            // Préparer la requête API
            const apiKey = '669397c862ff2e8c9b606584f50ccfa7684efe4eccc435c0bf51a3eba23dc225';
            const model = 'claude-opus-4-20250514';
            const maxTokens = 3000;
            
            const apiUrl = `https://haji-mix-api.gleeze.com/api/anthropic`;
            
            const params = {
                ask: prompt,
                model: model,
                uid: senderId,
                roleplay: 'Text',
                max_tokens: maxTokens,
                stream: false,
                img_url: imageUrl,
                api_key: apiKey
            };
            
            // Appel à l'API
            const response = await axios.get(apiUrl, { params });
            
            if (response.data && response.data.answer) {
                const reply = response.data.answer;
                
                // Formater la réponse
                const formattedReply = `🌾 PRAIRIE AI 🌾\n\n${reply}\n\n💬 Vous pouvez continuer à poser des questions sur cette image !`;
                
                await sendMessage(senderId, formattedReply);
            } else {
                await sendMessage(senderId, "⚠️ Aucune réponse reçue de l'API. Veuillez réessayer.");
            }
            
        } else {
            // L'utilisateur n'a pas envoyé d'image d'abord
            await sendMessage(senderId, "📸 Veuillez d'abord envoyer une image en pièce jointe, puis je vous demanderai votre question ! 😊");
        }
        
    } catch (error) {
        console.error("Erreur lors de l'analyse avec Prairie AI:", error);
        await sendMessage(senderId, "🚨 Une erreur s'est produite lors de l'analyse de votre image. Veuillez réessayer.");
    }
    
    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "prairie",
    description: "Analysez des images avec l'intelligence artificielle Claude. Envoyez une image puis posez vos questions.",
    usage: "Envoyez une image en pièce jointe, puis posez votre question.",
    author: "Bruno"
};
