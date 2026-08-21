const fs = require('fs-extra');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

const ADMIN_IDS = ['28877400275216924'];

const uidFilePath = path.join(__dirname, '../Facebook/uid.txt');
const vipUidFilePath = path.join(__dirname, '../FacebookVip/uidvip.txt');

const getAllSubscribers = () => {
    const subscribers = new Set();
    
    try {
        if (fs.existsSync(uidFilePath)) {
            const content = fs.readFileSync(uidFilePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
            for (const line of lines) {
                const [uid, expirationDate] = line.split('|');
                if (uid && uid.trim()) {
                    const isValid = new Date(expirationDate?.trim()) > new Date();
                    if (isValid) {
                        subscribers.add(uid.trim());
                    }
                }
            }
        }
    } catch (error) {
        console.error('Erreur lecture uid.txt:', error);
    }
    
    try {
        if (fs.existsSync(vipUidFilePath)) {
            const content = fs.readFileSync(vipUidFilePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
            for (const line of lines) {
                const [uid, expirationDate] = line.split('|');
                if (uid && uid.trim()) {
                    const isValid = new Date(expirationDate?.trim()) > new Date();
                    if (isValid) {
                        subscribers.add(uid.trim());
                    }
                }
            }
        }
    } catch (error) {
        console.error('Erreur lecture uidvip.txt:', error);
    }
    
    ADMIN_IDS.forEach(id => subscribers.add(id));
    
    return Array.from(subscribers);
};

const formatAlertMessage = (message) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    return `
🚨🔔 𝗔𝗟𝗘𝗥𝗧𝗘 𝗜𝗠𝗣𝗢𝗥𝗧𝗔𝗡𝗧𝗘 🔔🚨
╔══════════════════════════╗
║  📢 𝗠𝗘𝗦𝗦𝗔𝗚𝗘 𝗢𝗙𝗙𝗜𝗖𝗜𝗘𝗟  📢  ║
╚══════════════════════════╝

${message}

━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${dateStr}
⏰ ${timeStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 𝗕𝗼𝘁 𝗔𝗱𝗺𝗶𝗻𝗶𝘀𝘁𝗿𝗮𝘁𝗶𝗼𝗻
💬 Merci de votre compréhension !
    `.trim();
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async (senderId, message) => {
    try {
        if (!ADMIN_IDS.includes(senderId)) {
            await sendMessage(senderId, `
⛔ 𝗔𝗖𝗖𝗘̀𝗦 𝗥𝗘𝗙𝗨𝗦𝗘́ ⛔
━━━━━━━━━━━━━━━━━━━
Cette commande est réservée aux administrateurs.

💡 Besoin d'aide ? Contactez l'administrateur.
            `.trim());
            return;
        }

        const alertText = (typeof message === 'string') ? message.trim() : '';

        if (!alertText) {
            await sendMessage(senderId, `
🚨 𝗔𝗟𝗘𝗥𝗧𝗘 - 𝗚𝗨𝗜𝗗𝗘 𝗗'𝗨𝗧𝗜𝗟𝗜𝗦𝗔𝗧𝗜𝗢𝗡 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 𝗖𝗼𝗺𝗺𝗲𝗻𝘁 𝘂𝘁𝗶𝗹𝗶𝘀𝗲𝗿 :
alerte <votre message>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 :
alerte Maintenance prévue ce soir à 22h. Le bot sera temporairement indisponible.

📢 Cette commande envoie votre message à TOUS les abonnés (standard + VIP) en même temps.

⚠️ 𝗔𝘁𝘁𝗲𝗻𝘁𝗶𝗼𝗻 : Utilisez cette commande avec précaution !
            `.trim());
            return;
        }

        const subscribers = getAllSubscribers();
        const totalSubscribers = subscribers.length;

        await sendMessage(senderId, `
📡 𝗘𝗡𝗩𝗢𝗜 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦... 📡
━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 Destinataires : ${totalSubscribers} abonnés
⏳ Veuillez patienter...
        `.trim());

        const formattedMessage = formatAlertMessage(alertText);

        let successCount = 0;
        let failCount = 0;
        const failedUsers = [];

        const batchSize = 10;
        for (let i = 0; i < subscribers.length; i += batchSize) {
            const batch = subscribers.slice(i, i + batchSize);
            
            const promises = batch.map(async (uid) => {
                try {
                    const result = await sendMessage(uid, formattedMessage);
                    if (result.success) {
                        successCount++;
                    } else {
                        failCount++;
                        failedUsers.push(uid);
                    }
                } catch (error) {
                    failCount++;
                    failedUsers.push(uid);
                }
            });

            await Promise.all(promises);
            
            if (i + batchSize < subscribers.length) {
                await delay(1000);
            }
        }

        let resultMessage = `
✅ 𝗔𝗟𝗘𝗥𝗧𝗘 𝗘𝗡𝗩𝗢𝗬𝗘́𝗘 ! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 𝗥𝗮𝗽𝗽𝗼𝗿𝘁 𝗱'𝗲𝗻𝘃𝗼𝗶 :
━━━━━━━━━━━━━━━━━━━━
✅ Succès : ${successCount}/${totalSubscribers}
❌ Échecs : ${failCount}

📨 𝗠𝗲𝘀𝘀𝗮𝗴𝗲 𝗲𝗻𝘃𝗼𝘆𝗲́ :
"${alertText.substring(0, 100)}${alertText.length > 100 ? '...' : ''}"
        `.trim();

        if (failedUsers.length > 0 && failedUsers.length <= 5) {
            resultMessage += `\n\n⚠️ Échecs pour : ${failedUsers.join(', ')}`;
        } else if (failedUsers.length > 5) {
            resultMessage += `\n\n⚠️ ${failedUsers.length} utilisateurs n'ont pas reçu le message.`;
        }

        await sendMessage(senderId, resultMessage);

    } catch (error) {
        console.error('Erreur commande alerte:', error);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━
Une erreur est survenue lors de l'envoi de l'alerte.

🔄 Veuillez réessayer plus tard.
        `.trim());
    }
};

module.exports.info = {
    name: "alerte",
    description: "Envoie une alerte importante à tous les abonnés (administrateurs uniquement)",
    usage: "alerte <message>"
};
