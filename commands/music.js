
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, args) => {
    try {
        // Vérifier si l'utilisateur a fourni une requête
        if (!args || args.length === 0) {
            return await sendMessage(senderId, `
🎵 𝗠𝗨𝗦𝗜𝗖 𝗦𝗘𝗔𝗥𝗖𝗛 🎵
━━━━━━━━━━━━━━━━━━━
❌ Veuillez fournir le nom d'une chanson !

📝 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻 :
music <nom de la chanson>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 :
music westlife my love
            `.trim());
        }

        const query = args.join(' ');

        // Envoyer un message de chargement
        await sendMessage(senderId, `🎵 Recherche de "${query}" en cours... ⏳`);

        // Appeler l'API YouTube Music
        const apiUrl = `https://api-library-kohi.onrender.com/api/ytmusic?query=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl);

        if (response.data && response.data.status && response.data.data) {
            const musicData = response.data.data;

            // Construire le message de réponse avec emojis
            const messageText = `
🎵 𝗠𝗨𝗦𝗜𝗖 𝗥𝗘𝗦𝗨𝗟𝗧 🎵
━━━━━━━━━━━━━━━━━━━

🎤 𝗧𝗶𝘁𝗿𝗲 : ${musicData.title}

⏱️ 𝗗𝘂𝗿𝗲́𝗲 : ${musicData.duration}

👁️ 𝗩𝘂𝗲𝘀 : ${musicData.views.toLocaleString()}

🔗 𝗟𝗶𝗲𝗻 : ${musicData.url}

🎧 𝗔𝘂𝗱𝗶𝗼 : ${musicData.audioUrl}

━━━━━━━━━━━━━━━━━━━
✨ 𝗕𝗼𝗻𝗻𝗲 𝗲́𝗰𝗼𝘂𝘁𝗲 ! 🎶
            `.trim();

            // Envoyer le message avec l'image en pièce jointe
            await sendMessage(senderId, {
                attachment: {
                    type: 'image',
                    payload: {
                        url: musicData.thumbnail,
                        is_reusable: true
                    }
                }
            });

            // Envoyer le message texte après l'image
            await sendMessage(senderId, messageText);

        } else {
            await sendMessage(senderId, `
❌ 𝗔𝘂𝗰𝘂𝗻 𝗿𝗲́𝘀𝘂𝗹𝘁𝗮𝘁 𝘁𝗿𝗼𝘂𝘃𝗲́ ❌
━━━━━━━━━━━━━━━━━━━
Impossible de trouver "${query}".
Veuillez vérifier le nom de la chanson et réessayer. 🔍
            `.trim());
        }

    } catch (error) {
        console.error('Erreur lors de la recherche musicale :', error);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la recherche.
Veuillez réessayer plus tard. 🔧
        `.trim());
    }
};

// Informations de la commande
module.exports.info = {
    name: "music",
    description: "Recherche une chanson sur YouTube Music et affiche les informations avec une miniature.",
    usage: "Envoyez 'music <nom de la chanson>' pour rechercher de la musique.",
    author: "Bruno"
};
