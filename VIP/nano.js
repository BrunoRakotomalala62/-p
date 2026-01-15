const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// In-memory session to track images sent by users
const imageSessions = new Map();

module.exports = async (senderId, prompt, type, data) => {
    try {
        // If the user sends an image attachment
        if (type === 'attachment' && data && data.type === 'image') {
            const imageUrl = data.url;
            imageSessions.set(senderId, { imageUrl });
            
            await sendMessage(senderId, "J'ai bien reçu votre photo ! Quelle transformation souhaitez-vous appliquer à cette photo ?");
            return;
        }

        // If the user sends a text message (the prompt for transformation)
        const session = imageSessions.get(senderId);
        if (!session || !session.imageUrl) {
            // If no image in session and no attachment in current message, ask for an image
            if (type !== 'attachment') {
                await sendMessage(senderId, "Veuillez d'abord m'envoyer une photo en pièce jointe pour commencer la transformation.");
            }
            return;
        }

        const transformationPrompt = (typeof prompt === 'string') ? prompt.trim() : '';
        if (!transformationPrompt) {
            await sendMessage(senderId, "Veuillez me dire quelle transformation vous souhaitez faire à cette photo.");
            return;
        }

        // Inform user that we are processing
        await sendMessage(senderId, "Transformation en cours, veuillez patienter... ⏳");

        const apiUrl = `https://nano-banana-api-five.vercel.app/nanobanana?prompt=${encodeURIComponent(transformationPrompt)}&image=${encodeURIComponent(session.imageUrl)}&uid=${senderId}`;

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

            // Clear session after successful transformation if you want it to be one-off
            // Or keep it if the user wants to apply multiple transformations to the same image
            // imageSessions.delete(senderId); 
        } else {
            throw new Error("L'API n'a pas renvoyé de résultat valide.");
        }

    } catch (error) {
        console.error('Erreur commande nano:', error.message);
        await sendMessage(senderId, "Désolé, une erreur est survenue lors de la transformation de votre photo. Veuillez réessayer.");
    }
};
