const sendMessage = require('../handles/sendMessage');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SECRET_FILE = path.join(__dirname, '../Sary/secret.txt');
const ADMIN_IDS = ['5986125634817413'];
const userSessions = new Map();

function loadSecretData() {
    const content = fs.readFileSync(SECRET_FILE, 'utf8');
    const data = {};
    let currentName = null;

    for (const rawLine of content.split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;

        const nameMatch = line.match(/^\[(.+)\]$/);
        if (nameMatch) {
            currentName = nameMatch[1].trim();
            data[currentName] = [];
        } else if (currentName && line.startsWith('http')) {
            data[currentName].push(line);
        }
    }
    return data;
}

async function isImageValid(url) {
    try {
        const response = await axios.head(url, { timeout: 6000 });
        const ct = response.headers['content-type'] || '';
        return response.status === 200 && ct.startsWith('image/');
    } catch {
        return false;
    }
}

async function filterValidImages(urls) {
    const results = await Promise.all(urls.map(u => isImageValid(u)));
    return urls.filter((_, i) => results[i]);
}

module.exports = async (senderId, prompt) => {
    if (!ADMIN_IDS.includes(senderId)) return;

    const input = prompt.trim();
    const inputLower = input.toLowerCase();
    let session = userSessions.get(senderId) || {};

    if (inputLower === 'retour' || inputLower === 'stop' || inputLower === 'back') {
        session.activeCategory = null;
        session.validatedImages = null;
        userSessions.set(senderId, session);
        await showMenu(senderId);
        return;
    }

    if (inputLower === 'secret' || input === '') {
        session.activeCategory = null;
        session.validatedImages = null;
        userSessions.set(senderId, session);
        await showMenu(senderId);
        return;
    }

    if (/^\d+$/.test(input)) {
        const index = parseInt(input) - 1;
        const IMAGE_DATA = loadSecretData();
        const names = Object.keys(IMAGE_DATA);

        if (session.activeCategory) {
            if (index >= 0 && index < names.length) {
                const chosen = names[index];
                await switchCategory(senderId, session, chosen, IMAGE_DATA);
            } else {
                await sendMessage(senderId, '❌ Numéro invalide. Tapez "retour" pour la liste.');
            }
            return;
        }

        if (index >= 0 && index < names.length) {
            const chosen = names[index];
            await switchCategory(senderId, session, chosen, IMAGE_DATA);
        } else {
            await sendMessage(senderId, '❌ Numéro invalide. Tapez "secret" pour la liste.');
        }
        return;
    }

    await sendMessage(senderId, '❓ Commande non reconnue.\nTapez "secret" pour voir la liste des personnes.');
};

async function switchCategory(senderId, session, name, IMAGE_DATA) {
    session.activeCategory = name;
    session.validatedImages = null;
    userSessions.set(senderId, session);
    await sendImages(senderId, name, IMAGE_DATA[name]);
}

async function showMenu(senderId) {
    const IMAGE_DATA = loadSecretData();
    const names = Object.keys(IMAGE_DATA);

    const header =
        '╔══════════════════════╗\n' +
        '║   🌸  S E C R E T  🌸   ║\n' +
        '╚══════════════════════╝\n' +
        '📋 Choisissez une personne :\n' +
        '──────────────────────\n';

    const list = names.map((name, i) => {
        const count = IMAGE_DATA[name].length;
        const star = count > 1 ? '✨' : '🌙';
        return `${star} ${i + 1}. ${name}  (${count} photo${count > 1 ? 's' : ''})`;
    }).join('\n');

    const footer =
        '\n──────────────────────\n' +
        '💬 Tapez le numéro pour accéder aux photos.\n' +
        '🔙 Tapez "retour" pour revenir ici.';

    await sendMessage(senderId, header + list + footer);
}

async function sendImages(senderId, name, rawUrls) {
    await sendMessage(senderId,
        '╔══════════════════════╗\n' +
        `║  🔍 Vérification des photos...  ║\n` +
        '╚══════════════════════╝\n' +
        `⏳ Validation des images de ${name}...`
    );

    const validUrls = await filterValidImages(rawUrls);

    if (validUrls.length === 0) {
        await sendMessage(senderId,
            `😔 Aucune photo valide trouvée pour *${name}*.\n` +
            'Tapez "retour" pour choisir une autre personne.'
        );
        return;
    }

    await sendMessage(senderId,
        '╔══════════════════════╗\n' +
        `║  💖  ${name.toUpperCase()}  💖  ║\n` +
        '╚══════════════════════╝\n' +
        `📸 Envoi de ${validUrls.length} photo${validUrls.length > 1 ? 's' : ''} en cours...`
    );

    await new Promise(r => setTimeout(r, 800));

    for (let i = 0; i < validUrls.length; i++) {
        await sendMessage(senderId, {
            attachment: {
                type: 'image',
                payload: { url: validUrls[i], is_reusable: true }
            }
        });
        if (i < validUrls.length - 1) {
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    await sendMessage(senderId,
        '──────────────────────\n' +
        `✅ ${validUrls.length} photo${validUrls.length > 1 ? 's' : ''} envoyée${validUrls.length > 1 ? 's' : ''} — ${name}\n` +
        '──────────────────────\n' +
        '🔢 Tapez un numéro pour une autre personne.\n' +
        '🔙 Tapez "retour" pour la liste.'
    );
}
