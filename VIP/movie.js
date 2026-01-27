const axios = require('axios');

// Cache global simple pour stocker les résultats de recherche par utilisateur
const userSearchCache = {};

module.exports = async function (senderId, userText, api) {
    const sendMessage = require('../handles/sendMessage');
    const args = userText.split(" ");
    const query = args.join(" ");

    if (userText === "RESET_CONVERSATION") {
        return;
    }

    // Gestion du téléchargement par numéro
    if (!isNaN(userText.trim()) && args.length === 1) {
        const index = parseInt(userText.trim()) - 1;
        const cache = userSearchCache[senderId];
        
        if (cache && cache[index]) {
            const item = cache[index];
            try {
                await sendMessage(senderId, `📥 Préparation du téléchargement pour : ${item.titre || item.title}...`);
                
                const detailUrl = item.detail_url || item.id;
                const downloadUrl = `https://movie--ngz1zcaz.replit.app/download?video=${encodeURIComponent(detailUrl)}`;
                const response = await axios.get(downloadUrl);
                
                const link = response.data.download_link || response.data.link || response.data.url || response.data.download_url;
                
                if (link) {
                    await sendMessage(senderId, `✅ Voici votre lien de téléchargement :\n\n${link}`);
                } else {
                    await sendMessage(senderId, "❌ Impossible de générer le lien de téléchargement.");
                }
                return;
            } catch (e) {
                console.error("Erreur download:", e.message);
                return await sendMessage(senderId, "❌ Erreur lors de la récupération du lien.");
            }
        }
    }

    if (!query) return;

    // Gestion de la pagination
    let page = 1;
    const lastArg = args[args.length - 1];
    let searchQuery = query;
    if (args.length > 1 && !isNaN(lastArg)) {
        page = parseInt(lastArg);
        args.pop();
        searchQuery = args.join(" ");
    }

    try {
        await sendMessage(senderId, `🔍 Recherche de "${searchQuery}" (Page ${page})...`);
        
        const searchUrl = `https://movie--ngz1zcaz.replit.app/recherche?video=${encodeURIComponent(searchQuery)}&page=${page}`;
        const response = await axios.get(searchUrl);
        
        // Structure de l'API: {"resultats": [...]}
        const results = response.data.resultats || response.data.results || (Array.isArray(response.data) ? response.data : null);

        if (!results || !Array.isArray(results) || results.length === 0) {
            return await sendMessage(senderId, "❌ Aucun résultat trouvé.");
        }

        userSearchCache[senderId] = results;

        const maxResults = Math.min(results.length, 15);
        
        for (let i = 0; i < maxResults; i++) {
            const item = results[i];
            const title = item.titre || item.title || "Sans titre";
            const imageUrl = item.image_url || item.image || item.poster;
            
            let messageText = `Titre ${i + 1}\n${title}`;
            
            if (imageUrl) {
                try {
                    // Envoi groupé texte + image si possible, sinon séparé
                    await api.sendMessage({
                        body: messageText,
                        attachment: await axios.get(imageUrl, { responseType: 'stream' }).then(res => res.data)
                    }, senderId);
                } catch (e) {
                    console.error(`Erreur image stream ${i+1}:`, e.message);
                    await api.sendMessage(messageText, senderId);
                }
            } else {
                await api.sendMessage(messageText, senderId);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        await sendMessage(senderId, "💡 Répondez avec le numéro pour télécharger.");

    } catch (error) {
        console.error("Erreur movie search:", error.message);
        await sendMessage(senderId, "❌ Une erreur est survenue lors de la recherche.");
    }
};
