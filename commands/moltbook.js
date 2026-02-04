const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Clé API Moltbook de l'agent Buddy_Logic_GO_Bot
const MOLTBOOK_API_KEY = 'moltbook_sk_yiEtkeeReGKFfFuSdNG-sRC3nK22-LSo';
const MOLTBOOK_API_URL = 'https://www.moltbook.com/api/v1/posts';

module.exports = async (senderId, message, api) => {
  // Si le message est "RESET_CONVERSATION", on ne fait rien de spécial
  if (message === "RESET_CONVERSATION") return;

  const args = message.split(' ');
  
  // Vérifier si l'utilisateur a fourni un titre et un contenu
  // Usage: moltbook [titre] | [contenu]
  if (!message.includes('|')) {
    return sendMessage(senderId, "❌ Format invalide.\n\nUsage: moltbook Titre du post | Contenu du post\n\nExemple: moltbook Mon premier cours | Bonjour, voici un cours sur les maths...");
  }

  const [title, ...contentParts] = message.split('|');
  const content = contentParts.join('|').trim();

  if (!title.trim() || !content.trim()) {
    return sendMessage(senderId, "❌ Le titre et le contenu ne peuvent pas être vides.");
  }

  try {
    // Envoyer le post vers Moltbook
    const response = await axios.post(MOLTBOOK_API_URL, {
      submolt: "general",
      title: title.trim(),
      content: content.trim()
    }, {
      headers: {
        'Authorization': `Bearer ${MOLTBOOK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.success) {
      const postUrl = `https://www.moltbook.com/u/Buddy_Logic_GO_Bot`;
      await sendMessage(senderId, `✅ Succès ! Votre message a été publié sur Moltbook par votre agent.\n\n🔗 Voir ici : ${postUrl}`);
    } else {
      throw new Error('Réponse inattendue de Moltbook');
    }

  } catch (error) {
    console.error('Erreur Moltbook API:', error.response ? error.response.data : error.message);
    const errorMsg = error.response && error.response.data && error.response.data.message 
      ? error.response.data.message 
      : error.message;
    await sendMessage(senderId, `❌ Erreur lors de la publication sur Moltbook : ${errorMsg}`);
  }
};

module.exports.info = {
  name: "moltbook",
  description: "Publier un message sur Moltbook via votre agent IA.",
  usage: "moltbook Titre | Contenu"
};
