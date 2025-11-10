const sendMessage = require('../handles/sendMessage');
const axios = require('axios');

// État pour chaque utilisateur
const userStates = {};

module.exports = async (senderId, prompt, api, attachments) => {
    try {
        // Initialiser l'état de l'utilisateur si nécessaire
        if (!userStates[senderId]) {
            userStates[senderId] = {
                step: 'waiting_for_image',
                imageUrl: null,
                transformPrompt: null
            };
        }

        const state = userStates[senderId];

        // Réinitialiser la conversation si demandé
        if (prompt === 'RESET_CONVERSATION') {
            userStates[senderId] = {
                step: 'waiting_for_image',
                imageUrl: null,
                transformPrompt: null
            };
            return;
        }

        // Étape 1: Utilisateur envoie une image
        if (prompt === 'IMAGE_ATTACHMENT' && attachments && attachments.length > 0) {
            const imageUrl = attachments[0].payload.url;
            state.imageUrl = imageUrl;
            state.step = 'waiting_for_prompt';
            
            await sendMessage(senderId, 
                "🖼️ J'ai bien reçu votre photo !\n\n" +
                "Quelle transformation souhaitez-vous appliquer à cette image ?\n\n" +
                "💡 Exemples :\n" +
                "• change the color into white\n" +
                "• make it look like a painting\n" +
                "• add a sunset background\n" +
                "• convert to black and white"
            );
            return;
        }

        // Étape 2: Utilisateur envoie le prompt de transformation
        if (state.step === 'waiting_for_prompt' && state.imageUrl) {
            // Le prompt est la transformation demandée
            const transformPrompt = prompt.trim();
            
            if (!transformPrompt || transformPrompt === '') {
                await sendMessage(senderId, 
                    "⚠️ Veuillez décrire la transformation que vous souhaitez appliquer à votre image."
                );
                return;
            }

            state.transformPrompt = transformPrompt;
            state.step = 'processing';

            // Message d'attente
            await sendMessage(senderId, 
                "🎨 Je vais transformer votre image selon votre demande...\n\n" +
                "⏳ Veuillez patienter, cela peut prendre quelques instants..."
            );

            try {
                // Appeler l'API Nano Banana
                const apiUrl = `https://norch-project.gleeze.com/api/gemini/nano-banana?prompt=${encodeURIComponent(transformPrompt)}&imageurl=${encodeURIComponent(state.imageUrl)}`;
                
                console.log(`Appel API Nano Banana avec l'URL: ${apiUrl}`);
                
                const response = await axios.get(apiUrl, {
                    timeout: 60000 // 60 secondes de timeout
                });

                if (response.data && response.data.result) {
                    const resultImageUrl = response.data.result;
                    
                    // Envoyer l'image transformée
                    await sendMessage(senderId, {
                        attachment: {
                            type: "image",
                            payload: {
                                url: resultImageUrl,
                                is_reusable: true
                            }
                        }
                    });

                    await sendMessage(senderId, 
                        "✅ Voici votre photo transformée !\n\n" +
                        "📸 Envoyez une autre image pour une nouvelle transformation, " +
                        "ou tapez 'stop' pour quitter."
                    );

                    // Réinitialiser pour une nouvelle transformation
                    state.step = 'waiting_for_image';
                    state.imageUrl = null;
                    state.transformPrompt = null;
                } else {
                    throw new Error("L'API n'a pas retourné de résultat valide");
                }

            } catch (error) {
                console.error('Erreur lors de la transformation d\'image:', error.message);
                
                await sendMessage(senderId, 
                    "🚨 Désolé, une erreur s'est produite lors de la transformation de votre image.\n\n" +
                    "Veuillez réessayer en envoyant une nouvelle image."
                );

                // Réinitialiser l'état
                state.step = 'waiting_for_image';
                state.imageUrl = null;
                state.transformPrompt = null;
            }
            return;
        }

        // Si l'utilisateur n'a pas encore envoyé d'image
        if (state.step === 'waiting_for_image') {
            await sendMessage(senderId, 
                "🖼️ Bienvenue dans Nano - Transformation d'images !\n\n" +
                "📷 Veuillez envoyer une image que vous souhaitez transformer.\n\n" +
                "💡 Une fois l'image reçue, je vous demanderai quelle transformation appliquer."
            );
            return;
        }

    } catch (error) {
        console.error('Erreur dans la commande nano:', error);
        await sendMessage(senderId, 
            "🚨 Une erreur inattendue s'est produite. Veuillez réessayer ou tapez 'stop' pour quitter."
        );
        
        // Réinitialiser l'état en cas d'erreur
        if (userStates[senderId]) {
            userStates[senderId] = {
                step: 'waiting_for_image',
                imageUrl: null,
                transformPrompt: null
            };
        }
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "nano",
    description: "Transforme vos images avec l'IA Gemini Nano Banana",
    usage: "nano (puis envoyez une image et décrivez la transformation souhaitée)"
};
