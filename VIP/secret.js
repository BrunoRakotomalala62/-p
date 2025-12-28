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
    "Autres": []
};

const ITEMS_PER_PAGE = 10;
const userSessions = new Map();

module.exports = async (senderId, prompt) => {
    // Admin check logic - Only allow if user IS an admin
    const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
    if (!adminIds.includes(senderId)) {
        return; // Ignore if user is NOT an admin
    }

    const input = prompt.trim();
    const inputLower = input.toLowerCase();

    // Pagination logic
    const pageMatch = inputLower.match(/^page\s*(\d+)$/);
    if (pageMatch) {
        const page = parseInt(pageMatch[1]);
        const session = userSessions.get(senderId);
        if (session && session.category) {
            await displayCategory(senderId, session.category, page);
            return;
        }
    }

    // Category search
    for (const category in IMAGE_DATA) {
        if (inputLower === category.toLowerCase()) {
            userSessions.set(senderId, { category });
            await displayCategory(senderId, category, 1);
            return;
        }
    }

    // Default help message for admin
    const categories = Object.keys(IMAGE_DATA).join(', ');
    await sendMessage(senderId, `Categories disponibles: ${categories}\nTapez le nom d'une catégorie pour voir les images.`);
};

async function displayCategory(senderId, category, page) {
    const images = IMAGE_DATA[category];
    const totalPages = Math.ceil(images.length / ITEMS_PER_PAGE);
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const pageImages = images.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    if (pageImages.length === 0) {
        await sendMessage(senderId, "Aucune image trouvée pour cette page.");
        return;
    }

    for (let i = 0; i < pageImages.length; i++) {
        const url = pageImages[i];
        await sendMessage(senderId, {
            attachment: {
                type: 'image',
                payload: {
                    url: url,
                    is_reusable: true
                }
            }
        });
        // Small delay between images
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    let footer = `Catégorie: ${category}\nPage ${page}/${totalPages}`;
    if (page < totalPages) {
        footer += `\nTapez "page ${page + 1}" pour la suite.`;
    }
    await sendMessage(senderId, footer);
}
