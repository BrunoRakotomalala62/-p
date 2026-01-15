const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const userStates = {};

module.exports = async (senderId, userText, api, imageAttachments) => {
    // Initialiser l'état si inexistant
    if (!userStates[senderId]) {
        userStates[senderId] = { step: 'idle', imageUrl: null };
    }

    const state = userStates[senderId];
    const text = userText ? userText.toLowerCase().trim() : "";

    // Commande "RESET_CONVERSATION" envoyée par handleMessage.js (via "supprimer")
    if (userText === 'RESET_CONVERSATION') {
        userStates[senderId] = { step: 'idle', imageUrl: null };
        return;
    }

    // Commande initiale "nano"
    if (text === 'nano') {
        state.step = 'awaiting_image';
        state.imageUrl = null;
        await sendMessage(senderId, "envoyé une image à transformer");
        return;
    }

    // Réception de l'image (si on attend une image)
    if (state.step === 'awaiting_image' && imageAttachments && imageAttachments.length > 0) {
        state.imageUrl = imageAttachments[0].payload.url;
        state.step = 'awaiting_prompt';
        await sendMessage(senderId, "j'ai bien reçu votre image, Poser de questions à transformer votre image");
        return;
    }

    // Réception du prompt de transformation (si on attend un prompt)
    if (state.step === 'awaiting_prompt' && userText && userText !== 'IMAGE_ATTACHMENT') {
        await sendMessage(senderId, "veuillez patienter pendant quelques minutes..........");

        try {
            const apiUrl = `https://nano-banana-api-five.vercel.app/nanobanana?prompt=${encodeURIComponent(userText)}&image=${encodeURIComponent(state.imageUrl)}&uid=${senderId}`;
            
            const response = await axios.get(apiUrl);
            
            if (response.data && response.data.resultats_url) {
                const resultUrl = response.data.resultats_url;
                
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: resultUrl,
                            is_reusable: true
                        }
                    }
                });
            } else {
                throw new Error('Réponse API invalide');
            }
        } catch (error) {
            console.error('Erreur nano API:', error);
            await sendMessage(senderId, "Désolé, une erreur s'est produite lors de la transformation de l'image.");
        } finally {
            // Réinitialiser l'état après la tentative
            userStates[senderId] = { step: 'idle', imageUrl: null };
        }
        return;
    }
};

module.exports.info = {
    name: "nano",
    description: "Transforme une image en utilisant l'IA Nano Banana.",
    usage: "Tapez 'nano', envoyez une image, puis décrivez la transformation."
};
