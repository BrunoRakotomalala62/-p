const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// In-memory session to track images sent by users
const imageSessions = new Map();

module.exports = async (senderId, prompt, type, data) => {
    try {
        const input = (typeof prompt === 'string') ? prompt.trim() : '';

        // If the user sends an image attachment
        if (data && data.type === 'image') {
            const imageUrl = data.url;
            imageSessions.set(senderId, { imageUrl });
            
            await sendMessage(senderId, "J'ai bien reçu votre photo ! Quel transformation avez vous faite à cette photo ?");
            return;
        }

        // Check if there's a session for this user
        const session = imageSessions.get(senderId);
        
        if (!session || !session.imageUrl) {
            // Avoid responding to background triggers or empty messages
            if (input && input !== "IMAGE_ATTACHMENT" && type !== 'attachment') {
                await sendMessage(senderId, "Veuillez d'abord m'envoyer une photo en pièce jointe pour commencer la transformation.");
            }
            return;
        }

        // If we reach here, we have an image in session and the user sent text
        if (!input || input === "IMAGE_ATTACHMENT") {
            return;
        }

        // Inform user that we are processing
        await sendMessage(senderId, "votre transformation est en cours..... veuillez patienter s'il vous plaît.");

        const apiUrl = `https://nano-banana-api-five.vercel.app/nanobanana?prompt=${encodeURIComponent(input)}&image=${encodeURIComponent(session.imageUrl)}&uid=${senderId}`;

        const response = await axios.get(apiUrl);
        
        if (response.data && response.data.resultats_url) {
            const resultUrl = response.data.resultats_url;

            // Send the resulting image
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
            throw new Error("L'API n'a pas renvoyé de résultat valide.");
        }

    } catch (error) {
        console.error('Erreur commande nano:', error.message);
        await sendMessage(senderId, "Désolé, une erreur est survenue lors de la transformation de votre photo. Veuillez réessayer.");
    }
};
