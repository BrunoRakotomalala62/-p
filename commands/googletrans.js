
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt) => {
    try {
        // Diviser le prompt pour extraire le texte et le code de langue
        // Format attendu: "texte à traduire LANGUE"
        const parts = prompt.trim().split(/\s+/);
        
        // Le dernier mot est considéré comme le code de langue
        const targetLang = parts[parts.length - 1].toUpperCase();
        
        // Le reste est le texte à traduire
        const textToTranslate = parts.slice(0, -1).join(' ');

        // Vérifier si le texte et la langue sont fournis
        if (!textToTranslate || parts.length < 2) {
            await sendMessage(senderId, `
🌍 **GOOGLE TRANSLATE** 🌍
━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 **Format d'utilisation :**
googletrans <texte> <code langue>

📝 **Exemple :**
googletrans Bonjour comment ça va ? MG

🗣️ **Codes de langue disponibles :**
• MG (Malgache)
• FR (Français)
• EN (Anglais)
• ES (Espagnol)
• DE (Allemand)
• IT (Italien)
• JA (Japonais)
• ZH (Chinois)
• AR (Arabe)
• RU (Russe)

━━━━━━━━━━━━━━━━━━━━━━━━━━
            `.trim());
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "⏳ Traduction en cours...");

        // Construire l'URL de l'API avec le texte et la langue cible
        const apiUrl = `https://rapido.zetsu.xyz/api/translate?text=${encodeURIComponent(textToTranslate)}&lang=${targetLang}`;
        
        // Appeler l'API de traduction
        const response = await axios.get(apiUrl);

        // Vérifier si la réponse est valide
        if (response.data && response.data.translated) {
            const formattedReply = `
🌐 GOOGLE TRANSLATE 🌐
━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 *Texte original* :
${response.data.original}

✨ *Traduction* (${response.data.language}) :
${response.data.translated}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 Propulsé par Google Translate
            `.trim();

            await sendMessage(senderId, formattedReply);
        } else {
            await sendMessage(senderId, "❌ Aucune traduction reçue. Veuillez vérifier le code de langue et réessayer.");
        }

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Google Translate:", error);
        
        await sendMessage(senderId, `
⚠️ *ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la traduction.
Veuillez réessayer dans quelques instants.

💡 Assurez-vous d'utiliser le bon format :
googletrans <texte> <code langue>

Exemple : googletrans Bonjour MG
━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "googletrans",
    description: "Traduit du texte dans différentes langues en utilisant Google Translate.",
    usage: "googletrans <texte> <code langue> - Exemple: googletrans Bonjour comment ça va ? MG"
};
