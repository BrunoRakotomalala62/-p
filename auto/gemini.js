
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Fonction pour envoyer des messages longs en plusieurs parties si nécessaire
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000; // Limite de caractères par message Facebook

    if (message.length <= MAX_MESSAGE_LENGTH) {
        // Si le message est assez court, l'envoyer directement
        await sendMessage(senderId, message);
        return;
    }

    // Diviser le message en plusieurs parties intelligemment
    let startIndex = 0;
    
    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;
        
        // Si on n'est pas à la fin du message
        if (endIndex < message.length) {
            // Chercher le dernier séparateur (point, virgule, espace) avant la limite
            const separators = ['. ', ', ', ' ', '! ', '? ', '.\n', ',\n', '!\n', '?\n', '\n\n', '\n'];
            let bestBreakPoint = -1;
            
            // Chercher du point le plus proche de la fin jusqu'au début
            for (const separator of separators) {
                // Chercher le dernier séparateur dans la plage
                const lastSeparator = message.lastIndexOf(separator, endIndex);
                if (lastSeparator > startIndex && (bestBreakPoint === -1 || lastSeparator > bestBreakPoint)) {
                    bestBreakPoint = lastSeparator + separator.length;
                }
            }
            
            // Si un séparateur a été trouvé, utiliser ce point de coupure
            if (bestBreakPoint !== -1) {
                endIndex = bestBreakPoint;
            }
        } else {
            // Si c'est la dernière partie, prendre jusqu'à la fin
            endIndex = message.length;
        }
        
        // Extraire la partie du message
        const messagePart = message.substring(startIndex, endIndex);
        await sendMessage(senderId, messagePart);
        await new Promise(resolve => setTimeout(resolve, 1000));  // Pause de 1s entre chaque message
        
        // Passer à la partie suivante
        startIndex = endIndex;
    }
}

// Fonction pour détecter les mots-clés liés aux exercices
function detectExerciseKeywords(text) {
    const exerciseKeywords = [
        'exercice', 'problème', 'résoudre', 'équation', 'calcul', 'mathématiques',
        'exercise', 'problem', 'solve', 'equation', 'calculation', 'mathematics'
    ];
    
    const lowercaseText = text.toLowerCase();
    return exerciseKeywords.some(keyword => lowercaseText.includes(keyword));
}

// Fonction pour traiter les messages texte
async function handleTextMessage(senderId, message) {
    try {
        // Message d'attente
        sendMessage(senderId, "🇲🇬 ⏳ Generating...").catch(err => 
            console.error("Erreur lors de l'envoi du message d'attente:", err)
        );

        const prompt = message;
        const customId = senderId;
        
        // Vérifier si l'utilisateur a des images en attente
        if (pendingImages[senderId] && pendingImages[senderId].length > 0) {
            const imageUrl = pendingImages[senderId][pendingImages[senderId].length - 1]; // Prendre la dernière image
            
            try {
                // Analyser l'image avec la question de l'utilisateur
                const response = await axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                    link: imageUrl,
                    prompt: message,
                    customId: senderId
                });
                
                const reply = response.data.message;
                
                if (reply) {
                    await sendLongMessage(senderId, `Bruno : voici ma suggestion de réponse pour cette image :\n${reply}`);
                } else {
                    await sendMessage(senderId, "Je n'ai pas reçu de réponse valide pour l'image avec votre question.");
                }
                
                // Supprimer l'image de la liste des images en attente après avoir traité la question
                pendingImages[senderId].pop();
                return;
            } catch (imageError) {
                console.error('Erreur lors de l\'analyse de l\'image avec question :', imageError.response ? imageError.response.data : imageError.message);
                // Continuer à traiter le message comme un message texte normal en cas d'erreur
            }
        }
        
        // Traitement normal des messages texte si aucune image en attente ou en cas d'erreur
        const response = await axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
            prompt,
            customId
        });
        
        const reply = response.data.message;
        await sendLongMessage(senderId, reply);
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API :', error);
        await sendMessage(senderId, 'Désolé, une erreur s\'est produite lors du traitement de votre message.');
    }
}

// Stockage des images en attente de question
const pendingImages = {};

// Fonction pour traiter les images
async function handleImageMessage(senderId, imageUrl) {
    try {
        // Stocker l'URL de l'image pour cet utilisateur
        if (!pendingImages[senderId]) {
            pendingImages[senderId] = [];
        }
        pendingImages[senderId].push(imageUrl);
        
        // Envoyer un message d'attente et demander à l'utilisateur de poser une question
        await sendMessage(senderId, "J'ai bien reçu votre image. N'hésitez pas à me poser votre question à propos de cette image ou photo que vous avez envoyée.");
        
        // Ne pas analyser l'image immédiatement - attendre une question de l'utilisateur
    } catch (error) {
        console.error('Erreur lors du traitement de l\'image :', error.response ? error.response.data : error.message);
        await sendMessage(senderId, "J'ai bien reçu votre image. N'hésitez pas à me poser votre question à propos de cette image ou photo que vous avez envoyée.");
    }
}

module.exports = {
    handleTextMessage,
    handleImageMessage
};
