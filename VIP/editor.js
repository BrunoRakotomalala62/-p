const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_IMAGE = 'https://editor-image-magic-p4i3.vercel.app/api/image';
const API_BLEND = 'https://editor-image-magic-p4i3.vercel.app/api/blend';
const API_TIMEOUT = 90000;

// État par utilisateur : collecte des images envoyées + modèle choisi
const userState = new Map();

// Alias de modèles reconnus
const MODEL_ALIASES = {
    'qwen': 'qwen-edit',
    'qwen-edit': 'qwen-edit',
    'flux': 'flux-2-klein',
    'flux-2-klein': 'flux-2-klein',
};

async function downloadImageAsBase64(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000
        });
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error('[EDITOR] Erreur téléchargement image:', error.message);
        return null;
    }
}

function extractErrorMessage(error) {
    if (!error || !error.response) return null;
    const data = error.response.data;
    if (!data) return null;
    if (typeof data === 'string') return data;
    if (data.error !== undefined) {
        if (typeof data.error === 'string') return data.error;
        if (typeof data.error === 'object' && data.error !== null) {
            return data.error.message || data.error.detail || JSON.stringify(data.error);
        }
    }
    if (typeof data.message === 'string') return data.message;
    if (typeof data.detail === 'string') return data.detail;
    return JSON.stringify(data);
}

