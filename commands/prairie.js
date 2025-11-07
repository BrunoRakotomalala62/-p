
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const pendingImages = {};

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        const API_ENDPOINT = "https://haji-mix-api.gleeze.com/api/anthropic";
        const API_KEY = process.env.PRAIRIE_API_KEY;
        const MODEL = "claude-opus-4-20250514";

        if (!API_KEY) {
            console.error("❌ PRAIRIE_API_KEY environment variable is not set");
            await sendMessage(senderId, "❌ Configuration error: API key missing. Please contact the administrator.");
            return;
        }

        if (imageAttachments && imageAttachments.length > 0) {
            pendingImages[senderId] = imageAttachments[0].payload.url;
            await sendMessage(senderId, "Merci beaucoup pour cette photo et j'ai bien reçu quel est votre question concernant cette photo");
            return { skipCommandCheck: true };
        }

        const imageUrl = pendingImages[senderId] || null;

        if ((!prompt || prompt.trim() === '') && !imageUrl) {
            await sendMessage(senderId, "🌾 Prairie AI\n\nVeuillez envoyer une image ou poser une question.");
            return;
        }

        if (!imageUrl && prompt) {
            await sendMessage(senderId, "Veuillez d'abord envoyer une image en pièce jointe avant de poser votre question.");
            return;
        }

        await sendMessage(senderId, "🌾 Prairie AI analyse votre demande...");

        const queryParams = {
            ask: prompt || "",
            model: MODEL,
            uid: senderId,
            roleplay: "Text",
            max_tokens: 3000,
            stream: false,
            img_url: imageUrl,
            api_key: API_KEY
        };

        const response = await axios.get(API_ENDPOINT, {
            params: queryParams,
            timeout: 60000
        });

        const result = response?.data?.answer;

        if (!result) {
            await sendMessage(senderId, "⚠️ Aucune réponse reçue de l'API Prairie.");
            return;
        }

        const formattedResponse = `🌾 PRAIRIE AI\n\n${result}\n\n✨ Vous pouvez continuer à poser des questions sur cette image`;

        const MAX_MESSAGE_LENGTH = 2000;
        if (formattedResponse.length > MAX_MESSAGE_LENGTH) {
            const chunks = [];
            let startIndex = 0;
            
            while (startIndex < formattedResponse.length) {
                let endIndex = startIndex + MAX_MESSAGE_LENGTH;
                
                if (endIndex < formattedResponse.length) {
                    const lastPeriod = formattedResponse.lastIndexOf('.', endIndex);
                    const lastSpace = formattedResponse.lastIndexOf(' ', endIndex);
                    const breakPoint = Math.max(lastPeriod, lastSpace);
                    
                    if (breakPoint > startIndex) {
                        endIndex = breakPoint + 1;
                    }
                }
                
                chunks.push(formattedResponse.substring(startIndex, endIndex));
                startIndex = endIndex;
            }
            
            for (let i = 0; i < chunks.length; i++) {
                await sendMessage(senderId, chunks[i]);
                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } else {
            await sendMessage(senderId, formattedResponse);
        }

    } catch (error) {
        console.error("❌ Erreur Prairie AI:", error?.response?.data || error.message || error);
        await sendMessage(senderId, "❌ Une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer plus tard.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "prairie",
    description: "Analysez des images avec l'intelligence artificielle Claude. Envoyez une image puis posez vos questions.",
    usage: "Envoyez une image en pièce jointe, puis posez votre question.",
    author: "Bruno"
};
