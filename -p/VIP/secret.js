const sendMessage = require('../handles/sendMessage');

// Image data directly integrated into the script
const IMAGE_DATA = {
    "Florette": [
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b6277-21ac-7523-81bb-d1feb15a0d63/1766891780355-019b62f4-55dd-70dc-b65d-8bc86d1db71c.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20251228%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20251228T031620Z&X-Amz-Expires=3600&X-Amz-Signature=5acf4d8c3bd4a21c36dcdc683757889bfad9170f3b6d8b613156d69ea0369fe1&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject",
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b6277-21ac-7523-81bb-d1feb15a0d63/1766893268372-019b630b-5633-70ca-9444-06875b00d2ea.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20251228%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20251228T034109Z&X-Amz-Expires=3600&X-Amz-Signature=330523f4c09601fc0f441612719028de51af062cb1ff2812c9969406ff882670&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
    ],
    "Aina": [
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b6277-21ac-7523-81bb-d1feb15a0d63/1766892265250-019b62fb-c81d-7286-8274-53b788b6b3c5.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20251228%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20251228T032426Z&X-Amz-Expires=3600&X-Amz-Signature=3a58e34a25318cb8eab70ea6988176b4891c2dbe23b1e487fd135b407e123ea8&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject",
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b6277-21ac-7523-81bb-d1feb15a0d63/1766892998599-019b6306-f417-78aa-8e53-084dabdb3516.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20251228%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20251228T033639Z&X-Amz-Expires=3600&X-Amz-Signature=724b906c143063c8338615784bedfb3436bcfb027766e5c7d6fb34db723960ab&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject",
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b8f7a-764e-78e2-8a0c-0fdf61276b62/1767755962479-1767639233754-019b8f81-df6f-7d3a-b7ad-176d2ece69f6.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20260107%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260107T032110Z&X-Amz-Expires=3600&X-Amz-Signature=cd5d1b5a2f1f16b24cd54980c317aa9cab9440b39b381d10acc3707750410984&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject",
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b8f7a-764e-78e2-8a0c-0fdf61276b62/1767756114622-1767639318815-019b8f83-24fe-7a84-b7f5-544dff05f443.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20260107%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260107T032157Z&X-Amz-Expires=3600&X-Amz-Signature=7b76018bd7a0839d8c8d862d43e40fbe06d11d54ceb5886d8f372f8b25f20ee7&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject",
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b8f7a-764e-78e2-8a0c-0fdf61276b62/1767756331758-019b967c-9f4a-7ced-81da-6e8ff9b7ec78.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20260107%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260107T032843Z&X-Amz-Expires=3600&X-Amz-Signature=2efe3ae03a99d3bee40150e52c5ffc719dc9c6cb62c4768af8e77b3177d922d0&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
    ],
    "Narindra": [
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b6277-21ac-7523-81bb-d1feb15a0d63/1766906008820-019b63cd-72f9-728e-b646-4a9feaee3670.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20251228%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20251228T071329Z&X-Amz-Expires=3600&X-Amz-Signature=f791c503afe3a388e3c8fdebb2d52a2df99a4f2738f9dde4ad6d615bd6dad75d&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
    ],
    "Vakana": [
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b6277-21ac-7523-81bb-d1feb15a0d63/1766906318264-019b63d2-390a-71b8-9889-c0e7961f0d8e.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20251228%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20251228T071838Z&X-Amz-Expires=3600&X-Amz-Signature=ee8382bfe82d3dea395b097e7e1cdeab3d688cf5da212abe71290f4e3907559d&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
    ],
    "Fitahiana": [
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b8f7a-764e-78e2-8a0c-0fdf61276b62/1767752521364-019b9642-54f9-7a06-9e27-dcea41ae5618.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20260107%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260107T022547Z&X-Amz-Expires=3600&X-Amz-Signature=9491e0858c0ad132758f54ffad7a1989e0ec2681cb27503576c558d318dfcb84&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject",
        "https://messages-prod.27c852f3500f38c1e7786e2c9ff9e48f.r2.cloudflarestorage.com/019b8f7a-764e-78e2-8a0c-0fdf61276b62/1767753996623-019b9658-caef-7147-bc57-f385a5c01611.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=af634fe044bd071ab4c5d356fdace60f%2F20260107%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260107T024925Z&X-Amz-Expires=3600&X-Amz-Signature=7b713ccf22d1c3d30db7e1e2a621b58529197bf23914cfee0e8ac938f6fc4f62&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
    ],
    "Sydonie": [
        "https://static.gamsgocdn.com/crontab_prod/2353840/1/1032/1114/vjxvjs4uhd5jqk3c-0/276b160b43865b4dd18c3607e9a50190.png",
        "https://assets.grok.com/users/3858979d-051d-42fd-9eeb-16c3b652d8cf/generated/791d5c21-1126-426e-a89a-5c52bb905551/image.jpg?cache=1"
    ],
    "Tiphanie Nadia": [
        "https://assets.grok.com/users/3858979d-051d-42fd-9eeb-16c3b652d8cf/generated/b8a77d6a-39a1-42e4-b2ea-3efd1abce81e/image.jpg",
        "https://lh3.googleusercontent.com/rd-gg/AIJ2gl-dmmPVNv7rh1gi3AxOX890InY-mt0JKGQTGXlknv9hwMX_tIT3E9QcpU5lMJo1JUEKqFDErMCM8D7Mp9jJsPLooCoMLEPc-7l97A-9rCqKbabBfUqgtjAIU21Eow3FJIksGW65wU5X2agdU-nFmsoUAbDOQAmMW8xNmu5UZhS8mjXdaV48KcGDFabBIm4hxmI0ZuHc9lRdYA_QorV_osEGhUVNdahZMlhkotBze2uLkAISUmw0wchqWm09L1fwuoWFvaeslNjlyqruW9i9NnoRZYE-uUdZabYfbEqnRvlmwJjA0aeTUnjFBoIn9lj6p5-qioNiuvvzZeMEzsTTFCze7ZAVzZ5cwkHpGQmmCmX4SOFl2XRvfC57ej8hLzXTKo2NhrqhS_VIi-_CGhMB7JqhI0LG7Vnc7s-jaA_dTG3S-c2KwAEb16jFXR2C_yQuCDwNHlywYVpotTKKX7dXoflPmizw8GVm8sutrMr9oZbRVgnOKGeSSMgKH9uvbqDguLwgUOzISFubXymAJJXFr7Zlu42JaQxSCFdhNX2QevaekCatlVj-T2ZzFDH1z616v821duVh1B7bJVy7wcrTVLqUU5aPFwxEq8X4FCB0HoO1J4NxSIERU3P3e4cG5PQ2JjSaNDVi7uGV75uASu-naFAfa8GTrcJXwTWnvya6SJ2-Ytq7BjIP0KnwFNxQ9ZJ362a5-pQjoJudLECqLudhu4jvQeFXcev2gLZFgjXLrKmpTFHl0hftqrNLY1sMf41KcRhfnzWawD8QxQ2eD_GJ4X2h6-NeCBnIdKeqieJXFf_AuT7zkNGPSs_2s8hJvvLEOJk5Bh89SdzqWyM33TtGg_wFHgkbaBhzqTMR5qsSGpuRHL-YINeNvAWmEgdlNxsNHvEraF1FByKjUBdNj-h-y0TZ0jmitl251d07pDu16w4KJlPv_15WkYPyX9E2iXUEUnVqgwTZr_nOKGJ9fn74zza7MYUddWZWVh38Qx_QOFJAOCy8XD52IYtllRaHuDMnIMc7FFsLjfPOXbcyzbi9qwbYNcLnjdu5jrXJD4uIYoEL3RKTKBKd_iQvQl3k2Z_P3DmHoyDEFVdB2CGyVBTmY0r1qNJq9QhumZFzRjnJP_VN1M3KYdQhNF6thBo2ao-zsoO15jAG4dmmuTHx_wwTVkgKy-XRpeejdUmM-VvDUVwwGcUty5CAdMZ4LGNiBauVjoaBtSfHFRy3pwtcThML8m_8NgzxzXhBdG1KdWiqbFK0SymI5bXrxzPZkaoqzrlhFIGSk_zIU3j30pPjHLmEa8frXVUvjAE9w1zOlZ-YzRloQklqp89PTuww-0a5K4NTL6loPJK-gdIAMV7aCG2vqwBylUD3YoaLCkpf4zhwtGh-fJ0CctZ8bF72qcbC6PKc9Ex4L67Jm_esOZqjjM5eJF7-1LPNzgL8YfPxgN62GFc9_6ESWBqQ5I50Li3i8K8tX71UFmQTKK7qxDlvGiCCtqhgZ2uZ0mvJU8Ssexoc9fqNitTktDSCep1Y2m8uqgwrm65podI-R0sCSSRcVT04zMsy86y1yELKdMSZ6P-rfSJveAA=s1024-rj?authuser=6"
    ],
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
        
        // Si on est déjà dans une catégorie, on permet de changer directement de catégorie
        const categories = Object.keys(IMAGE_DATA);
        if (index >= 0 && index < categories.length) {
            const category = categories[index];
            session.activeCategory = category;
            session.categoriesList = categories; // S'assurer que la liste est à jour
            userSessions.set(senderId, session);
            await displayImagesPage(senderId, category, 1);
            return;
        }

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

    // Initial command: "secret" or searching for categories
    if (inputLower === 'secret' || input === '') {
        session.activeCategory = null;
        userSessions.set(senderId, session);
        await displayCategoriesList(senderId, 1);
        return;
    }

    // Direct search (exact match first, then include)
    const categories = Object.keys(IMAGE_DATA);
    const exactMatch = categories.find(cat => cat.toLowerCase() === inputLower);
    if (exactMatch) {
        session.activeCategory = exactMatch;
        userSessions.set(senderId, session);
        await displayImagesPage(senderId, exactMatch, 1);
        return;
    }

    for (const category of categories) {
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

    // Add a small delay after the header message
    await new Promise(resolve => setTimeout(resolve, 1000));

    for (let i = 0; i < pageImages.length; i++) {
        console.log(`Envoi image ${i + 1}/${pageImages.length} pour ${category}`);
        await sendMessage(senderId, {
            attachment: {
                type: 'image',
                payload: { url: pageImages[i], is_reusable: true }
            }
        });
        // Delay of 2 seconds between images to be safe with Messenger rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    let footer = `━━━━━━━━━━━━━━━\nCatégorie: ${category}\nPage ${page}/${totalPages}`;
    if (page < totalPages) footer += `\nTapez "page ${page + 1}" pour la suite.`;
    footer += `\nTapez "retour" pour la liste.`;
    
    await sendMessage(senderId, footer);
}