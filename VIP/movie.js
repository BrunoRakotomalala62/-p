const axios = require('axios');

// Cache global simple pour stocker les résultats de recherche par utilisateur
const userSearchCache = {};

module.exports = async function (senderId, userText, api) {
    const args = userText.split(" ");
    const query = args.join(" ");

    if (!query || userText === "RESET_CONVERSATION") {
        return;
    }

    const sendMessage = require('../handles/sendMessage');

    // Gestion du téléchargement par numéro
    if (!isNaN(userText.trim()) && args.length === 1) {
        const index = parseInt(userText.trim()) - 1;
        const cache = userSearchCache[senderId];
        
        if (cache && cache[index]) {
            const item = cache[index];
            try {
                await sendMessage(senderId, `📥 Préparation du téléchargement pour : ${item.titre}...`);
                
                const downloadUrl = `https://movie--ngz1zcaz.replit.app/download?video=${encodeURIComponent(item.detail_url)}`;
                const response = await axios.get(downloadUrl);
                
                // L'API semble renvoyer un objet avec le lien de téléchargement
                // Structure probable: { "download_link": "..." } ou similaire
                const link = response.data.download_link || response.data.link || response.data.url;
                
                if (link) {
                    await sendMessage(senderId, `✅ Voici votre lien de téléchargement :\n\n${link}`);
                } else {
                    await sendMessage(senderId, "❌ Impossible de générer le lien de téléchargement.");
                }
                return;
            } catch (e) {
                console.error("Erreur download:", e);
                return await sendMessage(senderId, "❌ Erreur lors de la récupération du lien.");
            }
        }
    }

    // Gestion de la pagination (si spécifiée comme dernier argument)
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
        
        // Structure de l'API: {"resultats": [...], "page": 1, "keyword": "..."}
        const results = response.data.resultats || response.data;

        if (!results || !Array.isArray(results) || results.length === 0) {
            return await sendMessage(senderId, "❌ Aucun résultat trouvé.");
        }

        // Stocker en cache pour le téléchargement futur
        userSearchCache[senderId] = results;

        let message = `🎬 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗣𝗢𝗨𝗥 "${searchQuery.toUpperCase()}" (Page ${page})\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        const attachments = [];

        for (let i = 0; i < Math.min(results.length, 15); i++) {
            const item = results[i];
            message += `${i + 1}. ${item.titre || "Sans titre"}\n`;
            
            if (item.image_url) {
                try {
                    // Pour Messenger, on peut envoyer les URLs directement dans le tableau d'attachements
                    attachments.push(item.image_url); 
                } catch (e) {
                    console.error("Erreur image:", e);
                }
            }
        }

        message += "\n━━━━━━━━━━━━━━━━━━━━\n💡 Répondez avec le numéro pour télécharger.";
        
        await api.sendMessage({
            body: message,
            attachment: attachments
        }, senderId);

    } catch (error) {
        console.error("Erreur movie search:", error);
        await sendMessage(senderId, "❌ Une erreur est survenue lors de la recherche.");
    }
};
