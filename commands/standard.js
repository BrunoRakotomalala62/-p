const axios = require('axios');
const sendMessage = require('../handles/sendMessage');
const FormData = require('form-data');

// Stockage des conversations par utilisateur
const conversationHistory = new Map();
const pendingImages = {};

// Fonction pour uploader une image vers Catbox
async function uploadImageToCatbox(imageUrl) {
    try {
        console.log('📥 Téléchargement de l\'image depuis:', imageUrl);

        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            maxContentLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const imageBuffer = Buffer.from(imageResponse.data);
        console.log('✅ Image téléchargée, taille:', imageBuffer.length, 'bytes');

        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', imageBuffer, {
            filename: 'image.jpg',
            contentType: imageResponse.headers['content-type'] || 'image/jpeg'
        });

        console.log('📤 Upload vers catbox.moe...');
        const uploadResponse = await axios.post('https://catbox.moe/user/api.php', formData, {
            headers: formData.getHeaders(),
            timeout: 30000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        const publicUrl = uploadResponse.data.trim();

        if (!publicUrl.startsWith('https://')) {
            console.error('❌ Réponse invalide de catbox:', publicUrl);
            throw new Error('Service d\'hébergement indisponible');
        }

        console.log('✅ Image uploadée avec succès:', publicUrl);
        return publicUrl;
    } catch (error) {
        console.error('❌ Erreur lors de l\'upload de l\'image:', error.message);
        throw new Error(`Impossible d'uploader l'image: ${error.message}`);
    }
}