async function sendImageByUrl(senderId, imageUrl) {
    const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
    if (!PAGE_ACCESS_TOKEN) {
        console.error('[EDITOR] PAGE_ACCESS_TOKEN non défini.');
        return false;
    }
    try {
        await axios.post(
            `https://graph.facebook.com/v16.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                recipient: { id: senderId },
                message: { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } }
            }
        );
        return true;
    } catch (err) {
        console.error('[EDITOR] Échec envoi image via Graph:', err.response ? JSON.stringify(err.response.data) : err.message);
        return false;
    }
}

function getState(senderId) {
    if (!userState.has(senderId)) {
        userState.set(senderId, { images: [], model: null });
    }
    return userState.get(senderId);
}

/**
 * Détecte un préfixe de modèle au début du texte.
 * Retourne { model, prompt } où model est null si aucun préfixe détecté.
 */
function extractModel(text) {
    const words = text.split(/\s+/);
    const first = (words[0] || '').toLowerCase();
    if (MODEL_ALIASES[first]) {
        const rest = words.slice(1).join(' ').trim();
        return { model: MODEL_ALIASES[first], prompt: rest };
    }
    return { model: null, prompt: text };
}

module.exports = async (senderId, userText, api, imageAttachments) => {
    const input = (typeof userText === 'string') ? userText.trim() : '';
    const state = getState(senderId);

    // ---- Réception d'une photo en pièce jointe ----
    let attachedImageUrl = null;
    if (Array.isArray(imageAttachments) && imageAttachments.length > 0) {
        const img = imageAttachments[0];
        attachedImageUrl = (img && img.payload && img.payload.url) || (img && img.url) || null;
    }

    if (attachedImageUrl) {
        const base64 = await downloadImageAsBase64(attachedImageUrl);
        if (!base64) {
            await sendMessage(senderId,
                '⚠️ *Impossible de lire la photo.*\n\nElle est peut-être trop lourde. Réessaie.'
            );
            return;
        }

        state.images.push(base64);

        if (input && input !== 'IMAGE_ATTACHMENT') {
            await processEdit(senderId, input, state, api);
            return;
        }

        const count = state.images.length;
        if (count === 1) {
            await sendMessage(senderId,
                '🖼️ *1ère photo reçue !*\n\n' +
                '➡️ Tu peux envoyer une **autre photo** (pour une fusion),\n' +
                'ou écrire directement ton instruction.\n\n' +
                '📝 *Exemple :* `Changer en rouge le vêtement`'
            );
        } else {
            await sendMessage(senderId,
                `🖼️ *${count}ème photo reçue !*\n\n` +
                '➡️ Envoie encore une photo, ou écris maintenant ton instruction.\n\n' +
                '📝 *Exemple :* `Mettre les deux personnes côte à côte`'
            );
        }
        return;
    }

    // ---- Commande reset ----
    if (input === 'RESET_CONVERSATION') {
        state.images = [];
        state.model = null;
        return;
    }

    // ---- Aucune image fournie : aide ----
    if (!input) {
        await sendMessage(senderId,
            '🎨 *ÉDITEUR D\'IMAGE MAGIC HOUR*\n\n' +
            '📌 *Utilisation :*\n' +
            '1️⃣ Envoie **une photo**, puis écris ton instruction.\n' +
            '2️⃣ Envoie **plusieurs photos** (fusion), puis ton instruction.\n' +
            '3️⃣ Ou : `editor <instruction> | <url_image>`\n\n' +
            '🧠 *Choisir un modèle :* précède ton instruction par `qwen` ou `flux`.\n' +
            'Ex : `qwen changer en bleu le vêtement`\n\n' +
            '📝 *Exemples :*\n' +
            '`Changer en bleu le vêtement` (1 photo)\n' +
            '`Mettre les deux personnes côte à côte` (2 photos)'
        );
        return;
    }

    // ---- Analyse du texte (modèle / prompt / URL) ----
    const { model: detectedModel, prompt: cleanedInput } = extractModel(input);
    if (detectedModel) {
        state.model = detectedModel;
    }

    let prompt = '';
    let imageUrl = null;

    if (cleanedInput.includes('|')) {
        const parts = cleanedInput.split('|');
        prompt = parts[0].trim();
        imageUrl = parts.slice(1).join('|').trim();
    } else if (cleanedInput.match(/https?:\/\//)) {
        const idx = cleanedInput.search(/https?:\/\//);
        prompt = cleanedInput.slice(0, idx).trim();
        imageUrl = cleanedInput.slice(idx).trim();
    } else {
        prompt = cleanedInput;
    }

    if (!prompt) {
        await sendMessage(senderId,
            '⚠️ *Instruction manquante*\n\nUtilise le format : `editor <instruction> | <url_image>`'
        );
        return;
    }

    if (imageUrl) {
        const base64 = await downloadImageAsBase64(imageUrl);
        state.images = [base64 || imageUrl];
        await processEdit(senderId, prompt, state, api);
        return;
    }

    if (state.images.length > 0) {
        await processEdit(senderId, prompt, state, api);
        return;
    }

    await sendMessage(senderId,
        '⚠️ *Aucune image reçue*\n\nEnvoie d\'abord une ou plusieurs photos, ou indique une URL :\n`editor <instruction> | <url_image>`'
    );
};

/**
 * Lance l'édition selon le nombre d'images collectées :
 *  - 1 image  -> /api/image (édition simple)
 *  - 2+ images -> /api/blend (fusion)
 */
async function processEdit(senderId, prompt, state, api) {
    const images = state.images;
    const model = state.model || 'flux-2-klein';

    await sendMessage(senderId,
        '🎨 *Génération en cours...*\n\n' +
        '🧠 Modèle : *' + model + '*\n' +
        '✏️ Instruction : *' + prompt + '*\n' +
        (images.length > 1 ? `🖼️ ${images.length} photos à combiner.\n` : '') +
        '⏳ Le rendu peut prendre 10 à 30 secondes. Merci de patienter...'
    );

    try {
        let response;

        if (images.length >= 2) {
            const payload = {
                prompt,
                uid: senderId,
                model,
            };
            images.forEach((img, i) => {
                if (img.startsWith('data:')) {
                    payload[`image_b64_${i + 1}`] = img;
                } else {
                    payload[`image_url${i + 1}`] = img;
                }
            });

            response = await axios.post(API_BLEND, payload, {
                headers: { 'Content-Type': 'application/json' },
                maxBodyLength: 100 * 1024 * 1024,
                timeout: API_TIMEOUT,
            });
        } else {
            const img = images[0];
            if (img.startsWith('data:')) {
                response = await axios.post(API_IMAGE, {
                    prompt,
                    uid: senderId,
                    image_b64: img,
                    model,
                }, {
                    headers: { 'Content-Type': 'application/json' },
                    maxBodyLength: 50 * 1024 * 1024,
                    timeout: API_TIMEOUT,
                });
            } else {
                response = await axios.get(API_IMAGE, {
                    params: { prompt, uid: senderId, image_url: img, model },
                    timeout: API_TIMEOUT,
                });
            }
        }

        const data = response.data;

        if (!data || !data.success) {
            const errText = extractErrorMessage({ response });
            await sendMessage(senderId,
                '❌ *Édition impossible*\n\n' +
                (errText ? 'ℹ️ ' + errText : 'Une erreur inconnue est survenue.')
            );
            return;
        }

        const outImages = data.images || [];
        if (outImages.length === 0 || !outImages[0].url) {
            await sendMessage(senderId, '❌ *Aucune image n\'a été générée.*\n\nMerci de réessayer.');
            return;
        }

        const resultUrl = outImages[0].url;

        const sent = await sendImageByUrl(senderId, resultUrl);
        if (sent) {
            await sendMessage(senderId, '✅ *Voici ton image éditée !*');
        } else {
            await sendMessage(senderId,
                '✅ *Image éditée avec succès !*\n\n🖼️ *Lien direct :*\n' + resultUrl
            );
        }

        // Réinitialiser après succès
        state.images = [];
        state.model = null;

    } catch (error) {
        console.error('Erreur commande editor:', error.message);
        const apiError = extractErrorMessage(error);
        if (apiError) {
            await sendMessage(senderId, '⚠️ *Erreur de l\'API d\'édition :*\n\n' + apiError);
        } else {
            await sendMessage(senderId,
                '❌ *Erreur de connexion*\n\nLe service d\'édition est momentanément indisponible.\nMerci de réessayer.'
            );
        }
    }
}
