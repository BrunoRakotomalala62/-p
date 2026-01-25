const axios = require('axios');
const sendMessage = require('../handles/sendMessage'); // Importer la fonction sendMessage

// Fonction pour découper un message en morceaux de moins de 2000 caractères
function splitMessage(text, maxLength = 2000) {
    const chunks = [];
    
    // Si le message est plus court que la limite, le retourner tel quel
    if (text.length <= maxLength) {
        return [text];
    }
    
    // Découper le texte en phrases ou paragraphes
    let currentChunk = '';
    const sentences = text.split(/(?<=[.!?])\s+/); // Découper par phrases
    
    for (const sentence of sentences) {
        // Si une seule phrase dépasse la limite, la découper par mots
        if (sentence.length > maxLength) {
            // Ajouter le chunk actuel s'il existe
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            
            // Découper la phrase trop longue par mots
            const words = sentence.split(' ');
            for (const word of words) {
                if ((currentChunk + ' ' + word).length > maxLength) {
                    chunks.push(currentChunk.trim());
                    currentChunk = word;
                } else {
                    currentChunk += (currentChunk ? ' ' : '') + word;
                }
            }
        } else {
            // Si l'ajout de cette phrase dépasse la limite, commencer un nouveau chunk
            if ((currentChunk + ' ' + sentence).length > maxLength) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }
    }
    
    // Ajouter le dernier chunk s'il existe
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks;
}

module.exports = async (senderId, prompt, uid) => { 
    try {
        // Envoyer un message de confirmation que le message a été reçu
        await sendMessage(senderId, "✨ Merci pour ta question ! Je prépare une réponse épique pour toi... ⏳🔍");

        // Construire l'URL de l'API pour résoudre la question avec UID
        const apiUrl = `https://norch-project.gleeze.com/api/Compound?prompt=${encodeURIComponent(prompt)}&uid=${uid}&name=Developer`;
        const response = await axios.get(apiUrl);

        // Récupérer la bonne clé dans la réponse de l'API
        const reply = response.data.reply;

        // Attendre 2 secondes avant d'envoyer la réponse
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Découper le message en morceaux si nécessaire
        const messageChunks = splitMessage(reply);
        
        // Envoyer chaque morceau successivement
        for (let i = 0; i < messageChunks.length; i++) {
            const chunk = messageChunks[i];
            
            // Ajouter un indicateur de partie si le message est découpé
            const prefix = messageChunks.length > 1 ? `📨 Partie ${i + 1}/${messageChunks.length}\n\n` : '';
            
            await sendMessage(senderId, prefix + chunk);
            
            // Attendre un peu entre chaque message pour éviter le spam (sauf pour le dernier)
            if (i < messageChunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Luffy AI:', error);

        // Envoyer un message d'erreur à l'utilisateur en cas de problème
        await sendMessage(senderId, "Désolé, une erreur s'est produite lors du traitement de votre message.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "luffy",  // Le nom de la commande
    description: "Pose ta question à Luffy AI pour obtenir une réponse détaillée.",  // Description de la commande
    usage: "Envoyez 'luffy <question>' pour poser une question à Luffy AI."  // Comment utiliser la commande
};
