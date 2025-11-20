
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');
const {
    sendLongMessage,
    formatTononkaloHeader,
    formatTononkaloDetails,
    formatInstruction,
    addContextualEmojis
} = require('../utils/messageFormatter');

// Stockage de l'historique de conversation pour chaque utilisateur
const conversationHistory = {};

module.exports = async (senderId, args) => {
    try {
        console.log('Commande poesie appelée avec args:', args);
        // Gérer le cas où args est une chaîne de caractères ou un tableau
        const userInput = typeof args === 'string' ? args.trim() : (Array.isArray(args) ? args.join(' ').trim() : '');
        console.log('Input utilisateur:', userInput);

        if (!userInput) {
            return sendMessage(senderId, 
                "❌ Veuillez fournir un mot-clé pour rechercher des poèmes.\n\n" +
                "📝 Exemple: poesie fitiavana\n\n" +
                "💡 Mots-clés populaires:\n" +
                "❤️ fitiavana (amour)\n" +
                "💙 alahelo (tristesse)\n" +
                "😄 hafaliana (joie)\n" +
                "🌟 fiainana (vie)\n" +
                "🌻 voninkazo (fleurs)"
            );
        }

        // Vérifier si l'utilisateur demande une page spécifique (ex: "page 2", "page 3")
        const pageMatch = userInput.match(/^page\s+(\d+)$/i);
        
        if (pageMatch) {
            const pageNumber = parseInt(pageMatch[1]);
            
            if (!conversationHistory[senderId]) {
                return sendMessage(senderId, "❌ Veuillez d'abord effectuer une recherche avant de demander une page spécifique.\nExemple: poesie fitiavana");
            }
            
            const keyword = conversationHistory[senderId].keyword;
            
            // Appel à l'API pour la page demandée
            const searchUrl = `https://tonontako-audio.vercel.app/recherche?tononkalo=${encodeURIComponent(keyword)}&page=${pageNumber}`;
            console.log('URL de recherche pour page:', searchUrl);
            
            const searchResponse = await axios.get(searchUrl);
            const searchData = searchResponse.data;

            if (!searchData || !searchData.Reponse) {
                return sendMessage(senderId, `❌ Aucun résultat trouvé pour la page ${pageNumber}.`);
            }

            // Mettre à jour l'historique avec la nouvelle page
            conversationHistory[senderId].page = pageNumber;
            conversationHistory[senderId].timestamp = Date.now();

            // Formater et envoyer la liste des résultats
            const header = formatTononkaloHeader(keyword, pageNumber, 'poesie');
            const fullMessage = header + searchData.Reponse + formatInstruction();
            
            await sendLongMessage(senderId, fullMessage);
            return;
        }
        
        // Vérifier si l'utilisateur a envoyé un numéro (sélection d'un poème)
        const numeroMatch = userInput.match(/^\d+$/);
        
        if (numeroMatch && conversationHistory[senderId]) {
            // L'utilisateur a sélectionné un numéro
            const numero = parseInt(userInput);
            const lastSearch = conversationHistory[senderId];

            if (numero < 1 || numero > 20) {
                return sendMessage(senderId, "❌ Veuillez choisir un numéro entre 1 et 20.");
            }

            // Appel à la deuxième API pour obtenir les détails du poème
            const detailUrl = `https://tonontako-audio.vercel.app/tonony?numero=${numero}&tononkalo=${encodeURIComponent(lastSearch.keyword)}&page=${lastSearch.page}`;
            
            const detailResponse = await axios.get(detailUrl);
            const detailData = detailResponse.data;

            if (!detailData || !detailData.tonony) {
                return sendMessage(senderId, "❌ Impossible de récupérer les détails de ce poème.");
            }

            // Formater les détails du poème
            const formattedDetails = formatTononkaloDetails(
                detailData.auteur,
                detailData.mp3,
                detailData.tonony,
                'poesie'
            );
            
            // Envoyer les détails formatés avec découpage automatique
            await sendLongMessage(senderId, formattedDetails, 1500);
            
            // Envoyer l'audio si disponible
            if (detailData.mp3) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await sendMessage(senderId, {
                    attachment: {
                        type: 'audio',
                        payload: {
                            url: detailData.mp3,
                            is_reusable: true
                        }
                    }
                });
            }

        } else {
            // L'utilisateur a envoyé un mot-clé pour rechercher
            const keyword = userInput;
            const page = 1;

            // Appel à la première API pour la recherche
            const searchUrl = `https://tonontako-audio.vercel.app/recherche?tononkalo=${encodeURIComponent(keyword)}&page=${page}`;
            console.log('URL de recherche:', searchUrl);
            
            const searchResponse = await axios.get(searchUrl);
            console.log('Réponse API reçue:', JSON.stringify(searchResponse.data));
            const searchData = searchResponse.data;

            if (!searchData || !searchData.Reponse) {
                console.log('Pas de résultats dans la réponse');
                return sendMessage(senderId, "❌ Aucun résultat trouvé pour votre recherche.");
            }

            // Sauvegarder l'historique de recherche pour cet utilisateur
            conversationHistory[senderId] = {
                keyword: keyword,
                page: page,
                timestamp: Date.now()
            };

            // Formater et envoyer la liste des résultats
            const header = formatTononkaloHeader(keyword, page, 'poesie');
            const fullMessage = header + searchData.Reponse + formatInstruction();
            
            await sendLongMessage(senderId, fullMessage);
        }

    } catch (error) {
        console.error('Erreur dans la commande poesie:', error);
        console.error('Détails de l\'erreur:', error.response ? error.response.data : error.message);
        
        if (error.response) {
            console.error('Code status:', error.response.status);
            console.error('Données de réponse:', error.response.data);
        }
        
        await sendMessage(senderId, `❌ Une erreur s'est produite lors de la recherche de poèmes. Veuillez réessayer.\nDétails: ${error.message}`);
    }
};

// Nettoyer l'historique ancien (plus de 30 minutes)
setInterval(() => {
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    
    for (const userId in conversationHistory) {
        if (now - conversationHistory[userId].timestamp > thirtyMinutes) {
            delete conversationHistory[userId];
        }
    }
}, 5 * 60 * 1000); // Vérifier toutes les 5 minutes

module.exports.info = {
    name: "poesie",
    description: "Recherche et affiche des poèmes malagasy avec audio.",
    usage: "Envoyez 'poesie <mot-clé>' pour rechercher, puis répondez avec un numéro (1-20) pour voir les détails."
};
