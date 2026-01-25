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
            
            // Augmentation de la robustesse de l'appel
            const response = await axios.get(apiUrl, { 
                timeout: 300000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            
            console.log("Réponse reçue de l'API nano-banana:", response.data);
            
            let data = response.data;
            if (typeof data === 'string' && data.includes('{')) {
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    console.error("Erreur parsing JSON (tentative):", e);
                }
            }

            // L'API peut renvoyer l'URL dans différents champs ou être l'URL elle-même
            let resultUrl = null;
            if (typeof data === 'object' && data !== null) {
                resultUrl = data.resultats_url || data.result || data.url || data.image_url;
            } else if (typeof data === 'string' && data.startsWith('http')) {
                resultUrl = data.trim();
            }

            if (resultUrl) {
                console.log(`URL de résultat trouvée: ${resultUrl}`);
                // Envoyer l'image en tant qu'attachement (payload url)
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: resultUrl,
                            is_reusable: true
                        }
                    }
                });
                
                await sendMessage(senderId, "✅ Transformation envoyée avec succès");
                // On peut garder la session ou la supprimer. Ici on la garde pour permettre d'autres transformations sur la même image ?
                // Mais l'image originale est dans session.imageUrl. Si on veut enchaîner, on pourrait mettre à jour session.imageUrl.
            } else {
                console.error("URL de résultat manquante dans la réponse API. Données:", data);
                await sendMessage(senderId, "Désolé, l'API n'a pas renvoyé d'image exploitable. Voici la réponse reçue : " + (typeof data === 'string' ? data.substring(0, 100) : "Format inconnu"));
            }
        } catch (error) {
            console.error("Erreur lors de l'appel à l'API nano-banana:");
            
            // Tentative de récupération du résultat même en cas d'erreur (ex: 504 avec data)
            if (error.response && error.response.data) {
                const errorData = error.response.data;
                console.log("Données trouvées dans la réponse d'erreur:", errorData);
                const resultUrl = errorData.resultats_url || errorData.result || errorData.url;
                
                if (resultUrl && typeof resultUrl === 'string' && resultUrl.startsWith('http')) {
                    console.log(`URL de résultat récupérée malgré l'erreur ${error.response.status}: ${resultUrl}`);
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'image',
                            payload: {
                                url: resultUrl,
                                is_reusable: true
                            }
                        }
                    });
                    await sendMessage(senderId, "✅ Transformation récupérée malgré une instabilité de l'API.");
                    return;
                }
            }

            if (error.response) {
                console.error("Status:", error.response.status);
                if (error.response.status === 504) {
                    await sendMessage(senderId, "Désolé, l'API est actuellement surchargée (Erreur 504). Veuillez réessayer avec un prompt plus simple.");
                } else {
                    await sendMessage(senderId, `L'API a renvoyé une erreur (${error.response.status}). Veuillez réessayer plus tard.`);
                }
            } else if (error.request) {
                console.error("Pas de réponse reçue");
                await sendMessage(senderId, "L'API ne répond pas. Elle est peut-être saturée ou en maintenance.");
            } else {
                console.error("Message:", error.message);
                if (error.code === 'ECONNABORTED') {
                    await sendMessage(senderId, "Le traitement a pris trop de temps (plus de 5 minutes). L'API est très lente actuellement.");
                } else {
                    await sendMessage(senderId, "Désolé, une erreur s'est produite lors du traitement de votre demande.");
                }
            }
        }
        return;
    }

    // Si l'utilisateur tape juste "nano"
    console.log(`Initialisation de nano pour ${senderId}`);
    await sendMessage(senderId, "Envoyez une image pour commencer la transformation.");
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "nano",
    description: "Transforme une image envoyée via l'API Nano Banana.",
    usage: "1. Tapez 'nano'\n2. Envoyez une image\n3. Donnez votre instruction (ex: 'changer en bleu')"
};
