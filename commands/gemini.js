
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des images en attente par utilisateur
const pendingImages = {};

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        const API_ENDPOINT = "https://kaiz-apis.gleeze.com/api/gemini-vision";
        const API_KEY = ""; // Votre clé API Kaiz
        const UID = Math.floor(Math.random() * 1000000).toString(); // UID aléatoire

        // Vérifier si nous avons affaire à un attachement image
        if (imageAttachments && imageAttachments.length > 0) {
            // Stocker l'URL de l'image pour cet utilisateur
            pendingImages[senderId] = imageAttachments[0].payload.url;
            
            // Envoyer un message confirmant la réception de l'image
            await sendMessage(senderId, "🧠 Image reçue! Posez votre question à propos de cette image ou envoyez 'gemini' pour l'analyser.");
            return { skipCommandCheck: true };
        }

        // Récupérer l'image en attente si elle existe
        let imageUrl = pendingImages[senderId] || null;

        // Si le prompt est vide et qu'il n'y a pas d'image
        if ((!prompt || prompt.trim() === '') && !imageUrl) {
            await sendMessage(senderId, "🧠 Gemini AI Bot\n\n❌ Veuillez fournir une question ou répondre à une image.");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "🧠 Gemini réfléchit à votre demande...");

        // Construire les paramètres de la requête
        const queryParams = new URLSearchParams({
            q: prompt || "",
            uid: UID,
            imageUrl: imageUrl || "",
            apikey: API_KEY
        });

        const fullUrl = `${API_ENDPOINT}?${queryParams.toString()}`;
        const response = await axios.get(fullUrl);
        const result = response?.data?.response;

        if (!result) {
            await sendMessage(senderId, "⚠️ Aucune réponse reçue de l'API Gemini.");
            return;
        }

        // Formater la réponse
        const formattedResponse = `🧠 GEMINI AI BOT 🤖\n\n${result}\n\n✨ Propulsé par Gemini Vision API`;

        // Envoyer la réponse en gérant les messages longs
        const MAX_MESSAGE_LENGTH = 2000;
        if (formattedResponse.length > MAX_MESSAGE_LENGTH) {
            // Diviser le message en chunks
            const chunks = [];
            let startIndex = 0;
            
            while (startIndex < formattedResponse.length) {
                let endIndex = startIndex + MAX_MESSAGE_LENGTH;
                
                if (endIndex < formattedResponse.length) {
                    // Chercher le dernier point ou espace pour une coupure propre
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
            
            // Envoyer chaque chunk avec une pause
            for (let i = 0; i < chunks.length; i++) {
                await sendMessage(senderId, chunks[i]);
                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } else {
            await sendMessage(senderId, formattedResponse);
        }

        // Supprimer l'image en attente après utilisation
        if (pendingImages[senderId]) {
            delete pendingImages[senderId];
        }

    } catch (error) {
        console.error("❌ Erreur Gemini AI:", error?.response?.data || error.message || error);
        await sendMessage(senderId, "❌ Une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer plus tard.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "gemini",
    description: "Posez des questions à Gemini AI avec ou sans image en utilisant l'API Kaiz Gemini Vision.",
    usage: "Envoyez 'gemini <question>' ou répondez à une image avec 'gemini <question>'"
};
