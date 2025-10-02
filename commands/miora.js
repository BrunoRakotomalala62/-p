
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const fontMapping = {
  'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
  'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
  'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
  'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
  'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴',
  'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻',
  'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂',
  'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇'
};

function convertToBold(text) {
  return text.replace(/(?:\*\*(.*?)\*\*|## (.*?)|### (.*?))/g, (match, boldText, h2Text, h3Text) => {
    const targetText = boldText || h2Text || h3Text;
    return [...targetText].map(char => fontMapping[char] || char).join('');
  });
}

function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}

module.exports = async (senderId, prompt) => {
  if (!prompt) {
    await sendMessage(senderId, '𝗘𝗿𝗿𝗼𝗿: 𝗣𝗹𝗲𝗮𝘀𝗲 𝗽𝗿𝗼𝘃𝗶𝗱𝗲 𝗮 𝗽𝗿𝗼𝗺𝗽𝘁 𝗳𝗼𝗿 𝗠𝗲𝘁𝗮 𝗔𝗜.\n𝗘𝘅𝗮𝗺𝗽𝗹𝗲: miora hi there!');
    return;
  }

  try {
    // Envoyer un message de chargement
    await sendMessage(senderId, "⏳ Connexion à Meta AI en cours...");
    
    const apiUrl = `https://jer-ai.gleeze.com/meta?senderid=${encodeURIComponent(senderId)}&message=${encodeURIComponent(prompt)}`;
    const { data } = await axios.get(apiUrl);

    if (!data.response) {
      await sendMessage(senderId, '𝗘𝗿𝗿𝗼𝗿: 𝗡𝗼 𝗿𝗲𝘀𝗽𝗼𝗻𝘀𝗲 𝗿𝗲𝗰𝗲𝗶𝘃𝗲𝗱 𝗳𝗿𝗼𝗺 𝗠𝗲𝘁𝗮 𝗔𝗜.');
      return;
    }

    const formatted = convertToBold(data.response);
    const maxMessageLength = 2000;
    const messages = splitMessageIntoChunks(formatted, maxMessageLength);

    // Attendre un court instant avant d'envoyer la réponse
    await new Promise(resolve => setTimeout(resolve, 1000));

    for (let i = 0; i < messages.length; i++) {
      await sendMessage(senderId, i === 0 ? `∞ | 𝗠𝗲𝘁𝗮 𝗔𝗜 :\n\n${messages[i]}` : messages[i]);
    }

  } catch (error) {
    console.error('Meta AI command error:', error.message);
    await sendMessage(senderId, '𝗘𝗿𝗿𝗼𝗿: 𝗙𝗮𝗶𝗹𝗲𝗱 𝘁𝗼 𝗰𝗼𝗻𝗻𝗲𝗰𝘁 𝘁𝗼 𝗠𝗲𝘁𝗮 𝗔𝗜 𝗔𝗣𝗜.');
  }
};

// Ajouter les informations de la commande
module.exports.info = {
  name: "miora",
  description: "Discutez avec Meta AI, l'assistant intelligent de Facebook.",
  usage: "Envoyez 'miora <message>' pour obtenir une réponse de Meta AI."
};
