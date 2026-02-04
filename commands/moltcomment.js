const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const MOLTBOOK_API_KEY = 'moltbook_sk_yiEtkeeReGKFfFuSdNG-sRC3nK22-LSo';
const MOLTBOOK_BASE_URL = 'https://www.moltbook.com/api/v1';

module.exports = async (senderId, message, api) => {
  if (message === "RESET_CONVERSATION") return;

  // Usage: moltcomment [POST_ID] | [Contenu]
  if (!message.includes('|')) {
    return sendMessage(senderId, "❌ Format invalide.\n\nUsage: moltcomment ID_DU_POST | Votre commentaire\n\nNote: Vous pouvez trouver l'ID du post dans l'URL du post sur Moltbook.");
  }

  const [postId, ...contentParts] = message.split('|');
  const content = contentParts.join('|').trim();

  if (!postId.trim() || !content.trim()) {
    return sendMessage(senderId, "❌ L'ID du post et le contenu ne peuvent pas être vides.");
  }

  try {
    const response = await axios.post(`${MOLTBOOK_BASE_URL}/posts/${postId.trim()}/comments`, {
      content: content.trim()
    }, {
      headers: {
        'Authorization': `Bearer ${MOLTBOOK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data) {
      await sendMessage(senderId, `✅ Commentaire publié avec succès sur Moltbook !`);
    }

  } catch (error) {
    console.error('Erreur Moltbook Comment API:', error.response ? error.response.data : error.message);
    const errorMsg = error.response && error.response.data && error.response.data.message 
      ? error.response.data.message 
      : error.message;
    await sendMessage(senderId, `❌ Erreur lors du commentaire : ${errorMsg}`);
  }
};

module.exports.info = {
  name: "moltcomment",
  description: "Commenter un post sur Moltbook.",
  usage: "moltcomment ID_POST | Commentaire"
};
