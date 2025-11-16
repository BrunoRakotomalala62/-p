const sendMessage = require('../handles/sendMessage');
const axios = require('axios');

// État pour chaque utilisateur
const userStates = {};

// Délai minimum entre deux requêtes (en millisecondes)
const MIN_REQUEST_DELAY = 3000; // 3 secondes

module.exports = async (senderId, prompt, api, attachments) => {
    try {
        // Initialiser l'état de l'utilisateur si nécessaire
        if (!userStates[senderId]) {
            userStates[senderId] = {
                step: 'waiting_for_image',
                originalImageUrl: null,
                currentImageUrl: null,
                previousImageUrl: null, // Stocker l'image précédente
                transformCount: 0,
                lastRequestTime: 0,
                isProcessing: false
            };
        }

        const state = userStates[senderId];

        // Vérifier si une requête est déjà en cours
        if (state.isProcessing && prompt !== 'IMAGE_ATTACHMENT' && prompt !== 'RESET_CONVERSATION') {
            await sendMessage(senderId, 
                "⏳ Une transformation est déjà en cours, veuillez patienter...\n\n" +
                "💡 Votre demande sera traitée dès que la transformation actuelle sera terminée."
            );
            return;
        }

        // Réinitialiser la conversation si demandé
        if (prompt === 'RESET_CONVERSATION') {
            userStates[senderId] = {
                step: 'waiting_for_image',
                originalImageUrl: null,
                currentImageUrl: null,
                previousImageUrl: null,
                transformCount: 0,
                lastRequestTime: 0,
                isProcessing: false
            };
            return;
        }

        // Étape 1: Utilisateur envoie une NOUVELLE image
        if (prompt === 'IMAGE_ATTACHMENT' && attachments && attachments.length > 0) {
            const imageUrl = attachments[0].payload.url;
            
            // Stocker l'image actuelle comme image précédente avant de la remplacer
            if (state.currentImageUrl) {
                state.previousImageUrl = state.currentImageUrl;
            }
            
            // Mettre à jour avec la nouvelle image
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

            // Vérifier le délai minimum entre les requêtes
            const now = Date.now();
            const timeSinceLastRequest = now - state.lastRequestTime;
            
            if (timeSinceLastRequest < MIN_REQUEST_DELAY && state.lastRequestTime > 0) {
                const remainingTime = Math.ceil((MIN_REQUEST_DELAY - timeSinceLastRequest) / 1000);
                await sendMessage(senderId, 
                    `⏱️ Veuillez patienter encore ${remainingTime} seconde(s) avant d'envoyer une nouvelle demande.\n\n` +
                    "💡 Cela permet d'éviter la surcharge de l'API et d'assurer une meilleure qualité de transformation."
                );
                return;
            }

            // Détecter si l'utilisateur veut utiliser les deux photos
            const wantsTwoPhotos = /pour\s+(les|ces)\s+deux\s+photos?|les\s+deux\s+images?|combine|collage|deux\s+photos?/i.test(transformPrompt);
            
            // Vérifier si on a deux photos disponibles
            const hasTwoPhotos = state.previousImageUrl && state.currentImageUrl && state.previousImageUrl !== state.currentImageUrl;

            state.step = 'processing';
            state.isProcessing = true;
            state.transformCount++;
            state.lastRequestTime = now;

            // Message d'attente adapté
            if (wantsTwoPhotos && hasTwoPhotos) {
                await sendMessage(senderId, 
                    `🎨 Transformation de ces deux images en cours...\n\n` +
                    "⏳ Veuillez patienter, cela peut prendre quelques instants..."
                );
            } else {
                await sendMessage(senderId, 
                    `🎨 Transformation ${state.transformCount} en cours...\n\n` +
                    "⏳ Veuillez patienter, cela peut prendre quelques instants..."
                );
            }

            try {
                let apiUrl;
                
                // Si l'utilisateur veut utiliser deux photos ET qu'elles sont disponibles
                if (wantsTwoPhotos && hasTwoPhotos) {
                    // API pour combiner deux images
                    apiUrl = `https://norch-project.gleeze.com/api/gemini/nano-banana?prompt=${encodeURIComponent(transformPrompt)}&imageurl=${encodeURIComponent(state.previousImageUrl)}&imageurl2=${encodeURIComponent(state.currentImageUrl)}`;
                    console.log(`Appel API Nano Banana avec DEUX images (transformation ${state.transformCount})`);
                } else {
                    // Si l'utilisateur demande deux photos mais qu'il n'y en a qu'une
                    if (wantsTwoPhotos && !hasTwoPhotos) {
                        await sendMessage(senderId, 
                            "⚠️ Vous n'avez envoyé qu'une seule photo pour le moment.\n\n" +
                            "Je vais transformer uniquement cette photo. Pour utiliser deux photos, envoyez une deuxième image avant de faire votre demande."
                        );
                    }
                    
                    // API normale avec une seule image
                    apiUrl = `https://norch-project.gleeze.com/api/gemini/nano-banana?prompt=${encodeURIComponent(transformPrompt)}&imageurl=${encodeURIComponent(state.currentImageUrl)}`;
                    console.log(`Appel API Nano Banana avec UNE image (transformation ${state.transformCount})`);
                }
                
                console.log(`URL de l'API: ${apiUrl}`);
                
                const response = await axios.get(apiUrl, {
                    timeout: 60000 // 60 secondes de timeout
                });

                if (response.data && response.data.result) {
                    const resultImageUrl = response.data.result;
                    
                    // Mettre à jour l'image courante avec le résultat
                    state.currentImageUrl = resultImageUrl;
                    state.step = 'ready_for_next';
                    state.isProcessing = false;
                    
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
                
                // Déterminer le type d'erreur pour un message plus précis
                let errorMessage = "🚨 Désolé, une erreur s'est produite lors de la transformation de votre image.\n\n";
                
                if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                    errorMessage = "⏱️ La transformation a pris trop de temps et a expiré.\n\n";
                } else if (error.response && error.response.status === 429) {
                    errorMessage = "🚫 Trop de requêtes ont été envoyées. Veuillez patienter un moment.\n\n";
                }
                
                await sendMessage(senderId, 
                    errorMessage +
                    "💡 Vous pouvez :\n" +
                    "• Réessayer avec une autre description\n" +
                    "• Envoyer une nouvelle photo\n" +
                    "• Attendre quelques secondes avant de réessayer"
                );

                // Remettre l'état à ready_for_next pour permettre un nouvel essai
                state.step = 'ready_for_next';
                state.isProcessing = false;
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
                transformCount: 0,
                lastRequestTime: 0,
                isProcessing: false
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
