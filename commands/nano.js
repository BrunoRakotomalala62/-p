const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Objet pour stocker l'état des sessions (en mémoire)
// Dans une application réelle, vous pourriez vouloir utiliser une base de données ou un cache (Redis)
const nanoSessions = {};

module.exports = async (senderId, messageText, api, attachments) => {
    // Si la commande est appelée via une pièce jointe (image)
    if (messageText === "IMAGE_ATTACHMENT" && attachments && attachments.length > 0) {
        const imageUrl = attachments[0].payload.url;
        
        // On enregistre l'image dans la session de l'utilisateur
        nanoSessions[senderId] = {
            imageUrl: imageUrl,
            step: 'awaiting_prompt'
        };

        await sendMessage(senderId, "Image reçue ! ✅\nQuel est votre question ou instruction pour transformer cette image ?");
        return;
    }

    // Gestion de la réinitialisation
    if (messageText === "RESET_CONVERSATION") {
        delete nanoSessions[senderId];
        return;
    }

    const session = nanoSessions[senderId];

    // Si on a déjà une image et qu'on attend le prompt
    if (session && session.step === 'awaiting_prompt') {
        const prompt = messageText.trim();
        
        if (!prompt) {
            await sendMessage(senderId, "Veuillez fournir une instruction pour transformer l'image.");
            return;
        }

        try {
            await sendMessage(senderId, "Attendez quelques instants, je vais transformer votre image.......");

            const query = encodeURIComponent(prompt);
            const imageUrl = session.imageUrl;
            const apiUrl = `https://nano-banana-api-five.vercel.app/nanobanana?prompt=${query}&image=${encodeURIComponent(imageUrl)}&s&uid=${senderId}`;

            // Appeler l'API nano-banana
            const response = await axios.get(apiUrl);
            const resultUrl = response.data.resultats_url;

            if (resultUrl) {
                // Envoyer le résultat à l'utilisateur
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: resultUrl,
                            is_reusable: true
                        }
                    }
                });
                
                await sendMessage(senderId, "✅ Transformé envoyé avec succès");
                
                // On peut soit garder la session pour une autre transformation, 
                // soit la supprimer pour recommencer avec une nouvelle image.
                // Ici, on attend une nouvelle question sur la même image ou on peut reset.
                // Pour suivre exactement votre demande, on reste sur cette image.
            } else {
                await sendMessage(senderId, "Désolé, je n'ai pas pu générer le résultat. L'API n'a pas renvoyé d'URL.");
            }
        } catch (error) {
            console.error("Erreur lors de l'appel à l'API nano-banana:", error);
            await sendMessage(senderId, "Désolé, une erreur s'est produite lors du traitement de votre demande.");
        }
        return;
    }

    // Si l'utilisateur tape juste "nano" ou lance la commande sans image
    if (messageText.toLowerCase().startsWith('nano')) {
        const promptAfterCommand = messageText.replace(/^nano\s*/i, '').trim();
        
        // Si l'utilisateur a mis un prompt directement (ex: nano changer en bleu)
        // mais qu'on n'a pas d'image, on lui demande l'image d'abord.
        if (promptAfterCommand) {
            await sendMessage(senderId, "Veuillez d'abord envoyer l'image que vous souhaitez transformer.");
        } else {
            await sendMessage(senderId, "Envoyez une image pour commencer la transformation.");
        }
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "nano",
    description: "Transforme une image envoyée via l'API Nano Banana.",
    usage: "1. Tapez 'nano'\n2. Envoyez une image\n3. Donnez votre instruction (ex: 'changer en bleu')"
};