// Fonction pour convertir le texte avec des caractères unicode stylisés
function formatWithUnicode(text) {
    // Remplacer les titres markdown (#, ##, ###) par des caractères unicode et emojis
    text = text.replace(/^### (.+)$/gm, '┃ ⚡ $1 ⚡');
    text = text.replace(/^## (.+)$/gm, '╔═══ 🌟 $1 🌟 ═══╗');
    text = text.replace(/^# (.+)$/gm, '╔══════ ✨ $1 ✨ ══════╗');
    
    // Améliorer les listes
    text = text.replace(/^\* (.+)$/gm, '  ◈ $1');
    text = text.replace(/^- (.+)$/gm, '  ◆ $1');
    text = text.replace(/^• (.+)$/gm, '  ⦿ $1');
    
    // Améliorer les numéros
    text = text.replace(/^(\d+)\. (.+)$/gm, '  ➤ $2');
    
    return text;
}

// Fonction pour ajouter des emojis contextuels
function addContextualEmojis(text) {
    // Ajouter des emojis basés sur le contexte
    const emojiPatterns = [
        { pattern: /(important|essentiel|crucial|vital)/gi, emoji: ' ⚠️' },
        { pattern: /(succès|réussi|correct|bien|excellent)/gi, emoji: ' ✅' },
        { pattern: /(erreur|faux|incorrect|problème)/gi, emoji: ' ❌' },
        { pattern: /(information|info|note|remarque)/gi, emoji: ' ℹ️' },
        { pattern: /(astuce|conseil|tip|suggestion)/gi, emoji: ' 💡' },
        { pattern: /(attention|warning|avertissement)/gi, emoji: ' ⚡' },
        { pattern: /(exemple|example|par exemple)/gi, emoji: ' 📌' },
        { pattern: /(question|pourquoi|comment|quoi)/gi, emoji: ' ❓' },
        { pattern: /(réponse|answer|solution)/gi, emoji: ' 💬' },
        { pattern: /(code|programmation|script)/gi, emoji: ' 💻' },
        { pattern: /(fichier|file|document)/gi, emoji: ' 📄' },
        { pattern: /(image|photo|picture)/gi, emoji: ' 🖼️' },
        { pattern: /(temps|time|date|heure)/gi, emoji: ' ⏰' },
        { pattern: /(monde|world|global)/gi, emoji: ' 🌍' },
        { pattern: /(science|scientifique|research)/gi, emoji: ' 🔬' },
        { pattern: /(livre|book|lecture)/gi, emoji: ' 📚' },
        { pattern: /(musique|music|chanson)/gi, emoji: ' 🎵' },
        { pattern: /(art|artistic|créatif)/gi, emoji: ' 🎨' },
        { pattern: /(santé|health|médical)/gi, emoji: ' 🏥' },
        { pattern: /(nourriture|food|cuisine)/gi, emoji: ' 🍽️' }
    ];

    // Appliquer les emojis sans dupliquer
    let processedText = text;
    emojiPatterns.forEach(({ pattern, emoji }) => {
        processedText = processedText.replace(pattern, (match) => {
            return match + emoji;
        });
    });

    return processedText;
}

// Fonction pour formater magnifiquement la réponse
function beautifyResponse(response) {
    let formatted = response;
    
    // Appliquer le formatage unicode
    formatted = formatWithUnicode(formatted);
    
    // Ajouter des emojis contextuels
    formatted = addContextualEmojis(formatted);
    
    // Améliorer les séparateurs
    formatted = formatted.replace(/---+/g, '━━━━━━━━━━━━━━━━━━');
    formatted = formatted.replace(/===+/g, '═══════════════════');
    formatted = formatted.replace(/___+/g, '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬');
    
    return formatted;
}

// Fonction pour la conversation avec texte seulement (avec uid pour conversation continue)
async function chatText(prompt, uid) {
    try {
        const API_ENDPOINT = "https://norch-project.gleeze.com/api/gemini";
        
        const queryParams = new URLSearchParams({
            prompt: prompt,
            uid: uid
        });

        const response = await axios.get(`${API_ENDPOINT}?${queryParams.toString()}`);
        const result = response.data;

        if (!result || !result.response) {
            throw new Error('Aucune réponse reçue de l\'API');
        }

        return result.response;
    } catch (error) {
        console.error('Erreur chat Standard AI:', error);
        throw error;
    }
}

// Fonction pour la conversation avec image (avec uid pour conversation continue)
async function chatWithImage(prompt, imageUrl, uid) {
    try {
        const API_ENDPOINT = "https://norch-project.gleeze.com/api/gemini";
        
        const queryParams = new URLSearchParams({
            prompt: prompt,
            imageurl: imageUrl,
            uid: uid
        });

        const response = await axios.get(`${API_ENDPOINT}?${queryParams.toString()}`);
        const result = response.data;

        if (!result || !result.response) {
            throw new Error('Aucune réponse reçue de l\'API');
        }

        return result.response;
    } catch (error) {
        console.error('Erreur chat avec image Standard AI:', error);
        throw error;
    }
}

// Fonction pour envoyer des messages longs en plusieurs parties
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000;

    if (message.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }

    let startIndex = 0;

    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;

        if (endIndex < message.length) {
            const separators = ['. ', ', ', ' ', '! ', '? ', '.\n', ',\n', '!\n', '?\n', '\n\n', '\n'];
            let bestBreakPoint = -1;

            for (const separator of separators) {
                const lastSeparator = message.lastIndexOf(separator, endIndex);
                if (lastSeparator > startIndex && (bestBreakPoint === -1 || lastSeparator > bestBreakPoint)) {
                    bestBreakPoint = lastSeparator + separator.length;
                }
            }

            if (bestBreakPoint !== -1) {
                endIndex = bestBreakPoint;
            }
        } else {
            endIndex = message.length;
        }

        const messagePart = message.substring(startIndex, endIndex);
        await sendMessage(senderId, messagePart);
        await new Promise(resolve => setTimeout(resolve, 1000));

        startIndex = endIndex;
    }
}

// Fonction principale pour gérer les images
async function handleImageMessage(senderId, imageUrl) {
    try {
        await sendMessage(senderId, "⏳ 🖼️ Traitement de votre image en cours... ✨");

        console.log('🖼️ Réception image pour utilisateur:', senderId);
        console.log('📍 URL originale:', imageUrl);

        let publicImageUrl;
        try {
            publicImageUrl = await uploadImageToCatbox(imageUrl);
            console.log('✅ URL publique créée:', publicImageUrl);
        } catch (uploadError) {
            console.error('❌ Erreur upload catbox:', uploadError);
            await sendMessage(senderId, "❌ Désolé, je n'ai pas pu traiter votre image. Veuillez réessayer.");
            return;
        }

        // Initialiser le tableau d'images si nécessaire
        if (!pendingImages[senderId]) {
            pendingImages[senderId] = [];
        }

        // Ajouter l'image
        pendingImages[senderId].push(publicImageUrl);

        // Initialiser l'historique si nécessaire
        if (!conversationHistory.has(senderId)) {
            conversationHistory.set(senderId, {
                messages: [],
                hasImage: false,
                imageUrl: null
            });
        }

        const userHistory = conversationHistory.get(senderId);
        userHistory.hasImage = true;
        userHistory.imageUrl = publicImageUrl;

        await sendMessage(senderId, `
╔══════════════════════════════╗
    ✨ IMAGE REÇUE! 📸
╚══════════════════════════════╝

✅ J'ai bien reçu votre image!

💬 Que voulez-vous savoir à propos de cette photo?
🔍 Posez-moi votre question!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

    } catch (error) {
        console.error('Erreur lors du traitement de l\'image :', error.response ? error.response.data : error.message);
        await sendMessage(senderId, "❌ Une erreur s'est produite lors du traitement de votre image. Veuillez réessayer.");
    }
}

// Fonction principale exportée - appelée par le système de commandes
module.exports = async function(senderId, commandPrompt, api) {
    try {
        // Gestion spéciale pour les images envoyées via le système
        if (commandPrompt === "IMAGE_ATTACHMENT" && api) {
            const imageAttachments = arguments[3];
            if (imageAttachments && imageAttachments.length > 0) {
                for (const image of imageAttachments) {
                    await handleImageMessage(senderId, image.payload.url);
                }
                return;
            }
        }

        // Initialiser l'historique si nécessaire
        if (!conversationHistory.has(senderId)) {
            conversationHistory.set(senderId, {
                messages: [],
                hasImage: false,
                imageUrl: null
            });
        }

        const userHistory = conversationHistory.get(senderId);

        // Commande pour réinitialiser la conversation
        if (commandPrompt && commandPrompt.toLowerCase() === 'clear') {
            conversationHistory.delete(senderId);
            delete pendingImages[senderId];
            await sendMessage(senderId, "🔄 ✨ Conversation réinitialisée avec succès! Prêt pour une nouvelle discussion! 🌟");
            return;
        }

        // Vérifier si on a des images en attente
        const hasImages = pendingImages[senderId] && pendingImages[senderId].length > 0;
        
        if ((!commandPrompt || commandPrompt.trim() === '') && !hasImages && !userHistory.hasImage) {
            await sendMessage(senderId, `
╔══════════════════════════════╗
    ✨ STANDARD AI 🌟
╚══════════════════════════════╝

Bienvenue! 👋 Je suis votre assistant intelligent.

💬 Posez-moi n'importe quelle question
🖼️ Partagez une image pour l'analyser
🔄 Tapez "clear" pour réinitialiser

Comment puis-je vous aider aujourd'hui? 😊
            `);
            return;
        }

        // Message d'attente
        await sendMessage(senderId, "⏳ ✨ Analyse en cours... Standard AI réfléchit! 💭✨");

        let response;
        let imageUrl = pendingImages[senderId]?.[0] || userHistory.imageUrl;

        // Si on a une image
        if (imageUrl) {
            try {
                response = await chatWithImage(commandPrompt || "Décrivez cette image", imageUrl, senderId);
                userHistory.hasImage = true;
                userHistory.imageUrl = imageUrl;
            } catch (error) {
                console.error("Erreur lors de l'appel à chatWithImage:", error);
                response = "❌ Désolé, je n'ai pas pu traiter votre image. Assurez-vous que l'URL de l'image est accessible publiquement.";
                delete pendingImages[senderId];
                userHistory.imageUrl = null;
                userHistory.hasImage = false;
            }
        } else {
            // Conversation texte seulement
            try {
                response = await chatText(commandPrompt, senderId);
                userHistory.hasImage = false;
                userHistory.imageUrl = null;
            } catch (error) {
                console.error("Erreur lors de l'appel à chatText:", error);
                response = "❌ Désolé, je n'ai pas pu traiter votre demande.";
            }
        }

        if (!response) {
            await sendMessage(senderId, "⚠️ Aucune réponse reçue de l'API.");
            return;
        }

        // Formater magnifiquement la réponse
        const beautifiedResponse = beautifyResponse(response);

        // Créer le message final formaté
        const formattedResponse = `
╔══════════════════════════════╗
  ✨ STANDARD AI 🌟 RÉPONSE
╚══════════════════════════════╝

${beautifiedResponse}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 Powered by Standard AI ✨
💡 Tapez "clear" pour recommencer
`;

        // Envoyer la réponse formatée
        await sendLongMessage(senderId, formattedResponse);

        // Supprimer les images en attente après traitement
        if (pendingImages[senderId]) {
            delete pendingImages[senderId];
        }

    } catch (error) {
        console.error("❌ Erreur Standard AI:", error?.response?.data || error.message || error);
        await sendMessage(senderId, `
╔══════════════════════════════╗
    ⚠️ ERREUR TECHNIQUE ⚠️
╚══════════════════════════════╝

Une erreur s'est produite lors de la communication avec Standard AI.

🔄 Veuillez réessayer dans quelques instants.
💡 Si le problème persiste, tapez "clear"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
    }
};
