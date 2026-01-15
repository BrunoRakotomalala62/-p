const sendMessage = require('../handles/sendMessage');
const axios = require('axios');
const FormData = require('form-data');

// État pour chaque utilisateur
const userStates = {};

// Fonction pour uploader l'image sur catbox
async function uploadImageToCatbox(imageBuffer) {
    try {
        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', imageBuffer, {
            filename: 'transformed.jpg',
            contentType: 'image/jpeg'
        });

        const uploadResponse = await axios.post('https://catbox.moe/user/api.php', formData, {
            headers: formData.getHeaders(),
            timeout: 30000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        const publicUrl = uploadResponse.data.trim();
        console.log('✅ Image uploadée sur catbox:', publicUrl);
        return publicUrl;
    } catch (error) {
        console.error('❌ Erreur lors de l\'upload catbox:', error.message);
        throw error;
    }
}

// Délai minimum entre deux requêtes (en millisecondes)
const MIN_REQUEST_DELAY = 3000; // 3 secondes

module.exports = async (senderId, prompt, api, attachments) => {
    try {
        // Initialiser l'état de l'utilisateur si nécessaire
        if (!userStates[senderId]) {
            userStates[senderId] = {
                step: 'waiting_for_image',
                images: [], // Tableau pour stocker plusieurs images dans l'ordre
                currentImageUrl: null,
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
                images: [],
                currentImageUrl: null,
                transformCount: 0,
                lastRequestTime: 0,
                isProcessing: false
            };
            return;
        }

        // Étape 1: Utilisateur envoie des NOUVELLES images
        if (prompt === 'IMAGE_ATTACHMENT' && attachments && attachments.length > 0) {
            // Extraire toutes les images des attachments
            const newImages = attachments
                .filter(att => att.type === 'image')
                .map(att => att.payload.url);
            
            // Stocker toutes les images dans l'ordre
            state.images = newImages;
            state.currentImageUrl = newImages[0]; // La première image devient l'image actuelle
            state.step = 'waiting_for_prompt';
            state.transformCount = 0;
            
            // Message adapté selon le nombre d'images
            if (newImages.length === 1) {
                await sendMessage(senderId, 
                    "🖼️ J'ai bien reçu votre photo !\n\n" +
                    "Quelle transformation souhaitez-vous appliquer ?\n\n" +
                    "💡 Exemples :\n" +
                    "• changer en bleu le vêtement\n" +
                    "• changer en portant une chemise blanche\n" +
                    "• make it look like a painting\n" +
                    "• add a sunset background"
                );
            } else {
                await sendMessage(senderId, 
                    `🖼️ J'ai bien reçu vos ${newImages.length} photos !\n\n` +
                    "Quelle transformation souhaitez-vous appliquer ?\n\n" +
                    "💡 Exemples avec plusieurs images :\n" +
                    "• mettre en collage\n" +
                    "• fusionner les arrière-plans\n" +
                    "• changer le visage de la 1ère photo par celui de la 2ème\n" +
                    "• combiner toutes les photos en une seule\n" +
                    "• créer un montage artistique\n\n" +
                    "📌 Les images sont dans l'ordre : 1ère, 2ème, 3ème..."
                );
            }
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

            // Déterminer le nombre d'images disponibles
            const numberOfImages = state.images.length;
            
            state.step = 'processing';
            state.isProcessing = true;
            state.transformCount++;
            state.lastRequestTime = now;

            // Message d'attente adapté
            if (numberOfImages > 1) {
                await sendMessage(senderId, 
                    `🎨 Transformation de vos ${numberOfImages} images en cours...\n\n` +
                    "⏳ Veuillez patienter, cela peut prendre quelques instants..."
                );
            } else {
                await sendMessage(senderId, 
                    `🎨 Transformation ${state.transformCount} en cours...\n\n` +
                    "⏳ Veuillez patienter, cela peut prendre quelques instants..."
                );
            }

            try {
                // Utiliser la nouvelle API Nano Banana
                const apiUrl = `https://nano-banana-api-five.vercel.app/nanobanana?prompt=${encodeURIComponent(transformPrompt)}&image=${encodeURIComponent(state.images[0])}&s&uid=${senderId}`;
                
                console.log(`Appel API Nano: ${apiUrl}`);
                
                const response = await axios.get(apiUrl, {
                    timeout: 180000 // 3 minutes
                });

                if (response.data && response.data.resultats_url) {
                    const resultImageUrl = response.data.resultats_url;
                    console.log('✅ Image générée par l\'API:', resultImageUrl);

                    // Mettre à jour l'image courante avec le résultat
                    state.currentImageUrl = resultImageUrl;
                    state.step = 'ready_for_next';
                    state.isProcessing = false;
                    
                    // Envoyer l'image transformée en pièce jointe
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

                } else if (response.data && response.data.error) {
                    console.error('Erreur retournée par l\'API:', response.data.error);
                    throw new Error(`L'API a retourné une erreur: ${response.data.error}`);
                } else {
                    console.error('Réponse API invalide:', response.data);
                    throw new Error("L'API n'a pas retourné de résultat valide");
                }

            } catch (error) {
                console.error('Erreur lors de la transformation d\'image:', error.message);
                if (error.response) {
                    console.error('API Response Status:', error.response.status);
                    console.error('API Response Data:', JSON.stringify(error.response.data));
                }
                
                // Déterminer le type d'erreur pour un message plus précis
                let errorMessage = "🚨 Désolé, une erreur s'est produite lors de la transformation de votre image.\n\n";
                
                if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                    errorMessage = "⏱️ La transformation a pris trop de temps et a expiré.\n\n";
                } else if (error.response && error.response.status === 429) {
                    errorMessage = "🚫 Trop de requêtes ont été envoyées. Veuillez patienter un moment.\n\n";
                } else if (error.response && error.response.status === 404) {
                    errorMessage = "❌ L'API n'a pas trouvé l'endpoint. Veuillez vérifier la configuration.\n\n";
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
