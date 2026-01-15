const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Objet pour stocker l'état des sessions (en mémoire)
const nanoSessions = {};

module.exports = async (senderId, messageText, api, attachments) => {
    console.log(`Commande nano appelée par ${senderId} avec message: "${messageText}"`);

    // Gestion de la réinitialisation
    if (messageText === "RESET_CONVERSATION") {
        delete nanoSessions[senderId];
        return;
    }

    // Si la commande est appelée via une pièce jointe (image)
    if (messageText === "IMAGE_ATTACHMENT" && attachments && attachments.length > 0) {
        const imageUrl = attachments[0].payload.url;
        console.log(`Image reçue pour nano de ${senderId}: ${imageUrl}`);
        
        nanoSessions[senderId] = {
            imageUrl: imageUrl,
            step: 'awaiting_prompt'
        };

        await sendMessage(senderId, "Image reçue ! ✅\nQuel est votre question ou instruction pour transformer cette image ?");
        return;
    }

    const session = nanoSessions[senderId];

    // Si on a déjà une image et qu'on attend le prompt
    if (session && session.step === 'awaiting_prompt') {
        const prompt = messageText.trim();
        console.log(`Prompt reçu pour nano de ${senderId}: ${prompt}`);
        
        if (!prompt) {
            await sendMessage(senderId, "Veuillez fournir une instruction pour transformer l'image.");
            return;
        }

        try {
            await sendMessage(senderId, "Attendez quelques instants, je vais transformer votre image.......");

            const query = encodeURIComponent(prompt);
            const imageUrl = session.imageUrl;
            const apiUrl = `https://nano-banana-api-five.vercel.app/nanobanana?prompt=${query}&image=${encodeURIComponent(imageUrl)}&s&uid=${senderId}`;

            console.log(`Appel API nano: ${apiUrl}`);
            
            // Augmenter le timeout à 4 minutes (240000 ms) car l'API est lente
            const response = await axios.get(apiUrl, { timeout: 240000 });
            const resultUrl = response.data.resultats_url;

            if (resultUrl) {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: resultUrl,
                            is_reusable: true
                        }
                    }
                });
                
                await sendMessage(senderId, "✅ Transformer envoyé avec succès");
            } else {
                await sendMessage(senderId, "Désolé, je n'ai pas pu générer le résultat. L'API n'a pas renvoyé d'URL.");
            }
        } catch (error) {
            console.error("Erreur lors de l'appel à l'API nano-banana:", error);
            if (error.code === 'ECONNABORTED') {
                await sendMessage(senderId, "Le traitement a pris trop de temps. Veuillez réessayer plus tard.");
            } else {
                await sendMessage(senderId, "Désolé, une erreur s'est produite lors du traitement de votre demande.");
            }
        }
        return;
    }

    // Si l'utilisateur tape juste "nano" ou lance la commande
    console.log(`Initialisation de nano pour ${senderId}`);
    await sendMessage(senderId, "Envoyez une image pour commencer la transformation.");
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "nano",
    description: "Transforme une image envoyée via l'API Nano Banana.",
    usage: "1. Tapez 'nano'\n2. Envoyez une image\n3. Donnez votre instruction (ex: 'changer en bleu')"
};
