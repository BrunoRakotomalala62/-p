
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');
const fs = require('fs-extra');
const path = require('path');

// Stockage des images en attente par utilisateur pour la conversation continue
const pendingImages = {};

// Fonction pour télécharger une image et la sauvegarder localement
async function downloadImage(imageUrl, senderId) {
    try {
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'arraybuffer'
        });
        
        const tempDir = path.join(__dirname, '..', 'temp');
        await fs.ensureDir(tempDir);
        
        const imagePath = path.join(tempDir, `image_${senderId}_${Date.now()}.jpg`);
        await fs.writeFile(imagePath, response.data);
        
        // Retourner l'URL accessible publiquement
        // Assuming your server is running on port 5000
        const publicUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/temp/image_${senderId}_${Date.now()}.jpg`;
        
        return imagePath; // Retourner le chemin local pour l'instant
    } catch (error) {
        console.error('Erreur lors du téléchargement de l\'image:', error);
        throw error;
    }
}

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        const API_BASE_URL = 'https://rapido.zetsu.xyz/api/anthropic';
        const MODEL = 'claude-3-7-sonnet-20250219';
        
        // Vérifier si nous avons affaire à un attachement image
        if (imageAttachments && imageAttachments.length > 0) {
            // Récupérer l'URL de l'image
            const facebookImageUrl = imageAttachments[0].payload.url;
            
            // Envoyer un message d'attente
            await sendMessage(senderId, "📥 Téléchargement de l'image... ⏳");
            
            // Télécharger l'image localement
            const localImagePath = await downloadImage(facebookImageUrl, senderId);
            
            // Stocker le chemin local pour cet utilisateur
            pendingImages[senderId] = facebookImageUrl;
            
            // Question prédéfinie pour l'analyse automatique
            const predefinedQuestion = "Décrivez bien cette photo";
            
            // Envoyer un message d'attente
            await sendMessage(senderId, "🔍 Analyse automatique de votre image en cours... ⏳");
            
            // Pour l'instant, utiliser l'URL Facebook directement car l'API ne peut pas accéder aux fichiers locaux
            // Une solution serait d'héberger l'image sur un service externe ou de convertir en base64
            
            // Convertir l'image en base64
            const imageBuffer = await fs.readFile(localImagePath);
            const base64Image = imageBuffer.toString('base64');
            const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;
            
            // Construire l'URL de l'API avec la question prédéfinie et l'image en base64
            const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(predefinedQuestion)}&uid=${senderId}&model=${MODEL}&image=${encodeURIComponent(imageDataUrl)}`;
            
            // Appel à l'API
            const response = await axios.get(apiUrl);
            
            // Vérifier la structure de la réponse
            let reply;
            if (response.data && response.data.response) {
                reply = response.data.response;
            } else if (typeof response.data === 'string') {
                reply = response.data;
            } else {
                reply = JSON.stringify(response.data);
            }
            
            // Formater et envoyer la réponse automatique
            const formattedReply = `🇲🇬 Réponse AUTOMATIQUE✅\n${reply}`;
            
            // Gérer les messages longs
            await sendLongMessage(senderId, formattedReply);
            
            return { skipCommandCheck: true };
        }
        
        // Si le prompt est vide et qu'il n'y a pas d'image
        if ((!prompt || prompt.trim() === '') && !pendingImages[senderId]) {
            await sendMessage(senderId, "📸 Envoyez-moi une image pour que je l'analyse automatiquement !");
            return;
        }
        
        // Vérifier si nous avons une image en attente pour continuer la conversation
        if (!pendingImages[senderId]) {
            await sendMessage(senderId, "⚠️ Veuillez d'abord envoyer une image pour commencer l'analyse.");
            return;
        }
        
        // Envoyer un message d'attente
        await sendMessage(senderId, "🧠 Analyse en cours... ⏳");
        
        // Récupérer l'URL Facebook stockée
        const facebookImageUrl = pendingImages[senderId];
        
        // Télécharger à nouveau l'image pour la conversation continue
        const localImagePath = await downloadImage(facebookImageUrl, senderId);
        
        // Convertir l'image en base64
        const imageBuffer = await fs.readFile(localImagePath);
        const base64Image = imageBuffer.toString('base64');
        const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;
        
        // Construire l'URL de l'API avec la nouvelle question et l'image en base64
        const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(prompt)}&uid=${senderId}&model=${MODEL}&image=${encodeURIComponent(imageDataUrl)}`;
        
        // Appel à l'API pour la conversation continue
        const response = await axios.get(apiUrl);
        
        // Vérifier la structure de la réponse
        let reply;
        if (response.data && response.data.response) {
            reply = response.data.response;
        } else if (typeof response.data === 'string') {
            reply = response.data;
        } else {
            reply = JSON.stringify(response.data);
        }
        
        // Formater et envoyer la réponse
        const formattedReply = `🇲🇬 Réponse AUTOMATIQUE✅\n${reply}`;
        
        // Gérer les messages longs
        await sendLongMessage(senderId, formattedReply);
        
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Claude:", error);
        
        await sendMessage(senderId, `
⚠️ *ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de l'analyse de votre image.
Veuillez réessayer dans quelques instants.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }
    
    return { skipCommandCheck: true };
};

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

// Ajouter les informations de la commande
module.exports.info = {
    name: "cool",
    description: "Analyse automatiquement les images envoyées avec Claude AI et permet une conversation continue.",
    usage: "Envoyez une image pour une analyse automatique, puis posez des questions supplémentaires."
};
