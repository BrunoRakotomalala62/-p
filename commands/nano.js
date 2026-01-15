const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const userStates = {};

module.exports = async (senderId, userText, api, imageAttachments) => {
    if (!userStates[senderId]) {
        userStates[senderId] = { step: 'initial' };
    }

    const state = userStates[senderId];

    // Commande initiale "nano"
    if (userText && userText.toLowerCase() === 'nano') {
        state.step = 'waiting_image';
        await sendMessage(senderId, "envoyé une image à transformer");
        return;
    }

    // Réception de l'image
    if (userText === 'IMAGE_ATTACHMENT' && imageAttachments && imageAttachments.length > 0) {
        if (state.step === 'waiting_image') {
            state.imageUrl = imageAttachments[0].payload.url;
            state.step = 'waiting_prompt';
            await sendMessage(senderId, "j'ai bien reçu votre image, Poser de questions à transformer votre image");
            return { skipCommandCheck: true };
        }
    }

    // Réception du prompt de transformation
    if (state.step === 'waiting_prompt' && userText && userText !== 'IMAGE_ATTACHMENT') {
        const prompt = userText;
        const imageUrl = state.imageUrl;

        await sendMessage(senderId, "veuillez patienter pendant quelques minutes..........");

        try {
            const apiUrl = `https://nano-banana-api-five.vercel.app/nanobanana?prompt=${encodeURIComponent(prompt)}&image=${encodeURIComponent(imageUrl)}&uid=${senderId}`;
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
                throw new Error("L'API n'a pas renvoyé d'URL de résultat.");
            }
        } catch (error) {
            console.error("Erreur API Nano Banana:", error);
            await sendMessage(senderId, "Désolé, une erreur s'est produite lors de la transformation de l'image.");
        } finally {
            // Réinitialiser l'état après la tentative
            delete userStates[senderId];
        }
        return;
    }
};

module.exports.info = {
    name: "nano",
    description: "Transforme une image en utilisant l'API Nano Banana.",
    usage: "Tapez 'nano', envoyez une image, puis donnez vos instructions de transformation."
};
