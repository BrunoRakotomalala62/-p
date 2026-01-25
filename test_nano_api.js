const axios = require('axios');

async function testNanoAPI() {
    const prompt = "changer en violet son cheveux";
    const imageUrl = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSufnlAbOiwEqlFFnC8ZDoy9kEn_CqiRa9WWCPm2c2sYbmz_4U3Ct_f-bc&s";
    const uid = "test_123";
    const apiUrl = `https://nano-banana-api-five.vercel.app/nanobanana?prompt=${encodeURIComponent(prompt)}&image=${encodeURIComponent(imageUrl)}&uid=${uid}`;

    console.log(`Test de l'API Nano avec l'URL : ${apiUrl}`);

    try {
        const response = await axios.get(apiUrl);
        console.log('Réponse de l\'API :', JSON.stringify(response.data, null, 2));
        if (response.data && response.data.resultats_url) {
            console.log('SUCCÈS : URL de résultat obtenue :', response.data.resultats_url);
        } else {
            console.log('ÉCHEC : L\'API n\'a pas renvoyé de resultats_url');
        }
    } catch (error) {
        console.error('ERREUR lors de l\'appel API :', error.message);
        if (error.response) {
            console.error('Détails de l\'erreur :', error.response.data);
        }
    }
}

testNanoAPI();
