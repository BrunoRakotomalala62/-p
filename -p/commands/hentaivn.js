
const axios = require('axios');
const cheerio = require('cheerio');
const sendMessage = require('../handles/sendMessage');

module.exports.config = {
    name: "hentaivn",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "Mirai Team",
    description: "Rechercher des informations de manga sur hentaivn",
    commandCategory: "nsfw",
    usages: "[ID manga]",
    cooldowns: 5,
    dependencies: {
        "axios": "",
        "cheerio": ""
    }
};

module.exports = async (senderId, args, api) => {
    try {
        if (!args || args.trim() === '') {
            const randomId = Math.floor(Math.random() * 21553);
            await sendMessage(senderId, `Code recommandé: ${randomId}\nUtilisez 'hentaivn <ID>' pour rechercher un manga spécifique.`);
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

        // Faire la première requête
        const response = await axios.get(`https://hentaivn.tv/id${mangaId}`);
        
        if (response.status == 200) {
            const html = response.data;
            const $ = cheerio.load(html);
            const getContainer = $('div.container');
            const getURL = getContainer.find('form').attr('action');
            
            if (getURL == `https://hentaivn.tv/${mangaId}-doc-truyen-.html`) {
                await sendMessage(senderId, `Aucun manga trouvé avec l'ID ${mangaId}.`);
                return { skipCommandCheck: true };
            }
            
            // Faire la deuxième requête
            const detailResponse = await axios.get(getURL);
            
            if (detailResponse.status == 200) {
                const detailHtml = detailResponse.data;
                const $detail = cheerio.load(detailHtml);
                
                const getInfo = $detail('div.container div.main div.page-info');
                const getName = getInfo.find('h1').find('a').text();
                
                const getTags = getInfo.find('a.tag').contents().map(function () {
                    return (this.type === 'text') ? $detail(this).text() + '' : '';
                }).get().join(', ');
                
                const getArtist = getInfo.find('a[href^="/tacgia="]').contents().map(function () {
                    return (this.type === 'text') ? $detail(this).text() + '' : '';
                }).get().join(', ');
                
                const getChar = getInfo.find('a[href^="/char="]').contents().map(function () {
                    return (this.type === 'text') ? $detail(this).text() + '' : '';
                }).get().join(', ');
                
                const characters = getChar === '' ? 'Original' : getChar;
                
                // Formater l'URL pour l'affichage
                const formattedURL = getURL.slice(0, 17) + " " + getURL.slice(17);
                
                // Envoyer les informations
                await sendMessage(senderId, 
                    `📚 *INFORMATIONS MANGA* 📚\n\n`+
                    `• *Titre*: ${getName.substring(1)}\n`+
                    `• *Auteur*: ${getArtist}\n`+
                    `• *Personnages*: ${characters}\n`+
                    `• *Tags*: ${getTags}\n`+
                    `• *Lien*: ${formattedURL}`
                );
            }
        }
    } catch (error) {
        console.error('Erreur lors de la recherche sur hentaivn:', error);
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
    name: "hentaivn",
    description: "Recherche des informations de manga sur hentaivn.",
    usage: "Envoyez 'hentaivn <ID>' pour rechercher un manga spécifique."
};
