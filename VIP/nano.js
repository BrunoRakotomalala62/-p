const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// In-memory session to track images sent by users
const imageSessions = new Map();

module.exports = async (senderId, prompt, type, data) => {
    try {
        const input = (typeof prompt === 'string') ? prompt.trim() : '';
        const inputLower = input.toLowerCase();

        // If the user sends an image attachment (even if they typed "nano")
        if (type === 'attachment' && data && data.type === 'image') {
            const imageUrl = data.url;
            imageSessions.set(senderId, { imageUrl });
            
            await sendMessage(senderId, "J'ai bien reçu votre photo ! Quelle transformation souhaitez-vous appliquer à cette photo ?");
            return;
        }

        // Check if there's a session for this user
        const session = imageSessions.get(senderId);
        
        // If user just typed "nano" or another text without having sent an image yet
        if (!session || !session.imageUrl) {
            // Only send this if it's not a background attachment trigger
            if (type !== 'attachment') {
                await sendMessage(senderId, "Veuillez d'abord m'envoyer une photo en pièce jointe pour commencer la transformation.");
            }
            return;
        }

        // If we reach here, we have an image in session and the user sent text
        if (!input || input === "IMAGE_ATTACHMENT") {
            return;
        }

        // Inform user that we are processing
        await sendMessage(senderId, "Transformation en cours, veuillez patienter... ⏳");

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
