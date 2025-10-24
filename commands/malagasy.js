
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// URL de base pour l'API GPT-4.1
const API_BASE_URL = 'https://miko-utilis.vercel.app/api/gpt-4.1';

module.exports = async (senderId, prompt) => {
    try {
        // Si le prompt est vide
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🇲🇬 Bonjour! Je peux générer des histoires en malgache. Demandez-moi par exemple: 'milaza angano iray' ou posez votre question en malgache!");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "⏳ Création d'une histoire en malgache...");

        // Construire l'URL de l'API
        const apiUrl = `${API_BASE_URL}?query=${encodeURIComponent(prompt)}&userId=${senderId}`;
        
        // Appel à l'API
        const response = await axios.get(apiUrl);
        
        // Vérifier si la réponse est valide
        if (response.data && response.data.data && response.data.data.response) {
            let reply = response.data.data.response;
            
            // Fonction pour convertir le texte en caractères Unicode gras
            const toBoldUnicode = (text) => {
                const boldMap = {
                    'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝',
                    'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧',
                    'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
                    'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷',
                    'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁',
                    'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
                    '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
                };
                
                return text.split('').map(char => boldMap[char] || char).join('');
            };
            
            // Remplacer les mots entre ** par leur version en gras Unicode
            reply = reply.replace(/\*\*(.*?)\*\*/g, (match, content) => {
                return toBoldUnicode(content);
            });
            
            // Remplacer les titres ### par leur version en gras Unicode (sans les ###)
            reply = reply.replace(/###\s*(.*?)(\s*:)?$/gm, (match, content, colon) => {
                return toBoldUnicode(content) + (colon || '');
            });
            
            // Formater la réponse
            const formattedReply = `🇲🇬✅ FITIAVANA MLG ✅🇲🇬

${reply}`;

            // Envoyer la réponse
            await sendMessage(senderId, formattedReply);
        } else {
            await sendMessage(senderId, "❌ Aucune réponse reçue de l'API. Veuillez réessayer.");
        }

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Malagasy:", error);
        
        // Message d'erreur
        await sendMessage(senderId, `
⚠️ *ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la génération de l'histoire.
Veuillez réessayer dans quelques instants.

🔄 Si le problème persiste, contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "malagasy",
    description: "Génère des histoires et répond à vos questions en malgache avec GPT-4.1.",
    usage: "Envoyez 'malagasy <votre question en malgache>' par exemple: 'malagasy milaza angano iray'"
};
