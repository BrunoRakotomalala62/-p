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
                originalImageUrl: null,
                currentImageUrl: null,
                transformCount: 0
            };
        }

        const state = userStates[senderId];

        // Réinitialiser la conversation si demandé
        if (prompt === 'RESET_CONVERSATION') {
            userStates[senderId] = {
                step: 'waiting_for_image',
                originalImageUrl: null,
                currentImageUrl: null,
                transformCount: 0
            };
            return;
        }

        // Étape 1: Utilisateur envoie une NOUVELLE image
        if (prompt === 'IMAGE_ATTACHMENT' && attachments && attachments.length > 0) {
            const imageUrl = attachments[0].payload.url;
            
            // Réinitialiser complètement pour une nouvelle image
            state.originalImageUrl = imageUrl;
            state.currentImageUrl = imageUrl;
            state.step = 'waiting_for_prompt';
            state.transformCount = 0;
            
            await sendMessage(senderId, 
                "🖼️ J'ai bien reçu votre nouvelle photo !\n\n" +
                "Quelle transformation souhaitez-vous appliquer à cette image ?\n\n" +
                "💡 Exemples :\n" +
                "• changer en bleu le vêtement\n" +
                "• changer en portant une chemise blanche\n" +
                "• changer en costume son vêtement\n" +
                "• make it look like a painting\n" +
                "• add a sunset background\n\n" +
                "✨ Vous pourrez ensuite continuer à transformer l'image résultante !"
            );
            return;
        }

        // Étape 2 & Suite: Utilisateur envoie un prompt de transformation
        if ((state.step === 'waiting_for_prompt' || state.step === 'ready_for_next') && state.currentImageUrl) {
            // Le prompt est la transformation demandée
            const transformPrompt = prompt.trim();
            
            if (!transformPrompt || transformPrompt === '') {
                await sendMessage(senderId, 
                    "⚠️ Veuillez décrire la transformation que vous souhaitez appliquer à votre image."
                );
                return;
            }

            state.step = 'processing';
            state.transformCount++;

            // Message d'attente
            await sendMessage(senderId, 
                `🎨 Transformation ${state.transformCount} en cours...\n\n` +
                "⏳ Veuillez patienter, cela peut prendre quelques instants..."
            );

            try {
                // Appeler l'API Nano Banana avec l'image actuelle
                const apiUrl = `https://norch-project.gleeze.com/api/gemini/nano-banana?prompt=${encodeURIComponent(transformPrompt)}&imageurl=${encodeURIComponent(state.currentImageUrl)}`;
                
                console.log(`Appel API Nano Banana (transformation ${state.transformCount}) avec l'URL: ${apiUrl}`);
                
                const response = await axios.get(apiUrl, {
                    timeout: 60000 // 60 secondes de timeout
                });

                if (response.data && response.data.result) {
                    const resultImageUrl = response.data.result;
                    
                    // Mettre à jour l'image courante avec le résultat
                    state.currentImageUrl = resultImageUrl;
                    state.step = 'ready_for_next';
                    
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
                        `✅ Voici votre photo transformée ! (Transformation ${state.transformCount})\n\n` +
                        "💬 Vous pouvez :\n" +
                        "• Continuer à transformer cette image en décrivant une nouvelle modification\n" +
                        "• Envoyer une nouvelle photo pour recommencer\n" +
                        "• Taper 'stop' pour quitter"
                    );

                } else {
                    throw new Error("L'API n'a pas retourné de résultat valide");
                }

            } catch (error) {
                console.error('Erreur lors de la transformation d\'image:', error.message);
                
                await sendMessage(senderId, 
                    "🚨 Désolé, une erreur s'est produite lors de la transformation de votre image.\n\n" +
                    "💡 Vous pouvez :\n" +
                    "• Réessayer avec une autre description\n" +
                    "• Envoyer une nouvelle photo"
                );

                // Remettre l'état à ready_for_next pour permettre un nouvel essai
                state.step = 'ready_for_next';
                state.transformCount--;
            }
            return;
        }

        // Si l'utilisateur n'a pas encore envoyé d'image
        if (state.step === 'waiting_for_image') {
            await sendMessage(senderId, 
                "🖼️ Bienvenue dans Nano - Transformation d'images !\n\n" +
                "📷 Veuillez envoyer une image que vous souhaitez transformer.\n\n" +
                "💡 Une fois l'image reçue, vous pourrez :\n" +
                "• Appliquer une première transformation\n" +
                "• Puis continuer à transformer l'image résultante\n" +
                "• Enchaîner autant de transformations que vous voulez !\n\n" +
                "Exemples de transformations :\n" +
                "• changer en bleu le vêtement\n" +
                "• changer en portant une chemise blanche\n" +
                "• changer en costume son vêtement"
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
                originalImageUrl: null,
                currentImageUrl: null,
                transformCount: 0
            };
        }
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "nano",
    description: "Transforme vos images avec l'IA Gemini Nano Banana - Transformations successives possibles !",
    usage: "nano (puis envoyez une image et décrivez les transformations successives)"
};
