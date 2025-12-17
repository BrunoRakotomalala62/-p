const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://radio-db.vercel.app';

const EMOJIS = {
    radio: ['📻', '🎙️', '📡', '🔊', '🎧', '🎶', '🎵', '🎼'],
    music: ['🎵', '🎶', '🎼', '🎧', '🎤', '🎸', '🎹', '🎺'],
    success: ['✨', '🌟', '💫', '⭐', '🔥', '💎', '🏆', '👑'],
    loading: ['⏳', '🕐', '🕑', '🕒', '🕓', '🔄', '⚡', '💨'],
    play: ['▶️', '🎧', '🔊', '🎶', '📢', '🎵']
};

function getRandomEmoji(category) {
    const emojis = EMOJIS[category] || EMOJIS.success;
    return emojis[Math.floor(Math.random() * emojis.length)];
}

function generateDynamicBorder() {
    const borders = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '═══════════════════════════',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        '◆━━━━━━━━━━━━━━━━━━━━━━━━━◆',
        '✦═══════════════════════════✦',
        '◈━━━━━━━━━━━━━━━━━━━━━━━━━◈',
        '🎵━━━━━━━━━━━━━━━━━━━━━━━🎵'
    ];
    return borders[Math.floor(Math.random() * borders.length)];
}

function generateTimestamp() {
    const now = new Date();
    const options = { 
        hour: '2-digit', 
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Indian/Antananarivo'
    };
    return now.toLocaleDateString('fr-FR', options);
}

const userSessions = new Map();

