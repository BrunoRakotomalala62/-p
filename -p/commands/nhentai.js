
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports.config = {
    name: "nhentai",
    version: "1.0.2",
    hasPermssion: 0,
    credits: "Mirai Team",
    description: "Rechercher des informations de manga sur nhentai",
    commandCategory: "nsfw",
    usages: "[ID manga]",
    cooldowns: 5,
    dependencies: {
        "axios": ""
    }
};

module.exports = async (senderId, args, api) => {
    try {
        if (!args || args.trim() === '') {
            const randomId = Math.floor(Math.random() * 99999);
            await sendMessage(senderId, `Code recommandé: ${randomId}\nUtilisez 'nhentai <ID>' pour rechercher un manga spécifique.`);
            return { skipCommandCheck: true };
        }

        const mangaId = args.trim();
        
        // Vérifier si l'entrée est un nombre
        if (isNaN(parseInt(mangaId))) {
            await sendMessage(senderId, "Veuillez entrer un ID numérique valide.");
            return { skipCommandCheck: true };
        }

        // Message d'attente
        await sendMessage(senderId, "🔍 Recherche en cours...");

        // Effectuer la requête API
        const response = await axios.get(`https://nhentai.net/api/gallery/${parseInt(mangaId)}`);
        
        // Vérifier si la réponse contient une erreur
        if (response.data.error) {
            await sendMessage(senderId, `Aucun manga trouvé avec l'ID ${mangaId}.`);
            return { skipCommandCheck: true };
        }

        const codeData = response.data;
        const title = codeData.title.pretty;
        
        // Extraire les tags, artistes et personnages
        let tagList = [];
        let artistList = [];
        let characterList = [];
        
        codeData.tags.forEach(item => {
            if (item.type === "tag") {
                tagList.push(item.name);
            } else if (item.type === "artist") {
                artistList.push(item.name);
            } else if (item.type === "character") {
                characterList.push(item.name);
            }
        });
        
        // Joindre les listes en chaînes de caractères
        const tags = tagList.join(', ');
        const artists = artistList.join(', ');
        let characters = characterList.join(', ');
        
        // Si aucun personnage n'est trouvé, définir comme "Original"
        if (characters === '') {
            characters = 'Original';
        }
        
        // Envoyer les informations sous forme de message formaté
        await sendMessage(senderId, 
            `📚 *INFORMATIONS MANGA* 📚\n\n`+
            `• *Titre*: ${title}\n`+
            `• *Auteur*: ${artists}\n`+
            `• *Personnages*: ${characters}\n`+
            `• *Tags*: ${tags}\n`+
            `• *Lien*: https://nhentai.net/g/${mangaId}`
        );
        
    } catch (error) {
        console.error('Erreur lors de la recherche sur nhentai:', error);
        await sendMessage(senderId, `
⚠️ *ERREUR* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la recherche.
Veuillez réessayer plus tard.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }
    
    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "nhentai",
    description: "Recherche des informations de manga sur nhentai.",
    usage: "Envoyez 'nhentai <ID>' pour rechercher un manga spécifique."
};
