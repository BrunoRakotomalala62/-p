const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, args) => {
    try {
        const keywords = typeof args === 'string' ? args.trim() : (Array.isArray(args) ? args.join(' ').trim() : '');
        
        if (!keywords || keywords.length === 0) {
            return await sendMessage(senderId, `
🎵 𝗧𝗜𝗞𝗧𝗢𝗞 𝗩𝗜𝗗𝗘𝗢 𝗦𝗘𝗔𝗥𝗖𝗛 🎵
━━━━━━━━━━━━━━━━━━━
❌ Veuillez fournir un mot-clé de recherche !

📝 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻 :
video <mot-clé>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 :
video dance challenge
            `.trim());
        }

        await sendMessage(senderId, `🔎 Recherche de vidéos TikTok pour "${keywords}"...\n⏳ Veuillez patienter...`);

        const apiUrl = `https://norch-project.gleeze.com/api/tiktok?keywords=${encodeURIComponent(keywords)}`;
        const response = await axios.get(apiUrl, {
            timeout: 30000
        });

        if (response.data && response.data.success) {
            const videoData = response.data;

            const messageText = `
🎵 𝗧𝗜𝗞𝗧𝗢𝗞 𝗩𝗜𝗗𝗘𝗢 🎵
━━━━━━━━━━━━━━━━━━━

📺 𝗧𝗶𝘁𝗿𝗲 : ${videoData.title}

👤 𝗔𝘂𝘁𝗲𝘂𝗿 : ${videoData.author}

⏱️ 𝗗𝘂𝗿𝗲́𝗲 : ${videoData.duration} secondes

🆔 𝗩𝗶𝗱𝗲𝗼 𝗜𝗗 : ${videoData.video_id}

━━━━━━━━━━━━━━━━━━━
✨ 𝗕𝗼𝗻𝗻𝗲 𝘃𝗶𝘀𝗶𝗼𝗻𝗻𝗮𝗴𝗲 ! 🎬
            `.trim();

            await sendMessage(senderId, {
                attachment: {
                    type: 'image',
                    payload: {
                        url: videoData.cover,
                        is_reusable: true
                    }
                }
            });

            await sendMessage(senderId, messageText);

            await sendMessage(senderId, {
                attachment: {
                    type: 'video',
                    payload: {
                        url: videoData.play,
                        is_reusable: true
                    }
                }
            });

            await sendMessage(senderId, `✅ Vidéo envoyée avec succès ! 🎉`);

        } else {
            await sendMessage(senderId, `
❌ 𝗔𝘂𝗰𝘂𝗻 𝗿𝗲́𝘀𝘂𝗹𝘁𝗮𝘁 𝘁𝗿𝗼𝘂𝘃𝗲́ ❌
━━━━━━━━━━━━━━━━━━━
Impossible de trouver une vidéo pour "${keywords}".
Veuillez vérifier vos mots-clés et réessayer. 🔍
            `.trim());
        }

    } catch (error) {
        console.error('Erreur lors de la recherche TikTok:', error);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la recherche.
${error.response ? `Erreur API : ${error.response.status}` : `Erreur : ${error.message}`}
Veuillez réessayer plus tard. 🔧
        `.trim());
    }
};

module.exports.info = {
    name: "video",
    description: "Recherche une vidéo TikTok et affiche le titre, la photo de couverture et la vidéo.",
    usage: "video <mot-clé>",
    author: "Bruno",
    aliases: ["tiktok", "ttv", "ttvid"]
};
