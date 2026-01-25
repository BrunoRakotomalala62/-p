const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const userSessions = {};

const splitMessageInChunks = (message, maxLength = 1800) => {
    if (message.length <= maxLength) {
        return [message];
    }
    
    const chunks = [];
    const lines = message.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
        if (currentChunk.length + line.length + 1 > maxLength) {
            if (line.length > maxLength) {
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }
                let remainingLine = line;
                while (remainingLine.length > 0) {
                    chunks.push(remainingLine.substring(0, maxLength));
                    remainingLine = remainingLine.substring(maxLength);
                }
            } else {
                chunks.push(currentChunk);
                currentChunk = line;
            }
        } else {
            if (currentChunk.length > 0) {
                currentChunk += '\n' + line;
            } else {
                currentChunk = line;
            }
        }
    }
    
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }
    
    return chunks;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getRandomEmoji = () => {
    const emojis = ['✨', '💫', '🌟', '⭐', '🔥', '💎', '🎯', '🚀', '💡', '🎪'];
    return emojis[Math.floor(Math.random() * emojis.length)];
};

const createLoadingAnimation = (step) => {
    const frames = ['◐', '◓', '◑', '◒'];
    return frames[step % frames.length];
};

const formatDateTime = () => {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return now.toLocaleDateString('fr-FR', options);
};

