const axios = require('axios');
const FormData = require('form-data');
const sendMessage = require('../handles/sendMessage');

const API_ENDPOINT = 'https://gemini-image-editor--brunorakotoma12.replit.app/api/nanobanana';

const nanoSessions = {};

const uploadToFreeImage = async (facebookUrl) => {
    console.log('[NANO] Téléchargement image Facebook:', facebookUrl.substring(0, 80));
    const imageResponse = await axios.get(facebookUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    const imageBuffer = Buffer.from(imageResponse.data);
    const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
    console.log('[NANO] Image téléchargée:', imageBuffer.length, 'bytes, type:', contentType);

    const formData = new FormData();
    formData.append('source', imageBuffer, {
        filename: 'image.jpg',
        contentType
    });
    formData.append('type', 'file');

    const uploadResponse = await axios.post(
        'https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5',
        formData,
        {
            headers: formData.getHeaders(),
            timeout: 30000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        }
    );

    const publicUrl = uploadResponse.data?.image?.url;
    console.log('[NANO] URL publique freeimage.host:', publicUrl);
    if (!publicUrl || !publicUrl.startsWith('https://')) {
        throw new Error('freeimage.host upload échoué: ' + JSON.stringify(uploadResponse.data));
    }

    return publicUrl;
};

const WELCOME_MSG = `🎨 *Bienvenue dans NANO — Éditeur d'images IA* ✨

Je peux transformer vos images de façon intelligente :
• 🖌️ Changer les couleurs d'un vêtement ou objet
• 🌅 Modifier l'arrière-plan d'une photo
• 🔀 Fusionner deux personnes dans la même scène
• ✏️ Ajouter ou supprimer des éléments
• 🌟 Appliquer des effets artistiques
• 👗 Changer de style vestimentaire

━━━━━━━━━━━━━━━━━━━━
📸 Envoyez votre première image pour commencer !
(Vous pourrez aussi envoyer une 2ème image pour des effets combinés)`;

// Appel de la nouvelle API — retourne { type: 'image', buffer } ou { type: 'text', text }
const callNanoApi = async (prompt, imageUrl, imageUrl2 = null, isRetry = false) => {
    // Au 2ème essai, on renforce le prompt pour forcer Gemini à générer une image
    const finalPrompt = isRetry
        ? `Modifie cette image en appliquant exactement cette transformation : "${prompt}". Retourne uniquement l'image modifiée.`
        : prompt;

    let url = `${API_ENDPOINT}?prompt=${encodeURIComponent(finalPrompt)}&image_url=${encodeURIComponent(imageUrl)}`;
    if (imageUrl2) {
        url += `&image_url2=${encodeURIComponent(imageUrl2)}`;
    }

    console.log(`[NANO] Appel API (essai ${isRetry ? 2 : 1}):`, finalPrompt.substring(0, 80));

    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    const contentType = response.headers['content-type'] || '';
    console.log('[NANO] Réponse status:', response.status, '| content-type:', contentType);

    // Si la réponse est du JSON (Gemini a retourné du texte, pas une image)
    if (contentType.includes('application/json')) {
        const jsonText = Buffer.from(response.data).toString('utf8');
        console.log('[NANO] Réponse JSON:', jsonText.substring(0, 200));

        // Retry automatique avec prompt renforcé si c'est le 1er essai
        if (!isRetry) {
            console.log('[NANO] Gemini a retourné du texte, retry avec prompt renforcé...');
            return callNanoApi(prompt, imageUrl, imageUrl2, true);
        }

        let parsed = {};
        try { parsed = JSON.parse(jsonText); } catch(e) {}
        return { type: 'text', text: parsed.text || parsed.note || 'Gemini n\'a pas pu modifier cette image.' };
    }

    // Réponse binaire (image PNG)
    return { type: 'image', buffer: Buffer.from(response.data) };
};

// Upload du buffer résultat vers freeimage.host et envoi via sendMessage
const sendImageBuffer = async (senderId, imageBuffer) => {
    console.log('[NANO] Upload résultat PNG vers freeimage.host, taille:', imageBuffer.length, 'bytes');

    const form = new FormData();
    form.append('source', imageBuffer, { filename: 'result.png', contentType: 'image/png' });
    form.append('type', 'file');

    const uploadResponse = await axios.post(
        'https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5',
        form,
        { headers: form.getHeaders(), timeout: 60000, maxBodyLength: Infinity, maxContentLength: Infinity }
    );

    const resultUrl = uploadResponse.data?.image?.url;
    console.log('[NANO] URL résultat:', resultUrl);
    if (!resultUrl || !resultUrl.startsWith('https://')) {
        throw new Error('Upload résultat échoué: ' + JSON.stringify(uploadResponse.data));
    }

    await sendMessage(senderId, { files: [resultUrl], type: 'image' });
};

module.exports = async (senderId, messageText, api, attachments) => {

    if (messageText === "RESET_CONVERSATION") {
        delete nanoSessions[senderId];
        return;
    }

    const session = nanoSessions[senderId] || { step: 'idle' };

    // ── Réception d'une image ──────────────────────────────────────────
    if (messageText === "IMAGE_ATTACHMENT" && attachments && attachments.length > 0) {
        const imageUrl = attachments[0].payload.url;

        if (session.step === 'idle' || session.step === 'awaiting_first_image') {
            const publicUrl1 = await uploadToFreeImage(imageUrl);
            nanoSessions[senderId] = {
                step: 'awaiting_decision',
                imageUrl1: publicUrl1
            };

            await sendMessage(senderId,
                `✅ Première image reçue et enregistrée !\n\n` +
                `Que souhaitez-vous faire maintenant ?\n\n` +
                `📌 Option 1 — Tapez directement votre instruction :\n` +
                `Ex : "Changer la couleur du vêtement en rouge"\n\n` +
                `📌 Option 2 — Envoyez une 2ème image pour un effet combiné :\n` +
                `Ex : mettre deux personnes côte à côte, fusionner des scènes, etc.`
            );
            return;
        }

        if (session.step === 'awaiting_decision' && session.imageUrl1) {
            const publicUrl2 = await uploadToFreeImage(imageUrl);
            nanoSessions[senderId] = {
                ...session,
                step: 'awaiting_prompt_two_images',
                imageUrl2: publicUrl2
            };

            await sendMessage(senderId,
                `✅ Deuxième image reçue !\n\n` +
                `🎯 Décrivez maintenant ce que vous voulez faire avec ces deux images :\n\n` +
                `💡 Exemples :\n` +
                `• "Mettre la personne de la 2ème photo à côté de celle de la 1ère"\n` +
                `• "Fusionner les deux arrière-plans"\n` +
                `• "Habiller la personne de l'image 1 avec la tenue de l'image 2"`
            );
            return;
        }

        // Nouvelle image hors session active — redémarrer
        const publicUrlFallback = await uploadToFreeImage(imageUrl);
        nanoSessions[senderId] = { step: 'awaiting_decision', imageUrl1: publicUrlFallback };
        await sendMessage(senderId,
            `✅ Image reçue !\n\nTapez votre instruction ou envoyez une 2ème image pour combiner.`
        );
        return;
    }

    // ── Réception d'un texte ──────────────────────────────────────────

    // Démarrage de la commande
    if (session.step === 'idle') {
        nanoSessions[senderId] = { step: 'awaiting_first_image' };
        await sendMessage(senderId, WELCOME_MSG);
        return;
    }

    // Attente première image — texte reçu
    if (session.step === 'awaiting_first_image') {
        await sendMessage(senderId,
            `📸 Veuillez d'abord envoyer une image à transformer.\n` +
            `Tapez "stop" pour annuler.`
        );
        return;
    }

    // Annulation
    if (messageText.trim().toLowerCase() === 'stop') {
        delete nanoSessions[senderId];
        await sendMessage(senderId, `🛑 Session NANO annulée. Tapez "nano" pour recommencer.`);
        return;
    }

    // ── Traitement : 1 seule image ────────────────────────────────────
    if (session.step === 'awaiting_decision' && session.imageUrl1) {
        const prompt = messageText.trim();

        await sendMessage(senderId,
            `⚙️ Traitement en cours...\n🖼️ Modification de votre image avec l'instruction :\n"${prompt}"\n\n⏳ Cela peut prendre quelques secondes, veuillez patienter...`
        );

        try {
            const result = await callNanoApi(prompt, session.imageUrl1);

            if (result.type === 'text') {
                await sendMessage(senderId,
                    `⚠️ Gemini n'a pas pu modifier cette image.\n\n` +
                    `💡 Essayez avec une instruction plus précise,\n` +
                    `par exemple : "Rendre le vêtement entièrement rouge"\n\n` +
                    `Ou renvoyez une autre image.`
                );
            } else {
                await sendImageBuffer(senderId, result.buffer);
                await sendMessage(senderId,
                    `✅ Transformation réussie !\n\n` +
                    `🔄 Voulez-vous faire une autre modification ?\n` +
                    `• Envoyez une nouvelle image pour recommencer\n` +
                    `• Tapez "stop" pour quitter`
                );
            }

            nanoSessions[senderId] = { step: 'awaiting_first_image' };

        } catch (error) {
            console.error('[NANO] Erreur (1 image):', error.message, error.response?.status, error.response?.data?.toString?.().substring(0, 200));
            await handleApiError(senderId, error);
            nanoSessions[senderId] = { step: 'awaiting_first_image' };
        }
        return;
    }

    // ── Traitement : 2 images ─────────────────────────────────────────
    if (session.step === 'awaiting_prompt_two_images' && session.imageUrl1 && session.imageUrl2) {
        const prompt = messageText.trim();

        await sendMessage(senderId,
            `⚙️ Traitement en cours...\n🖼️🖼️ Combinaison de vos deux images avec l'instruction :\n"${prompt}"\n\n⏳ Cela peut prendre quelques secondes, veuillez patienter...`
        );

        try {
            const result = await callNanoApi(prompt, session.imageUrl1, session.imageUrl2);

            if (result.type === 'text') {
                await sendMessage(senderId,
                    `⚠️ Gemini n'a pas pu combiner ces images.\n\n` +
                    `💡 Essayez avec une instruction plus précise.\n\n` +
                    `Ou renvoyez les images.`
                );
            } else {
                await sendImageBuffer(senderId, result.buffer);
                await sendMessage(senderId,
                    `✅ Combinaison réussie !\n\n` +
                    `🔄 Voulez-vous continuer ?\n` +
                    `• Envoyez une nouvelle image pour recommencer\n` +
                    `• Tapez "stop" pour quitter`
                );
            }

            nanoSessions[senderId] = { step: 'awaiting_first_image' };

        } catch (error) {
            console.error('[NANO] Erreur (2 images):', error.message, error.response?.status, error.response?.data?.toString?.().substring(0, 200));
            await handleApiError(senderId, error);
            nanoSessions[senderId] = { step: 'awaiting_first_image' };
        }
        return;
    }

    // Fallback — relancer
    nanoSessions[senderId] = { step: 'awaiting_first_image' };
    await sendMessage(senderId, WELCOME_MSG);
};

const handleApiError = async (senderId, error) => {
    if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
        await sendMessage(senderId,
            `⏱️ Le traitement a pris trop de temps.\n` +
            `L'API est surchargée, réessayez dans quelques instants.`
        );
    } else if (error.response) {
        await sendMessage(senderId,
            `❌ Erreur de l'API (${error.response.status}).\n` +
            `Veuillez réessayer avec une autre image ou instruction.`
        );
    } else {
        await sendMessage(senderId,
            `❌ Une erreur s'est produite.\n` +
            `Veuillez réessayer ou tapez "stop" pour annuler.`
        );
    }
};

module.exports.info = {
    name: "nano",
    description: "Éditeur d'images IA — modifiez, transformez et combinez vos images avec l'intelligence artificielle.",
    usage: `1. Tapez "nano" pour démarrer
2. Envoyez une image (ou deux images pour un effet combiné)
3. Donnez votre instruction en langage naturel
Exemples : "changer la couleur en rouge", "modifier l'arrière-plan", "fusionner les deux personnes"`
};
