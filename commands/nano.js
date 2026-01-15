const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const userStates = {};

module.exports = async (senderId, userText, api, imageAttachments) => {
    if (!userStates[senderId]) {
        userStates[senderId] = { step: 'initial' };
    }

    const state = userStates[senderId];

    // Commande initiale "nano"
    if (userText && userText.toLowerCase() === 'nano') {
        state.step = 'waiting_image';
        await sendMessage(senderId, "🎨 *𝗡𝗔𝗡𝗢-𝗘𝗗𝗜𝗧* ✨\n\n📸 Veuillez envoyer l'image que vous souhaitez transformer !");
        return;
    }

    // Réception de l'image
    if (userText === 'IMAGE_ATTACHMENT' && imageAttachments && imageAttachments.length > 0) {
        if (state.step === 'waiting_image') {
            // Extraire l'URL de l'image de la structure correcte
            const attachment = imageAttachments[0];
            state.imageUrl = attachment.payload ? attachment.payload.url : attachment.url;
            state.step = 'waiting_prompt';
            await sendMessage(senderId, "✅ *Image reçue avec succès !* 🖼️\n\n💡 Posez maintenant vos questions ou décrivez les changements à apporter (ex: 'changer en violet ses cheveux').");
            return { skipCommandCheck: true };
        }
    }

    // Réception du prompt de transformation
    if (state.step === 'waiting_prompt' && userText && userText !== 'IMAGE_ATTACHMENT') {
        const prompt = userText;
        const imageUrl = state.imageUrl;

        await sendMessage(senderId, "🚀 *Transformation en cours...*\n\n⏳ Veuillez patienter quelques instants pendant que je traite votre demande de création... 🎨✨");

        try {
            const apiUrl = `https://nano-banana-api-five.vercel.app/nanobanana?prompt=${encodeURIComponent(prompt)}&image=${encodeURIComponent(imageUrl)}&uid=${senderId}`;
            const response = await axios.get(apiUrl);

            if (response.data && response.data.resultats_url) {
                const resultUrl = response.data.resultats_url;
                
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: resultUrl,
                            is_reusable: true
                        }
                    }
                });
                await sendMessage(senderId, "✨ *Et voilà !* Votre image a été transformée avec succès. 🎈");
            } else {
                throw new Error("L'API n'a pas renvoyé d'URL de résultat.");
            }
        } catch (error) {
            console.error("Erreur API Nano Banana:", error);
            await sendMessage(senderId, "Désolé, une erreur s'est produite lors de la transformation de l'image.");
        } finally {
            // Réinitialiser l'état après la tentative
            delete userStates[senderId];
        }
        return;
    }
};

module.exports.info = {
    name: "nano",
    description: "Transforme une image en utilisant l'API Nano Banana.",
    usage: "Tapez 'nano', envoyez une image, puis donnez vos instructions de transformation."
};