module.exports = async (senderId, prompt) => { 
    try {
        const cmd = prompt.toLowerCase().trim();
        
        if (cmd === "create" || cmd === "new" || cmd === "gen") {
            const loadingMsg = `
╔══════════════════════════════════╗
║  ${getRandomEmoji()} 𝗧𝗘𝗠𝗣𝗠𝗔𝗜𝗟 𝗣𝗥𝗢 ${getRandomEmoji()}              ║
╠══════════════════════════════════╣
║                                  ║
║   ⏳ Création en cours...        ║
║   🔄 Génération de l'adresse...  ║
║                                  ║
╚══════════════════════════════════╝
            `.trim();
            
            await sendMessage(senderId, loadingMsg);
            await delay(1500);

            const createEmailUrl = "https://api-test-liart-alpha.vercel.app/create";
            const createResponse = await axios.get(createEmailUrl);
            
            const email = createResponse.data.address;
            const token = createResponse.data.token;

            userSessions[senderId] = { email, token, createdAt: new Date() };

            const successMsg = `
╔═══════════════════════════════════════╗
║  ✅ 𝗘𝗠𝗔𝗜𝗟 𝗖𝗥𝗘𝗔𝗧𝗘𝗗 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬 ✅   ║
╠═══════════════════════════════════════╣
║                                       ║
║  📧 𝐄𝐦𝐚𝐢𝐥:                            ║
║  ➤ ${email}
║                                       ║
║  🔐 𝐓𝐨𝐤𝐞𝐧:                            ║
║  ➤ ${token}
║                                       ║
╠═══════════════════════════════════════╣
║  📅 ${formatDateTime()}
╠═══════════════════════════════════════╣
║                                       ║
║  💡 𝐂𝐨𝐦𝐦𝐚𝐧𝐝𝐞𝐬 𝐝𝐢𝐬𝐩𝐨𝐧𝐢𝐛𝐥𝐞𝐬:          ║
║  ┌─────────────────────────────────┐  ║
║  │ 📥 check   → Voir les messages  │  ║
║  │ 🔄 refresh → Actualiser inbox   │  ║
║  │ 🆕 create  → Nouvel email       │  ║
║  │ ℹ️  info    → Voir mon email     │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╚═══════════════════════════════════════╝
            `.trim();
            
            await sendMessage(senderId, successMsg);
        } 
        else if (cmd === "check" || cmd === "inbox" || cmd === "refresh" || cmd === "mail") {
            if (!userSessions[senderId]) {
                const noSessionMsg = `
╔═══════════════════════════════════════╗
║  ⚠️  𝗔𝗨𝗖𝗨𝗡 𝗘𝗠𝗔𝗜𝗟 𝗔𝗖𝗧𝗜𝗙 ⚠️           ║
╠═══════════════════════════════════════╣
║                                       ║
║  🔍 Tu n'as pas encore créé d'email   ║
║     temporaire dans cette session.    ║
║                                       ║
║  💡 Tape: tempmail create             ║
║     pour en générer un nouveau !      ║
║                                       ║
╚═══════════════════════════════════════╝
                `.trim();
                return await sendMessage(senderId, noSessionMsg);
            }

            const session = userSessions[senderId];
            
            const checkingMsg = `
╔═══════════════════════════════════════╗
║  📬 𝗩𝗘𝗥𝗜𝗙𝗜𝗖𝗔𝗧𝗜𝗢𝗡 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦... 📬     ║
╠═══════════════════════════════════════╣
║                                       ║
║  🔍 Scan de la boîte de réception...  ║
║  📧 ${session.email}
║                                       ║
║  ⏳ Patiente quelques instants...     ║
║                                       ║
╚═══════════════════════════════════════╝
            `.trim();
            
            await sendMessage(senderId, checkingMsg);
            await delay(2000);

            const inboxUrl = `https://api-test-liart-alpha.vercel.app/inbox?message=${session.email}`;
            const inboxResponse = await axios.get(inboxUrl);
            const emails = inboxResponse.data.emails;

            if (!emails || emails.length === 0) {
                const emptyMsg = `
╔═══════════════════════════════════════╗
║  📭 𝗕𝗢𝗜𝗧𝗘 𝗩𝗜𝗗𝗘 📭                     ║
╠═══════════════════════════════════════╣
║                                       ║
║  😔 Aucun nouveau message pour        ║
║     le moment...                      ║
║                                       ║
║  📧 ${session.email}
║                                       ║
║  💡 Conseils:                         ║
║  ┌─────────────────────────────────┐  ║
║  │ • Attends quelques minutes      │  ║
║  │ • Vérifie l'adresse utilisée    │  ║
║  │ • Tape: tempmail check          │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╚═══════════════════════════════════════╝
                `.trim();
                return await sendMessage(senderId, emptyMsg);
            }

            const summaryMsg = `
╔═══════════════════════════════════════╗
║  📬 𝗡𝗢𝗨𝗩𝗘𝗔𝗨𝗫 𝗠𝗘𝗦𝗦𝗔𝗚𝗘𝗦 𝗧𝗥𝗢𝗨𝗩𝗘𝗦 📬   ║
╠═══════════════════════════════════════╣
║                                       ║
║  📊 Total: ${emails.length} message(s) trouvé(s)
║  📧 Pour: ${session.email}
║                                       ║
║  ⬇️ Affichage des messages...         ║
║                                       ║
╚═══════════════════════════════════════╝
            `.trim();
            
            await sendMessage(senderId, summaryMsg);
            await delay(1500);

            for (let emailIndex = 0; emailIndex < emails.length; emailIndex++) {
                const email = emails[emailIndex];
                const messageNumber = emailIndex + 1;
                
                const headerMsg = `
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ${getRandomEmoji()} 𝐌𝐄𝐒𝐒𝐀𝐆𝐄 ${messageNumber}/${emails.length} ${getRandomEmoji()}
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                       ┃
┃  👤 𝐃𝐞: ${email.from || 'Inconnu'}
┃                                       ┃
┃  📌 𝐎𝐛𝐣𝐞𝐭: ${email.subject || 'Sans objet'}
┃                                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                `.trim();
                
                await sendMessage(senderId, headerMsg);
                await delay(1000);

                const bodyContent = email.body || email.text || 'Contenu vide';
                const bodyChunks = splitMessageInChunks(bodyContent);
                const totalChunks = bodyChunks.length;

                for (let i = 0; i < bodyChunks.length; i++) {
                    const chunkNumber = i + 1;
                    let messageText = '';
                    
                    if (totalChunks === 1) {
                        messageText = `
┌─────────────────────────────────────┐
│  📄 𝐂𝐎𝐍𝐓𝐄𝐍𝐔 𝐃𝐔 𝐌𝐄𝐒𝐒𝐀𝐆𝐄            │
├─────────────────────────────────────┤

${bodyChunks[i]}

└─────────────────────────────────────┘
                        `.trim();
                    } else {
                        const progressBar = createProgressBar(chunkNumber, totalChunks);
                        
                        if (i === 0) {
                            messageText = `
┌─────────────────────────────────────┐
│  📄 𝐂𝐎𝐍𝐓𝐄𝐍𝐔 (${chunkNumber}/${totalChunks}) ${progressBar}
├─────────────────────────────────────┤

${bodyChunks[i]}

│ ⬇️ Suite du message... ⬇️            │
                            `.trim();
                        } else if (i === bodyChunks.length - 1) {
                            messageText = `
│ ⬆️ Suite du message... ⬆️            │
├─────────────────────────────────────┤
│  📄 𝐂𝐎𝐍𝐓𝐄𝐍𝐔 (${chunkNumber}/${totalChunks}) ${progressBar}
├─────────────────────────────────────┤

${bodyChunks[i]}

└─────────────────────────────────────┘
                            `.trim();
                        } else {
                            messageText = `
│ ⬆️ Suite... ⬆️                       │
├─────────────────────────────────────┤
│  📄 𝐂𝐎𝐍𝐓𝐄𝐍𝐔 (${chunkNumber}/${totalChunks}) ${progressBar}
├─────────────────────────────────────┤

${bodyChunks[i]}

│ ⬇️ Suite du message... ⬇️            │
                            `.trim();
                        }
                    }
                    
                    await sendMessage(senderId, messageText);
                    await delay(1200);
                }

                if (emailIndex < emails.length - 1) {
                    const separatorMsg = `
═══════════════════════════════════════
     ${getRandomEmoji()} Message suivant... ${getRandomEmoji()}
═══════════════════════════════════════
                    `.trim();
                    await sendMessage(senderId, separatorMsg);
                    await delay(1500);
                }
            }

            const endMsg = `
╔═══════════════════════════════════════╗
║  ✅ 𝗙𝗜𝗡 𝗗𝗘𝗦 𝗠𝗘𝗦𝗦𝗔𝗚𝗘𝗦 ✅              ║
╠═══════════════════════════════════════╣
║                                       ║
║  📊 ${emails.length} message(s) affiché(s)
║  📅 ${formatDateTime()}
║                                       ║
║  💡 Commandes:                        ║
║  • tempmail check  → Actualiser       ║
║  • tempmail create → Nouvel email     ║
║                                       ║
╚═══════════════════════════════════════╝
            `.trim();
            
            await sendMessage(senderId, endMsg);
        }
        else if (cmd === "info" || cmd === "status" || cmd === "mymail") {
            if (!userSessions[senderId]) {
                const noSessionMsg = `
╔═══════════════════════════════════════╗
║  ℹ️  𝗔𝗨𝗖𝗨𝗡𝗘 𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗔𝗖𝗧𝗜𝗩𝗘 ℹ️        ║
╠═══════════════════════════════════════╣
║                                       ║
║  Tu n'as pas d'email actif.           ║
║  Tape: tempmail create                ║
║                                       ║
╚═══════════════════════════════════════╝
                `.trim();
                return await sendMessage(senderId, noSessionMsg);
            }

            const session = userSessions[senderId];
            const createdDate = session.createdAt ? new Date(session.createdAt).toLocaleString('fr-FR') : 'Inconnu';
            
            const infoMsg = `
╔═══════════════════════════════════════╗
║  ℹ️  𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡𝗦 𝗦𝗘𝗦𝗦𝗜𝗢𝗡 ℹ️        ║
╠═══════════════════════════════════════╣
║                                       ║
║  📧 𝐄𝐦𝐚𝐢𝐥 𝐚𝐜𝐭𝐢𝐟:                      ║
║  ➤ ${session.email}
║                                       ║
║  🔐 𝐓𝐨𝐤𝐞𝐧:                            ║
║  ➤ ${session.token}
║                                       ║
║  📅 𝐂𝐫𝐞𝐞 𝐥𝐞: ${createdDate}
║                                       ║
╠═══════════════════════════════════════╣
║  💡 Actions disponibles:              ║
║  • tempmail check  → Voir messages    ║
║  • tempmail create → Nouvel email     ║
╚═══════════════════════════════════════╝
            `.trim();
            
            await sendMessage(senderId, infoMsg);
        }
        else if (prompt.includes("@")) {
            userSessions[senderId] = { email: prompt, token: null, createdAt: new Date() };
            
            const setEmailMsg = `
╔═══════════════════════════════════════╗
║  ✅ 𝗘𝗠𝗔𝗜𝗟 𝗘𝗡𝗥𝗘𝗚𝗜𝗦𝗧𝗥𝗘 ✅              ║
╠═══════════════════════════════════════╣
║                                       ║
║  📧 ${prompt}
║                                       ║
║  💡 Tape: tempmail check              ║
║     pour voir les messages reçus !    ║
║                                       ║
╚═══════════════════════════════════════╝
            `.trim();
            
            await sendMessage(senderId, setEmailMsg);
        }
        else if (cmd === "help" || cmd === "aide" || cmd === "") {
            const helpMsg = `
╔═══════════════════════════════════════╗
║  📧 𝗧𝗘𝗠𝗣𝗠𝗔𝗜𝗟 𝗣𝗥𝗢 - 𝗚𝗨𝗜𝗗𝗘 📧        ║
╠═══════════════════════════════════════╣
║                                       ║
║  🎯 Service d'email temporaire        ║
║     jetable et anonyme                ║
║                                       ║
╠═══════════════════════════════════════╣
║  📋 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐄𝐒 𝐃𝐈𝐒𝐏𝐎𝐍𝐈𝐁𝐋𝐄𝐒:         ║
╠═══════════════════════════════════════╣
║                                       ║
║  🆕 tempmail create                   ║
║     → Créer un nouvel email           ║
║                                       ║
║  📥 tempmail check                    ║
║     → Vérifier les messages reçus     ║
║                                       ║
║  🔄 tempmail refresh                  ║
║     → Actualiser la boîte             ║
║                                       ║
║  ℹ️  tempmail info                     ║
║     → Voir l'email actuel             ║
║                                       ║
║  📧 tempmail [email]                  ║
║     → Utiliser un email existant      ║
║                                       ║
╠═══════════════════════════════════════╣
║  💡 Astuce: L'email est temporaire    ║
║     et sera supprimé après un moment  ║
╚═══════════════════════════════════════╝
            `.trim();
            
            await sendMessage(senderId, helpMsg);
        }
        else {
            const unknownMsg = `
╔═══════════════════════════════════════╗
║  ❓ 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗘 𝗜𝗡𝗖𝗢𝗡𝗡𝗨𝗘 ❓            ║
╠═══════════════════════════════════════╣
║                                       ║
║  🤔 Je n'ai pas compris: "${prompt.substring(0, 15)}${prompt.length > 15 ? '...' : ''}"
║                                       ║
║  💡 Commandes valides:                ║
║  • tempmail create  → Créer email     ║
║  • tempmail check   → Voir messages   ║
║  • tempmail info    → Mon email       ║
║  • tempmail help    → Aide            ║
║                                       ║
╚═══════════════════════════════════════╝
            `.trim();
            
            await sendMessage(senderId, unknownMsg);
        }
    } catch (error) {
        console.error("Erreur TempMail:", error);
        
        const errorMsg = `
╔═══════════════════════════════════════╗
║  ❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗦𝗬𝗦𝗧𝗘𝗠𝗘 ❌                ║
╠═══════════════════════════════════════╣
║                                       ║
║  😢 Oups ! Quelque chose s'est mal    ║
║     passé...                          ║
║                                       ║
║  🔧 Détails: ${error.message ? error.message.substring(0, 25) : 'Erreur inconnue'}
║                                       ║
║  💡 Essaie à nouveau dans quelques    ║
║     instants ou tape:                 ║
║     tempmail create                   ║
║                                       ║
╚═══════════════════════════════════════╝
        `.trim();
        
        await sendMessage(senderId, errorMsg);
    }
};

function createProgressBar(current, total) {
    const filled = Math.round((current / total) * 5);
    const empty = 5 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

module.exports.info = {
    name: "tempmail",  
    description: "Génère un email temporaire jetable et permet de consulter les messages reçus avec une interface élégante.",  
    usage: "tempmail create | check | info | help | [email@domain.com]"  
};
