
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const pendingImages = {};

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        const API_ENDPOINT = "https://haji-mix-api.gleeze.com/api/anthropic";
        const API_KEY = "669397c862ff2e8c9b606584f50ccfa7684efe4eccc435c0bf51a3eba23dc225";
        const MODEL = "claude-opus-4-20250514";

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

        // Fonction pour convertir en gras Unicode
        const toBoldUnicode = (text) => {
            const boldMap = {
                'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
                'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
                'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
                'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
                'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴',
                'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻',
                'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂',
                'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
                '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰',
                '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
            };
            
            return text.split('').map(char => boldMap[char] || char).join('');
        };

        // Convertir les mots entre ** en gras Unicode et enlever les astérisques
        let processedResult = result.replace(/\*\*(.*?)\*\*/g, (match, content) => {
            return toBoldUnicode(content);
        });

        const formattedResponse = `🌾 PRAIRIE AI\n\n${processedResult}\n\n✨ Vous pouvez continuer à poser des questions sur cette image`;

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
