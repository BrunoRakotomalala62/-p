const sendMessage = require('../handles/sendMessage');

const IMAGE_DATA = {
    "Florette": [
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b6277-21ac-7523-81bb-d1feb15a0d63/1766891780355-019b62f4-55dd-70dc-b65d-8bc86d1db71c.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20251228%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20251228T031620Z&X-Amz-Expires=3600&X-Amz-Signature=5acf4d8c3bd4a21c36dcdc683757889bfad9170f3b6d8b613156d69ea0369fe1&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject",
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b6277-21ac-7523-81bb-d1feb15a0d63/1766893268372-019b630b-5633-70ca-9444-06875b00d2ea.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20251228%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20251228T034109Z&X-Amz-Expires=3600&X-Amz-Signature=330523f4c09601fc0f441612719028de51af062cb1ff2812c9969406ff882670&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
    ],
    "Aina": [
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b6277-21ac-7523-81bb-d1feb15a0d63/1766892265250-019b62fb-c81d-7286-8274-53b788b6b3c5.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20251228%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20251228T032426Z&X-Amz-Expires=3600&X-Amz-Signature=3a58e34a25318cb8eab70ea6988176b4891c2dbe23b1e487fd135b407e123ea8&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject",
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b6277-21ac-7523-81bb-d1feb15a0d63/1766892998599-019b6306-f417-78aa-8e53-084dabdb3516.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20251228%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20251228T033639Z&X-Amz-Expires=3600&X-Amz-Signature=724b906c143063c8338615784bedfb3436bcfb027766e5c7d6fb34db723960ab&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
    ],
    "Narindra": [
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b6277-21ac-7523-81bb-d1feb15a0d63/1766906008820-019b63cd-72f9-728e-b646-4a9feaee3670.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20251228%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20251228T071329Z&X-Amz-Expires=3600&X-Amz-Signature=f791c503afe3a388e3c8fdebb2d52a2df99a4f2738f9dde4ad6d615bd6dad75d&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject" ],
    "Vakana": [
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b6277-21ac-7523-81bb-d1feb15a0d63/1766906318264-019b63d2-390a-71b8-9889-c0e7961f0d8e.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20251228%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20251228T071838Z&X-Amz-Expires=3600&X-Amz-Signature=ee8382bfe82d3dea395b097e7e1cdeab3d688cf5da212abe71290f4e3907559d&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject" ],
    "Autres": []
};

const ITEMS_PER_PAGE = 10;
const userSessions = new Map();

module.exports = async (senderId, prompt) => {
    // Admin check logic - Hardcoded admin UID
    const adminIds = ['5986125634817413']; 
    if (!adminIds.includes(senderId)) {
        return; // Ignore if user is NOT an admin
    }

    const input = prompt.trim();
    const inputLower = input.toLowerCase();
    let session = userSessions.get(senderId) || {};

    // Pagination for Category List or Images
    const pageMatch = inputLower.match(/^page\s*(\d+)$/i);
    if (pageMatch) {
        const page = parseInt(pageMatch[1]);
        if (session.activeCategory) {
            await displayImagesPage(senderId, session.activeCategory, page);
        } else {
            await displayCategoriesList(senderId, page);
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
                await displayImagesPage(senderId, category, 1);
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
        await displayCategoriesList(senderId, 1);
        return;
    }

    // Show category list
    if (inputLower === 'secret' || input === '') {
        session.activeCategory = null;
        userSessions.set(senderId, session);
        await displayCategoriesList(senderId, 1);
        return;
    }

    // Direct search
    for (const category in IMAGE_DATA) {
        if (inputLower.includes(category.toLowerCase())) {
            session.activeCategory = category;
            userSessions.set(senderId, session);
            await displayImagesPage(senderId, category, 1);
            return;
        }
    }

    await sendMessage(senderId, "Commande non reconnue. Tapez 'secret' pour voir la liste.");
};

async function displayCategoriesList(senderId, page) {
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

async function displayImagesPage(senderId, category, page) {
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
