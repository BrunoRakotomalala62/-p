
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt) => {
    try {
        // Vérifier si le prompt est vide
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖 *QuillBot AI*\n\n❌ Veuillez fournir une question ou un texte à traiter.\n\n💡 Exemple: quillbot Bonjour, comment ça va ?");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "✨ QuillBot réfléchit à votre demande... 🤔💭");

        // Construire l'URL de l'API
        const apiUrl = `https://api.ccprojectsapis-jonell.gleeze.com/api/ai/quillbotai?prompt=${encodeURIComponent(prompt)}`;
        
        // Appeler l'API
        const response = await axios.get(apiUrl);
        
        // Extraire la réponse du format SSE
        let finalText = '';
        
        if (response.data && response.data.response) {
            const sseData = response.data.response;
            
            // Chercher l'événement output_done qui contient le texte complet
            const outputDoneMatch = sseData.match(/event: output_done\ndata: ({.*?})\n/);
            
            if (outputDoneMatch && outputDoneMatch[1]) {
                try {
                    const outputData = JSON.parse(outputDoneMatch[1]);
                    finalText = outputData.text || '';
                } catch (parseError) {
                    console.error('Erreur lors du parsing de output_done:', parseError);
                }
            }
            
            // Si on n'a pas trouvé le texte dans output_done, extraire les chunks
            if (!finalText) {
                const chunks = sseData.match(/event: delta\ndata: {\"chunk\":\"(.*?)\"}/g);
                if (chunks) {
                    finalText = chunks.map(chunk => {
                        const match = chunk.match(/\"chunk\":\"(.*?)\"/);
                        return match ? match[1] : '';
                    }).join('');
                }
            }
        }

        // Si aucune réponse n'a été extraite
        if (!finalText) {
            await sendMessage(senderId, "⚠️ Aucune réponse n'a pu être extraite de l'API QuillBot.");
            return;
        }

        // Formater la réponse de manière attractive
        const formattedResponse = `
╔═══════════════════════════╗
║   🤖 QUILLBOT AI 🤖      ║
╚═══════════════════════════╝

💬 *Votre question:*
${prompt}

✨ *Réponse QuillBot:*
${finalText}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔮 Powered by QuillBot AI
🌟 Créé par @Bruno
        `.trim();

        await sendMessage(senderId, formattedResponse);

    } catch (error) {
        console.error('❌ Erreur QuillBot AI:', error?.response?.data || error.message || error);
        
        await sendMessage(senderId, `
⚠️ *ERREUR QUILLBOT* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors du traitement de votre demande.

🔄 Veuillez réessayer dans quelques instants.
📞 Si le problème persiste, contactez l'administrateur.
        `.trim());
    }
};

// Informations de la commande
module.exports.info = {
    name: "quillbot",
    description: "Discutez avec QuillBot AI, un assistant intelligent pour répondre à vos questions.",
    usage: "Envoyez 'quillbot <votre question>' pour obtenir une réponse intelligente."
};