module.exports = async (senderId, prompt, api) => {
    try {
        if (prompt === 'RESET_CONVERSATION') {
            userSessions.delete(senderId);
            return;
        }
        
        const userSession = userSessions.get(senderId) || {};
        const input = (typeof prompt === 'string') ? prompt.trim() : '';
        
        if (input && input.length > 0) {
            if (/^\d+$/.test(input) && userSession.radios && userSession.radios.length > 0) {
                const radioIndex = parseInt(input) - 1;
                
                if (radioIndex >= 0 && radioIndex < userSession.radios.length) {
                    const selectedRadio = userSession.radios[radioIndex];
                    await handleRadioSelection(senderId, selectedRadio);
                } else {
                    await sendMessage(senderId, `
❌ 𝗡𝗨𝗠𝗘́𝗥𝗢 𝗜𝗡𝗩𝗔𝗟𝗜𝗗𝗘 ❌
${generateDynamicBorder()}

⚠️ Veuillez choisir un numéro entre 𝟏 et ${userSession.radios.length}.

💡 Réessayez avec un numéro valide de la liste
                    `.trim());
                }
            } else {
                await showRadioList(senderId);
            }
        } else {
            await showRadioList(senderId);
        }

    } catch (error) {
        console.error('Erreur commande radio:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗦𝗬𝗦𝗧𝗘̀𝗠𝗘 ❌
${generateDynamicBorder()}

⚠️ Une erreur inattendue s'est produite.

🔄 Veuillez réessayer dans quelques instants.

💬 Tapez "radio" pour recommencer
        `.trim());
    }
};

async function showRadioList(senderId) {
    try {
        const border = generateDynamicBorder();
        const loadingEmoji = getRandomEmoji('loading');
        
        await sendMessage(senderId, `
${loadingEmoji} 𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗗𝗘𝗦 𝗥𝗔𝗗𝗜𝗢𝗦...
${border}

📻 Récupération de la liste des radios...
🇲🇬 Radios Malgaches en ligne

⏳ Veuillez patienter...
        `.trim());
        
        const response = await axios.get(`${API_BASE}/radios`, { timeout: 30000 });
        
        let radios = [];
        if (response.data && response.data.radios) {
            radios = response.data.radios;
        } else if (Array.isArray(response.data)) {
            radios = response.data;
        }
        
        if (radios && radios.length > 0) {
            userSessions.set(senderId, {
                radios: radios,
                timestamp: Date.now()
            });
            
            const radioEmoji = getRandomEmoji('radio');
            const successEmoji = getRandomEmoji('success');
            
            let headerText = `
${radioEmoji} 𝗥𝗔𝗗𝗜𝗢𝗦 𝗠𝗔𝗟𝗚𝗔𝗖𝗛𝗘𝗦 🇲🇬
${border}

${successEmoji} ${radios.length} radios disponibles
⏰ ${generateTimestamp()}

${border}
📻 𝗟𝗜𝗦𝗧𝗘 𝗗𝗘𝗦 𝗥𝗔𝗗𝗜𝗢𝗦 :
${border}
            `.trim();
            
            await sendMessage(senderId, headerText);
            
            const chunkSize = 12;
            const chunks = [];
            
            for (let i = 0; i < radios.length; i += chunkSize) {
                chunks.push(radios.slice(i, i + chunkSize));
            }
            
            for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
                const chunk = chunks[chunkIndex];
                let listText = '';
                
                chunk.forEach((radio, index) => {
                    const globalIndex = chunkIndex * chunkSize + index + 1;
                    const radioName = typeof radio === 'string' ? radio : (radio.nom || radio.name || radio);
                    const displayName = radioName.charAt(0).toUpperCase() + radioName.slice(1);
                    
                    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                    let numDisplay = '';
                    
                    if (globalIndex <= 10) {
                        numDisplay = numberEmojis[globalIndex - 1];
                    } else {
                        numDisplay = `${globalIndex}️⃣`;
                    }
                    
                    listText += `${numDisplay} ${displayName}\n`;
                });
                
                await sendMessage(senderId, listText.trim());
                
                if (chunkIndex < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
            
            const playEmoji = getRandomEmoji('play');
            const musicEmoji = getRandomEmoji('music');
            
            await sendMessage(senderId, `
${border}
${playEmoji} 𝗖𝗢𝗠𝗠𝗘𝗡𝗧 𝗘́𝗖𝗢𝗨𝗧𝗘𝗥 ? ${musicEmoji}
${border}

📌 𝗘𝗻𝘃𝗼𝘆𝗲𝘇 𝗹𝗲 𝗻𝘂𝗺𝗲́𝗿𝗼 de la radio

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 : Tapez "𝟐" pour écouter RNA

${border}
🎧 𝗕𝗢𝗡𝗡𝗘 𝗘́𝗖𝗢𝗨𝗧𝗘 ! 🎧
            `.trim());

        } else {
            await sendMessage(senderId, `
❌ 𝗔𝗨𝗖𝗨𝗡𝗘 𝗥𝗔𝗗𝗜𝗢 𝗗𝗜𝗦𝗣𝗢𝗡𝗜𝗕𝗟𝗘 ❌
${generateDynamicBorder()}

⚠️ Impossible de récupérer la liste des radios.

🔄 Veuillez réessayer plus tard.

💬 Tapez "radio" pour réessayer
            `.trim());
        }

    } catch (error) {
        console.error('Erreur récupération radios:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗖𝗢𝗡𝗡𝗘𝗫𝗜𝗢𝗡 ❌
${generateDynamicBorder()}

⚠️ Impossible de contacter le serveur.
📡 Erreur: ${error.message}

${generateDynamicBorder()}
🔄 Veuillez réessayer dans quelques instants.

💬 Tapez "radio" pour recommencer
        `.trim());
    }
}

