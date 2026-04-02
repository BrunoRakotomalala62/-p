const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

const BASE_URL = 'https://gemini-image-editor--monsieurtodisoa.replit.app';
const API_ENDPOINT = `${BASE_URL}/api/nanobanana`;

const nanoSessions = {};

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

const getPublicImageUrl = (filename) => {
    const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_CLUSTER;
    if (domain) {
        return `https://${domain}/temp/${filename}`;
    }
    return null;
};

const saveImageBuffer = async (buffer, filename) => {
    const filePath = path.join('/tmp', filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
};

const cleanupFile = (filename) => {
    try {
        const filePath = path.join('/tmp', filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {}
};

const callNanoApi = async (prompt, imageUrl, imageUrl2 = null) => {
    let url = `${API_ENDPOINT}?prompt=${encodeURIComponent(prompt)}&image_url=${encodeURIComponent(imageUrl)}`;
    if (imageUrl2) {
        url += `&image_url2=${encodeURIComponent(imageUrl2)}`;
    }

    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    return Buffer.from(response.data);
};

module.exports = async (senderId, messageText, api, attachments) => {

    if (messageText === "RESET_CONVERSATION") {
        if (nanoSessions[senderId]) {
            cleanupFile(`nano_${senderId}_1.png`);
            cleanupFile(`nano_${senderId}_2.png`);
            cleanupFile(`nano_${senderId}_result.png`);
            delete nanoSessions[senderId];
        }
        return;
    }

    const session = nanoSessions[senderId] || { step: 'idle' };

    // ── Réception d'une image ──────────────────────────────────────────
    if (messageText === "IMAGE_ATTACHMENT" && attachments && attachments.length > 0) {
        const imageUrl = attachments[0].payload.url;

        if (session.step === 'idle' || session.step === 'awaiting_first_image') {
            nanoSessions[senderId] = {
                step: 'awaiting_decision',
                imageUrl1: imageUrl
            };

            await sendMessage(senderId,
                `✅ Première image reçue et enregistrée !\n\n` +
                `Que souhaitez-vous faire maintenant ?\n\n` +
                `📌 Option 1 — Tapez directement votre instruction :\n` +
                `_Ex : "Changer la couleur du vêtement en rouge"_\n\n` +
                `📌 Option 2 — Envoyez une 2ème image pour un effet combiné :\n` +
                `_Ex : mettre deux personnes côte à côte, fusionner des scènes, etc._`
            );
            return;
        }

        if (session.step === 'awaiting_decision' && session.imageUrl1) {
            nanoSessions[senderId] = {
                ...session,
                step: 'awaiting_prompt_two_images',
                imageUrl2: imageUrl
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

        // Cas où l'utilisateur envoie une image hors session
        nanoSessions[senderId] = {
            step: 'awaiting_decision',
            imageUrl1: imageUrl
        };
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

    // Attente de la première image — l'utilisateur a tapé du texte
    if (session.step === 'awaiting_first_image') {
        await sendMessage(senderId,
            `📸 Veuillez d'abord envoyer une image à transformer.\n` +
            `Tapez "stop" pour annuler.`
        );
        return;
    }

    // Annulation
    if (messageText.trim().toLowerCase() === 'stop') {
        cleanupFile(`nano_${senderId}_1.png`);
        cleanupFile(`nano_${senderId}_2.png`);
        cleanupFile(`nano_${senderId}_result.png`);
        delete nanoSessions[senderId];
        await sendMessage(senderId, `🛑 Session NANO annulée. Tapez "nano" pour recommencer.`);
        return;
    }

    // Instruction pour une seule image
    if (session.step === 'awaiting_decision' && session.imageUrl1) {
        const prompt = messageText.trim();

        await sendMessage(senderId,
            `⚙️ Traitement en cours...\n🖼️ Modification de votre image avec l'instruction :\n"${prompt}"\n\n⏳ Cela peut prendre quelques secondes, veuillez patienter...`
        );

        try {
            const imageBuffer = await callNanoApi(prompt, session.imageUrl1);
            const filename = `nano_${senderId}_result_${Date.now()}.png`;
            await saveImageBuffer(imageBuffer, filename);

            const publicUrl = getPublicImageUrl(filename);

            if (publicUrl) {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: { url: publicUrl, is_reusable: true }
                    }
                });
                setTimeout(() => cleanupFile(filename), 60000);
            } else {
                await sendMessage(senderId, `⚠️ Image générée mais impossible de l'envoyer. Réessayez.`);
            }

            await sendMessage(senderId,
                `✅ Transformation réussie !\n\n` +
                `🔄 Voulez-vous faire une autre modification ?\n` +
                `• Envoyez une nouvelle image pour recommencer\n` +
                `• Tapez "stop" pour quitter`
            );

            nanoSessions[senderId] = { step: 'awaiting_first_image' };

        } catch (error) {
            console.error('Erreur NANO API (1 image):', error.message);
            await handleApiError(senderId, error);
            nanoSessions[senderId] = { step: 'awaiting_first_image' };
        }
        return;
    }

    // Instruction pour deux images
    if (session.step === 'awaiting_prompt_two_images' && session.imageUrl1 && session.imageUrl2) {
        const prompt = messageText.trim();

        await sendMessage(senderId,
            `⚙️ Traitement en cours...\n🖼️🖼️ Combinaison de vos deux images avec l'instruction :\n"${prompt}"\n\n⏳ Cela peut prendre quelques secondes, veuillez patienter...`
        );

        try {
            const imageBuffer = await callNanoApi(prompt, session.imageUrl1, session.imageUrl2);
            const filename = `nano_${senderId}_result_${Date.now()}.png`;
            await saveImageBuffer(imageBuffer, filename);

            const publicUrl = getPublicImageUrl(filename);

            if (publicUrl) {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: { url: publicUrl, is_reusable: true }
                    }
                });
                setTimeout(() => cleanupFile(filename), 60000);
            } else {
                await sendMessage(senderId, `⚠️ Image générée mais impossible de l'envoyer. Réessayez.`);
            }

            await sendMessage(senderId,
                `✅ Combinaison réussie !\n\n` +
                `🔄 Voulez-vous continuer ?\n` +
                `• Envoyez une nouvelle image pour recommencer\n` +
                `• Tapez "stop" pour quitter`
            );

            nanoSessions[senderId] = { step: 'awaiting_first_image' };

        } catch (error) {
            console.error('Erreur NANO API (2 images):', error.message);
            await handleApiError(senderId, error);
            nanoSessions[senderId] = { step: 'awaiting_first_image' };
        }
        return;
    }

    // Fallback — relancer la session
    nanoSessions[senderId] = { step: 'awaiting_first_image' };
    await sendMessage(senderId, WELCOME_MSG);
};

const handleApiError = async (senderId, error) => {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
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
