const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

let userSessions = {};

module.exports = async (senderId, prompt) => {
    try {
        if (!prompt || prompt.trim() === '') {
            const helpMessage = `
╔══════════════════════════════╗
║    🌿 𝗢𝗛𝗔𝗕𝗢𝗟𝗔𝗡𝗔 𝗠𝗔𝗟𝗔𝗚𝗔𝗦𝗬 🌿    ║
╚══════════════════════════════╝

📖 𝗙𝗮𝗻𝗼𝗿𝗼𝗮𝗻𝗮:
Mitady ohabolana malagasy ianao?
Ity commande ity dia hanampy anao hahita ireo ohabolana tsara indrindra!

━━━━━━━━━━━━━━━━━━━━━━━━━━

🔎 𝗙𝗮𝗺𝗽𝗶𝗮𝘀𝗮𝗻𝗮:

   📌 ohabolana <teny>
      ➜ Hitady ohabolana misy io teny io

   📌 ohabolana <laharana>
      ➜ Hijery pejy hafa (ohatra: 2, 3...)

━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 𝗢𝗵𝗮𝘁𝗿𝗮:
   • ohabolana fitiavana
   • ohabolana fanantenana
   • ohabolana fihavanana
   • ohabolana fahendrena

━━━━━━━━━━━━━━━━━━━━━━━━━━

🌺 "Ny fianarana no lova tsara indrindra"

╚══════════════════════════════╝`;
            await sendMessage(senderId, helpMessage);
            return;
        }

        if (isNaN(prompt)) {
            userSessions[senderId] = {
                keyword: prompt.trim(),
                page: 1
            };
        } else {
            if (userSessions[senderId] && userSessions[senderId].keyword) {
                userSessions[senderId].page = parseInt(prompt);
            } else {
                const errorMsg = `
╔══════════════════════════════╗
║      ⚠️ 𝗙𝗮𝗻𝗮𝗺𝗽𝗶𝗮𝗻𝗮 ⚠️       ║
╚══════════════════════════════╝

❌ Tsy mbola nanao fikarohana ianao!

📝 Mila manoratra aloha hoe:
   ➜ ohabolana <teny>

💡 Ohatra: ohabolana fitiavana

━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                await sendMessage(senderId, errorMsg);
                return;
            }
        }

        const keyword = userSessions[senderId].keyword;
        const page = userSessions[senderId].page;

        const searchingMsg = `
🔍 𝗠𝗶𝘁𝗮𝗱𝘆 𝗼𝗵𝗮𝗯𝗼𝗹𝗮𝗻𝗮...

📚 Teny: "${keyword}"
📄 Pejy: ${page}

⏳ Andraso kely azafady...`;
        await sendMessage(senderId, searchingMsg);

        const apiUrl = `https://ohabolana-lac.vercel.app/ohabolana?fanontaniana=${encodeURIComponent(keyword)}&page=${page}`;
        const response = await axios.get(apiUrl);
        const ohabolanaList = response.data;

        if (!ohabolanaList || ohabolanaList.length === 0) {
            const noResultMsg = `
╔══════════════════════════════╗
║     📭 𝗧𝗦𝗬 𝗠𝗜𝗦𝗬 𝗩𝗔𝗟𝗜𝗡𝗬 📭     ║
╚══════════════════════════════╝

😔 Tsy nahitana ohabolana ho an'ny:
   "${keyword}" (pejy ${page})

━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 𝗧𝗼𝗿𝗼-𝗵𝗲𝘃𝗶𝘁𝗿𝗮:
   • Andramo teny hafa
   • Jereo raha marina ny tsipelina
   • Andramo pejy hafa (1, 2, 3...)

━━━━━━━━━━━━━━━━━━━━━━━━━━`;
            await sendMessage(senderId, noResultMsg);
            return;
        }

        const chunkSize = 5;

        for (let i = 0; i < ohabolanaList.length; i += chunkSize) {
            const chunk = ohabolanaList.slice(i, i + chunkSize);
            const partNumber = Math.floor(i / chunkSize) + 1;
            const totalParts = Math.ceil(ohabolanaList.length / chunkSize);

            let reply = `
╔══════════════════════════════╗
║    🌿 𝗢𝗛𝗔𝗕𝗢𝗟𝗔𝗡𝗔 𝗠𝗔𝗟𝗔𝗚𝗔𝗦𝗬 🌿    ║
╚══════════════════════════════╝

🔎 𝗧𝗲𝗻𝘆: "${keyword}"
📄 𝗣𝗲𝗷𝘆 ${page} • 𝗙𝗶𝘇𝗮𝗿𝗮𝗻𝗮 ${partNumber}/${totalParts}

━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

            chunk.forEach((ohabolana, index) => {
                const num = ohabolana.number || (i + index + 1);
                const decorations = ['🌸', '🌺', '🌻', '🌼', '🌷'];
                const decoration = decorations[index % decorations.length];
                
                reply += `
${decoration} 𝗢𝗵𝗮𝗯𝗼𝗹𝗮𝗻𝗮 #${num}
┃
┃ 📜 "${ohabolana.text}"
┃
┗━➤ ✍️ ${ohabolana.author || 'Tsy fantatra'}
`;
            });

            reply += `
━━━━━━━━━━━━━━━━━━━━━━━━━━`;

            if (i + chunkSize >= ohabolanaList.length) {
                reply += `

📚 𝗙𝗶𝘁𝗮𝗿𝗶𝗵𝗮𝗻𝗮:
   ⬅️ Pejy aloha: ohabolana ${page > 1 ? page - 1 : 1}
   ➡️ Pejy manaraka: ohabolana ${page + 1}
   🔄 Fikarohana vaovao: ohabolana <teny>

🌺 Misaotra nahavita nijery! 🌺`;
            }

            await sendMessage(senderId, reply);

            if (i + chunkSize < ohabolanaList.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Ohabolana:', error);

        const errorMessage = `
╔══════════════════════════════╗
║       ❌ 𝗧𝗦𝗬 𝗠𝗔𝗧𝗬 ❌        ║
╚══════════════════════════════╝

😔 Nisy olana teo am-pikarohana.

━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 𝗔𝘇𝗮𝗳𝗮𝗱𝘆 𝗮𝗻𝗱𝗿𝗮𝗺𝗼 𝗶𝗻𝗱𝗿𝗮𝘆:
   • Avereno ny fikarohana
   • Raha mbola tsy mandeha, andraso kely

━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        await sendMessage(senderId, errorMessage);
    }
};

module.exports.info = {
    name: "ohabolana",
    description: "Mitady sy mampiseho ohabolana malagasy tsara tarehy miaraka amin'ny pagination.",
    usage: `🌿 𝗙𝗮𝗺𝗽𝗶𝗮𝘀𝗮𝗻𝗮 𝗢𝗵𝗮𝗯𝗼𝗹𝗮𝗻𝗮:

📌 ohabolana
   ➜ Hahita torolalana

📌 ohabolana <teny>
   ➜ Hitady ohabolana (ohatra: ohabolana fitiavana)

📌 ohabolana <laharana>
   ➜ Hijery pejy hafa (ohatra: 2, 3...)`
};
