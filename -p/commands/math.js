
const axios = require('axios');
const fs = require('fs-extra');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt, api) => {
    try {
        // Si le prompt est vide
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🔢 *CALCULATRICE MATHEMATIQUE* 🔢\n\nVeuillez entrer une opération mathématique.\n\nExemple: math 1+2\nAutres options:\n-p: Calcul d'intégrale (ex: math -p xdx)\n-g: Tracer des graphiques (ex: math -g y=x^3-9)\n-v: Calculs vectoriels (ex: math -v (1,2,3)-(5,6,7))");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "🧮 Calcul en cours... ⏳");

        const key = "T8J8YV-H265UQ762K"; // Clé Wolfram Alpha
        let content = prompt.trim();
        let text = [];

        // Traitement des différentes options
        if (content.indexOf("-p") == 0) {
            try {
                content = "primitive " + content.slice(3, content.length);
                const data = (await axios.get(`http://api.wolframalpha.com/v2/query?appid=${key}&input=${encodeURIComponent(content)}&output=json`)).data;
                
                if (content.includes("from") && content.includes("to")) {
                    const value = data.queryresult.pods.find(e => e.id == "Input").subpods[0].plaintext;
                    if (value.includes("≈")) {
                        const a = value.split("≈"), b = a[0].split(" = ")[1], c = a[1];
                        await sendMessage(senderId, `📊 *RÉSULTAT D'INTÉGRATION* 📊\n\nFractional: ${b}\nDecimal: ${c}`);
                    } else {
                        await sendMessage(senderId, `📊 *RÉSULTAT D'INTÉGRATION* 📊\n\n${value.split(" = ")[1]}`);
                    }
                } else {
                    const result = (data.queryresult.pods.find(e => e.id == "IndefiniteIntegral").subpods[0].plaintext.split(" = ")[1]).replace("+ constant", "");
                    await sendMessage(senderId, `📊 *RÉSULTAT* 📊\n\n${result}`);
                }
            } catch (e) {
                await sendMessage(senderId, `⚠️ *ERREUR* ⚠️\n\nImpossible de calculer cette intégrale: ${e.message}`);
            }
        } else if (content.indexOf("-g") == 0) {
            try {
                content = "plot " + content.slice(3, content.length);
                const data = (await axios.get(`http://api.wolframalpha.com/v2/query?appid=${key}&input=${encodeURIComponent(content)}&output=json`)).data;
                const src = (data.queryresult.pods.some(e => e.id == "Plot")) ? 
                    data.queryresult.pods.find(e => e.id == "Plot").subpods[0].img.src : 
                    data.queryresult.pods.find(e => e.id == "ImplicitPlot").subpods[0].img.src;
                
                const response = await axios.get(src, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data, 'binary');
                
                // Sauvegarder l'image
                fs.writeFileSync('./temp/graph.png', buffer);
                
                // Envoyer l'image
                await sendMessage(senderId, {
                    files: ['./temp/graph.png'],
                    type: 'image'
                });
                
                // Supprimer l'image après envoi
                fs.unlinkSync('./temp/graph.png');
                
            } catch (e) {
                await sendMessage(senderId, `⚠️ *ERREUR* ⚠️\n\nImpossible de générer ce graphique: ${e.message}`);
            }
        } else if (content.indexOf("-v") == 0) {
            try {
                content = "vector " + content.slice(3, content.length).replace(/\(/g, "<").replace(/\)/g, ">");
                const data = (await axios.get(`http://api.wolframalpha.com/v2/query?appid=${key}&input=${encodeURIComponent(content)}&output=json`)).data;
                const src = data.queryresult.pods.find(e => e.id == "VectorPlot").subpods[0].img.src;
                const vector_length = data.queryresult.pods.find(e => e.id == "VectorLength").subpods[0].plaintext;
                let result = "";
                
                if (data.queryresult.pods.some(e => e.id == "Result")) {
                    result = data.queryresult.pods.find(e => e.id == "Result").subpods[0].plaintext;
                }
                
                // Télécharger l'image
                const response = await axios.get(src, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data, 'binary');
                
                // Sauvegarder l'image
                fs.writeFileSync('./temp/graph.png', buffer);
                
                // Envoyer le message avec l'image
                await sendMessage(senderId, `📐 *CALCUL VECTORIEL* 📐\n\n${result ? result + "\n" : ""}Longueur du vecteur: ${vector_length}`);
                await sendMessage(senderId, {
                    files: ['./temp/graph.png'],
                    type: 'image'
                });
                
                // Supprimer l'image après envoi
                fs.unlinkSync('./temp/graph.png');
                
            } catch (e) {
                await sendMessage(senderId, `⚠️ *ERREUR* ⚠️\n\nImpossible de traiter ce calcul vectoriel: ${e.message}`);
            }
        } else {
            try {
                const data = (await axios.get(`http://api.wolframalpha.com/v2/query?appid=${key}&input=${encodeURIComponent(content)}&output=json`)).data;
                
                if (data.queryresult.pods.some(e => e.id == "Solution")) {
                    const value = data.queryresult.pods.find(e => e.id == "Solution");
                    for (let e of value.subpods) text.push(e.plaintext);
                    await sendMessage(senderId, `🧮 *SOLUTION* 🧮\n\n${text.join("\n")}`);
                } else if (data.queryresult.pods.some(e => e.id == "ComplexSolution")) {
                    const value = data.queryresult.pods.find(e => e.id == "ComplexSolution");
                    for (let e of value.subpods) text.push(e.plaintext);
                    await sendMessage(senderId, `🧮 *SOLUTION COMPLEXE* 🧮\n\n${text.join("\n")}`);
                } else if (data.queryresult.pods.some(e => e.id == "Result")) {
                    const result = data.queryresult.pods.find(e => e.id == "Result").subpods[0].plaintext;
                    await sendMessage(senderId, `🧮 *RÉSULTAT* 🧮\n\n${result}`);
                } else {
                    await sendMessage(senderId, "⚠️ Aucun résultat trouvé pour cette opération mathématique.");
                }
            } catch (e) {
                await sendMessage(senderId, `⚠️ *ERREUR* ⚠️\n\nImpossible de résoudre cette opération: ${e.message}`);
            }
        }
    } catch (error) {
        console.error("Erreur lors du calcul mathématique:", error);
        await sendMessage(senderId, `
⚠️ *ERREUR* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors du calcul.
Veuillez vérifier votre formule et réessayer.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }
    
    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "math",
    description: "Effectue des calculs mathématiques et trace des graphiques avec Wolfram Alpha.",
    usage: "Envoyez 'math <opération>' pour un calcul, 'math -p <fonction>' pour une intégrale, 'math -g <fonction>' pour un graphique, ou 'math -v <vecteurs>' pour un calcul vectoriel."
};
