
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt) => {
    try {
        // Vérifier si l'utilisateur a fourni du texte
        if (!prompt || prompt.trim() === '') {
            return await sendMessage(senderId, `
🔊 𝗚𝗢𝗢𝗚𝗟𝗘 𝗧𝗘𝗫𝗧-𝗧𝗢-𝗦𝗣𝗘𝗘𝗖𝗛 🔊
━━━━━━━━━━━━━━━━━━━
❌ Veuillez fournir le texte à convertir en audio !

📝 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻 :
ttsgoogle <votre texte>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 :
ttsgoogle Bonjour, comment allez-vous aujourd'hui ?
            `.trim());
        }

        const text = prompt.trim();

        // Envoyer un message de chargement
        await sendMessage(senderId, `🎙️ Conversion du texte en audio en cours... ⏳`);

        // Appeler l'API Google TTS
        const apiUrl = `https://api.siputzx.my.id/api/tools/ttsgoogle?text=${encodeURIComponent(text)}`;
        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer'
        });

        // Vérifier si la réponse est valide
        if (response.data) {
            // L'API retourne directement le fichier MP3
            // Créer un buffer depuis la réponse
            const audioBuffer = Buffer.from(response.data);
            
            // Convertir le buffer en base64 pour l'envoi
            const audioBase64 = audioBuffer.toString('base64');
            const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

            // Envoyer le message audio
            await sendMessage(senderId, {
                attachment: {
                    type: 'audio',
                    payload: {
                        url: apiUrl,
                        is_reusable: true
                    }
                }
            });

            // Envoyer un message de confirmation
            await sendMessage(senderId, `
🔊 𝗔𝗨𝗗𝗜𝗢 𝗚𝗘́𝗡𝗘́𝗥𝗘́ 🔊
━━━━━━━━━━━━━━━━━━━

✅ Votre audio a été généré avec succès !

📝 𝗧𝗲𝘅𝘁𝗲 : ${text}

━━━━━━━━━━━━━━━━━━━
🎧 𝗕𝗼𝗻𝗻𝗲 𝗲́𝗰𝗼𝘂𝘁𝗲 ! 🎶
            `.trim());

        } else {
            await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━
Impossible de générer l'audio.
Veuillez réessayer. 🔧
            `.trim());
        }

    } catch (error) {
        console.error('Erreur lors de la conversion TTS :', error);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la conversion.
Veuillez réessayer plus tard. 🔧
        `.trim());
    }
};

// Informations de la commande
module.exports.info = {
    name: "ttsgoogle",
    description: "Convertit du texte en audio MP3 avec Google Text-to-Speech.",
    usage: "Envoyez 'ttsgoogle <votre texte>' pour générer un fichier audio.",
    author: "Bruno"
};
