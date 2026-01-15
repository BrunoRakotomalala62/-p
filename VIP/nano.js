const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// In-memory session to track images sent by users
const imageSessions = new Map();

module.exports = async (senderId, prompt, type, data) => {
    try {
        const input = (typeof prompt === 'string') ? prompt.trim() : '';

        // Si c'est un attachement d'image
        if (type === 'attachment' && data && data.type === 'image') {
            const imageUrl = data.url;
            imageSessions.set(senderId, { imageUrl });
            
            await sendMessage(senderId, "J'ai bien reçu votre photo ! Quel transformation avez vous faite à cette photo ?");
            return;
        }

        // Vérifier si on a une session image
        const session = imageSessions.get(senderId);
        
        if (!session || !session.imageUrl) {
            // Si l'utilisateur envoie du texte sans avoir envoyé d'image avant
            if (input && input !== "IMAGE_ATTACHMENT" && input !== "nano") {
                await sendMessage(senderId, "Veuillez d'abord m'envoyer une photo en pièce jointe pour commencer la transformation.");
            }
            return;
        }

        // Si l'utilisateur envoie juste "nano" ou "IMAGE_ATTACHMENT", on ne fait rien
        if (!input || input === "IMAGE_ATTACHMENT" || input.toLowerCase() === "nano") {
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
