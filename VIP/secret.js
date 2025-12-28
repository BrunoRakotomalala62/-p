const fs = require('fs-extra');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

const DATA_FILE = path.join(__dirname, '../SECRET/secret.txt');

function getImageData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Erreur lecture secret.txt:', error);
    }
    return {};
}

const ITEMS_PER_PAGE = 10;
const userSessions = new Map();

module.exports = async (senderId, prompt) => {
    // Admin check logic - Hardcoded admin UID
    const adminIds = ['5986125634817413']; 
    if (!adminIds.includes(senderId)) {
        return; // Ignore if user is NOT an admin
    }

    const IMAGE_DATA = getImageData();
    const input = prompt.trim();
    const inputLower = input.toLowerCase();
    let session = userSessions.get(senderId) || {};

    // Pagination for Category List or Images
    const pageMatch = inputLower.match(/^page\s*(\d+)$/i);
    if (pageMatch) {
        const page = parseInt(pageMatch[1]);
        if (session.activeCategory) {
            await displayImagesPage(senderId, session.activeCategory, page, IMAGE_DATA);
        } else {
            await displayCategoriesList(senderId, page, IMAGE_DATA);
        }
        return;
    }

    // Number selection
    if (/^\d+$/.test(input)) {
        const index = parseInt(input) - 1;
        if (session.categoriesList && !session.activeCategory) {
            if (index >= 0 && index < session.categoriesList.length) {
                const category = session.categoriesList[index];
                session.activeCategory = category;
                userSessions.set(senderId, session);
                await displayImagesPage(senderId, category, 1, IMAGE_DATA);
            } else {
                await sendMessage(senderId, "Numéro invalide.");
            }
            return;
        }
    }

    // Go back to list
    if (inputLower === 'retour' || inputLower === 'stop') {
        session.activeCategory = null;
        userSessions.set(senderId, session);
        await displayCategoriesList(senderId, 1, IMAGE_DATA);
        return;
    }

    // Show category list
    if (inputLower === 'secret' || input === '') {
        session.activeCategory = null;
        userSessions.set(senderId, session);
        await displayCategoriesList(senderId, 1, IMAGE_DATA);
        return;
    }

    // Direct search
    for (const category in IMAGE_DATA) {
        if (inputLower.includes(category.toLowerCase())) {
            session.activeCategory = category;
            userSessions.set(senderId, session);
            await displayImagesPage(senderId, category, 1, IMAGE_DATA);
            return;
        }
    }

    await sendMessage(senderId, "Commande non reconnue. Tapez 'secret' pour voir la liste.");
};

async function displayCategoriesList(senderId, page, IMAGE_DATA) {
    const categories = Object.keys(IMAGE_DATA);
    const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE);
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const pageCategories = categories.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    userSessions.set(senderId, { categoriesList: pageCategories, currentPage: page, activeCategory: null });

    let message = "📁 LISTE DES CATÉGORIES\n━━━━━━━━━━━━━━━\n";
    pageCategories.forEach((cat, i) => {
        message += `${i + 1}- ${cat}\n`;
    });
    message += `━━━━━━━━━━━━━━━\nPage ${page}/${totalPages}\n\nTapez le numéro pour choisir une catégorie.`;
    if (page < totalPages) message += `\nTapez "page ${page + 1}" pour la suite.`;
    
    await sendMessage(senderId, message);
}

async function displayImagesPage(senderId, category, page, IMAGE_DATA) {
    const images = IMAGE_DATA[category] || [];
    const totalPages = Math.ceil(images.length / ITEMS_PER_PAGE);
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const pageImages = images.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    if (pageImages.length === 0) {
        await sendMessage(senderId, "Aucune image trouvée.");
        return;
    }

    await sendMessage(senderId, `Envoi des images de ${category} (Page ${page}/${totalPages})...`);

    for (let i = 0; i < pageImages.length; i++) {
        await sendMessage(senderId, {
            attachment: {
                type: 'image',
                payload: { url: pageImages[i], is_reusable: true }
            }
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    let footer = `━━━━━━━━━━━━━━━\nCatégorie: ${category}\nPage ${page}/${totalPages}`;
    if (page < totalPages) footer += `\nTapez "page ${page + 1}" pour la suite.`;
    footer += `\nTapez "retour" pour la liste.`;
    
    await sendMessage(senderId, footer);
}