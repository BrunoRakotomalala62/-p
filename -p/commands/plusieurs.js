
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage temporaire des conversations par utilisateur
const userConversations = new Map();

module.exports = async (senderId, args, attachments = []) => {
    try {
        const prompt = args.trim();
        
        // Vérifier s'il y a des images dans les pièces jointes
        // S'assurer que attachments est un tableau avant d'utiliser filter
        const imageAttachments = (Array.isArray(attachments) ? attachments : []).filter(att => 
            att.type === 'image' && att.payload && att.payload.url
        );

        // Si l'utilisateur envoie des images
        if (imageAttachments.length > 0) {
            // Message personnalisé selon le nombre d'images
            const imageCountText = imageAttachments.length === 1 
                ? "votre image" 
                : `vos ${imageAttachments.length} images`;
            
            // Stocker que cet utilisateur a des images en attente
            userConversations.set(senderId, {
                hasImages: true,
                imageCount: imageAttachments.length,
                imageUrls: imageAttachments.map(att => att.payload.url)
            });
            
            // Si l'utilisateur a aussi envoyé un prompt avec les images, traiter directement
            if (prompt && prompt.trim().length > 0) {
                await sendMessage(senderId, `📸 Analyse de ${imageAttachments.length} image(s) en cours...`);
                
                // Construire l'URL de l'API avec les images
                let apiUrl = `https://api-geminiplusieursphoto2026.vercel.app/gemini?pro=${encodeURIComponent(prompt)}`;
                
                // Ajouter chaque image à l'URL
                imageAttachments.forEach((att, index) => {
                    apiUrl += `&image${index + 1}=${encodeURIComponent(att.payload.url)}`;
                });
                
                // Ajouter l'UID de l'utilisateur
                apiUrl += `&uid=${senderId}`;
                
                // Faire l'appel à l'API
                const response = await axios.get(apiUrl, { timeout: 60000 });
                
                if (response.data && response.data.success && response.data.response) {
                    await sendMessage(senderId, `
━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 𝗔𝗡𝗔𝗟𝗬𝗦𝗘 𝗗'𝗜𝗠𝗔𝗚𝗘𝗦 ✨
━━━━━━━━━━━━━━━━━━━━━━━━━━

${response.data.response}

━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Images analysées: ${response.data.imagesCount}
✨ Nouvelles images: ${response.data.newImagesAdded}

💡 Vous pouvez continuer la conversation en envoyant d'autres questions sans renvoyer les images!
━━━━━━━━━━━━━━━━━━━━━━━━━━
                    `.trim());
                    
                    // Marquer que les images ont été traitées mais garder la session
                    userConversations.set(senderId, {
                        hasImages: false,
                        conversationActive: true
                    });
                } else {
                    await sendMessage(senderId, "❌ Aucune réponse reçue de l'API.");
                }
            } else {
                // Pas de question avec les images, demander à l'utilisateur
                await sendMessage(senderId, `📸 J'ai bien reçu ${imageCountText}, quelle est votre question concernant ${imageAttachments.length === 1 ? 'cette image' : 'ces images'} ?`);
            }
            
            return;
            
        } else if (prompt) {
            // L'utilisateur envoie une question
            
            // Vérifier si l'utilisateur a des images en attente
            const userSession = userConversations.get(senderId);
            
            if (userSession && userSession.hasImages) {
                // L'utilisateur a des images en attente, utiliser l'API avec images
                await sendMessage(senderId, `📸 Analyse de ${userSession.imageCount} image(s) en cours...`);
                
                // Construire l'URL de l'API avec les images
                let apiUrl = `https://api-geminiplusieursphoto2026.vercel.app/gemini?pro=${encodeURIComponent(prompt)}`;
                
                // Ajouter chaque image à l'URL
                userSession.imageUrls.forEach((url, index) => {
                    apiUrl += `&image${index + 1}=${encodeURIComponent(url)}`;
                });
                
                // Ajouter l'UID de l'utilisateur
                apiUrl += `&uid=${senderId}`;
                
                // Faire l'appel à l'API
                const response = await axios.get(apiUrl, { timeout: 60000 });
                
                if (response.data && response.data.success && response.data.response) {
                    await sendMessage(senderId, `
━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 𝗔𝗡𝗔𝗟𝗬𝗦𝗘 𝗗'𝗜𝗠𝗔𝗚𝗘𝗦 ✨
━━━━━━━━━━━━━━━━━━━━━━━━━━

${response.data.response}

━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Images analysées: ${response.data.imagesCount}
✨ Nouvelles images: ${response.data.newImagesAdded}

💡 Vous pouvez continuer la conversation en envoyant d'autres questions sans renvoyer les images!
━━━━━━━━━━━━━━━━━━━━━━━━━━
                    `.trim());
                    
                    // Marquer que les images ont été traitées mais garder la session
                    userConversations.set(senderId, {
                        hasImages: false,
                        conversationActive: true
                    });
                } else {
                    await sendMessage(senderId, "❌ Aucune réponse reçue de l'API.");
                }
                
            } else if (userSession && userSession.conversationActive) {
                // Conversation continue basée sur les images précédentes
                await sendMessage(senderId, "💭 Analyse de votre question en cours...");
                
                const apiUrl = `https://api-geminiplusieursphoto2026.vercel.app/gemini?pro=${encodeURIComponent(prompt)}&uid=${senderId}`;
                
                const response = await axios.get(apiUrl, { timeout: 60000 });
                
                if (response.data && response.data.success && response.data.response) {
                    let message = `
━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 𝗥É𝗣𝗢𝗡𝗦𝗘 𝗚𝗘𝗠𝗜𝗡𝗜 ✨
━━━━━━━━━━━━━━━━━━━━━━━━━━

${response.data.response}

━━━━━━━━━━━━━━━━━━━━━━━━━━
                    `.trim();
                    
                    if (response.data.imagesCount > 0) {
                        message += `\n📸 Contexte: ${response.data.imagesCount} image(s)`;
                    }
                    
                    await sendMessage(senderId, message);
                } else {
                    await sendMessage(senderId, "❌ Aucune réponse reçue de l'API.");
                }
                
            } else {
                // Question simple sans images (nouvelle conversation)
                await sendMessage(senderId, "🤔 Traitement de votre question...");
                
                const apiUrl = `https://api-geminiplusieursphoto2026.vercel.app/gemini?pro=${encodeURIComponent(prompt)}&uid=${senderId}`;
                
                const response = await axios.get(apiUrl, { timeout: 60000 });
                
                if (response.data && response.data.success && response.data.response) {
                    await sendMessage(senderId, `
━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 𝗥É𝗣𝗢𝗡𝗦𝗘 𝗚𝗘𝗠𝗜𝗡𝗜 ✨
━━━━━━━━━━━━━━━━━━━━━━━━━━

${response.data.response}

━━━━━━━━━━━━━━━━━━━━━━━━━━
                    `.trim());
                } else {
                    await sendMessage(senderId, "❌ Aucune réponse reçue de l'API.");
                }
            }
            
        } else {
            // Aucune image ni prompt fourni
            await sendMessage(senderId, `
━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️ 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗘 𝗣𝗟𝗨𝗦𝗜𝗘𝗨𝗥𝗦 ℹ️
━━━━━━━━━━━━━━━━━━━━━━━━━━

📸 𝗔𝗻𝗮𝗹𝘆𝘀𝗲𝗿 𝗱𝗲𝘀 𝗶𝗺𝗮𝗴𝗲𝘀:
Envoyez une ou plusieurs images, puis posez votre question.

💬 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻 𝗰𝗼𝗻𝘁𝗶𝗻𝘂𝗲:
Après avoir envoyé des images, vous pouvez poser d'autres questions sans les renvoyer.

❓ 𝗤𝘂𝗲𝘀𝘁𝗶𝗼𝗻 𝘀𝗶𝗺𝗽𝗹𝗲:
Envoyez "plusieurs <votre question>" pour obtenir une réponse.

𝗘𝘅𝗲𝗺𝗽𝗹𝗲𝘀:
• Envoyez des images
• Puis "décrivez bien ces photos" pour les analyser
• Puis "plus de détails" pour continuer
• Ou "plusieurs Bonjour" pour une conversation simple

━━━━━━━━━━━━━━━━━━━━━━━━━━
            `.trim());
        }
        
    } catch (error) {
        console.error('Erreur dans la commande plusieurs:', error);
        await sendMessage(senderId, `
━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━━━━━━━━

Une erreur s'est produite lors du traitement de votre demande.
Veuillez réessayer plus tard.

${error.message ? `Détails: ${error.message}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━
        `.trim());
    }
};

// Informations de la commande
module.exports.info = {
    name: "plusieurs",
    description: "Analyse plusieurs images avec Gemini AI et permet une conversation continue basée sur ces images.",
    usage: "Envoyez des images, puis posez votre question. Vous pouvez continuer la conversation sans renvoyer les images."
};