async function handleRadioSelection(senderId, radioName) {
    try {
        const border = generateDynamicBorder();
        const loadingEmoji = getRandomEmoji('loading');
        
        const displayRadioName = typeof radioName === 'string' ? radioName : (radioName.nom || radioName.name || radioName);
        
        await sendMessage(senderId, `
${loadingEmoji} 𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧...
${border}

📻 Radio : ${displayRadioName.toUpperCase()}
🔍 Récupération des informations...

⏳ Veuillez patienter...
        `.trim());
        
        const response = await axios.get(`${API_BASE}/player?radio=${encodeURIComponent(displayRadioName)}`, { timeout: 30000 });
        
        const radioData = response.data;
        
        if (radioData && radioData.stream_url) {
            const radioEmoji = getRandomEmoji('radio');
            const successEmoji = getRandomEmoji('success');
            const playEmoji = getRandomEmoji('play');
            const musicEmoji = getRandomEmoji('music');
            
            const nom = radioData.nom || displayRadioName.toUpperCase();
            const frequence = radioData.frequence || 'En ligne';
            const format = radioData.format || 'audio/mpeg';
            const statut = radioData.statut || 'en_ligne';
            const streamUrl = radioData.stream_url;
            const siteSource = radioData.site_source || '';
            
            let statutEmoji = '🟢';
            let statutText = 'En ligne';
            if (statut === 'hors_ligne' || statut === 'offline') {
                statutEmoji = '🔴';
                statutText = 'Hors ligne';
            }
            
            if (radioData.logo) {
                try {
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'image',
                            payload: {
                                url: radioData.logo,
                                is_reusable: true
                            }
                        }
                    });
                } catch (imgError) {
                    console.log('Logo non disponible:', imgError.message);
                }
            }
            
            await sendMessage(senderId, `
${radioEmoji}${successEmoji} 𝗥𝗔𝗗𝗜𝗢 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́𝗘 ${successEmoji}${radioEmoji}
${border}

┌─────────────────────────────┐
│  📻 𝗡𝗢𝗠 : ${nom}
│  📡 𝗙𝗥𝗘́𝗤𝗨𝗘𝗡𝗖𝗘 : ${frequence}
│  🎵 𝗙𝗢𝗥𝗠𝗔𝗧 : ${format}
│  ${statutEmoji} 𝗦𝗧𝗔𝗧𝗨𝗧 : ${statutText}
└─────────────────────────────┘

${border}
${playEmoji} 𝗟𝗜𝗘𝗡 𝗗'𝗘́𝗖𝗢𝗨𝗧𝗘 𝗗𝗜𝗥𝗘𝗖𝗧 :
${border}
            `.trim());
            
            await sendMessage(senderId, streamUrl);
            
            await sendMessage(senderId, `
${border}
${musicEmoji} 𝗚𝗨𝗜𝗗𝗘 𝗗'𝗨𝗧𝗜𝗟𝗜𝗦𝗔𝗧𝗜𝗢𝗡 ${musicEmoji}
${border}

📱 𝗦𝗨𝗥 𝗠𝗢𝗕𝗜𝗟𝗘 :
   1️⃣ Copiez le lien ci-dessus
   2️⃣ Collez dans votre navigateur
   3️⃣ Ou utilisez VLC/lecteur audio

💻 𝗦𝗨𝗥 𝗣𝗖 :
   1️⃣ Cliquez sur le lien
   2️⃣ Ouvrez avec VLC Media Player
   3️⃣ Profitez de la musique !

${border}
💡 𝗔𝗦𝗧𝗨𝗖𝗘 : Utilisez l'application VLC
   pour une meilleure expérience !

${siteSource ? `🌐 𝗦𝗜𝗧𝗘 : ${siteSource}` : ''}
${border}

🔄 Tapez "radio" pour voir d'autres radios

${getRandomEmoji('success')} 𝗕𝗢𝗡𝗡𝗘 𝗘́𝗖𝗢𝗨𝗧𝗘 ! ${getRandomEmoji('success')}
            `.trim());
            
            userSessions.delete(senderId);

        } else {
            await sendMessage(senderId, `
❌ 𝗥𝗔𝗗𝗜𝗢 𝗜𝗡𝗗𝗜𝗦𝗣𝗢𝗡𝗜𝗕𝗟𝗘 ❌
${generateDynamicBorder()}

⚠️ Impossible de récupérer les informations de cette radio.

📻 Radio : ${displayRadioName}

${generateDynamicBorder()}
🔄 Essayez une autre radio de la liste.

💬 Tapez "radio" pour voir la liste
            `.trim());
        }

    } catch (error) {
        console.error('Erreur sélection radio:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗖𝗢𝗡𝗡𝗘𝗫𝗜𝗢𝗡 ❌
${generateDynamicBorder()}

⚠️ Impossible de contacter le serveur.
📡 Erreur: ${error.message}

${generateDynamicBorder()}
🔄 Veuillez réessayer dans quelques instants.

💬 Tapez "radio" pour recommencer
        `.trim());
    }
}
