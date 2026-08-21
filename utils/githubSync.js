const axios = require('axios');
const fs = require('fs-extra');

// Configuration GitHub
const GITHUB_OWNER = 'BrunoRakotomalala62';
const GITHUB_REPO = '-p';
const GITHUB_BRANCH = 'main';
const GITHUB_API = 'https://api.github.com';

/**
 * Pousse un fichier local vers GitHub via l'API REST (sans git push).
 * @param {string} localPath   - Chemin local absolu du fichier
 * @param {string} githubPath  - Chemin dans le dépôt GitHub (ex: 'Facebook/uid.txt')
 * @param {string} commitMsg   - Message de commit
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function syncFileToGitHub(localPath, githubPath, commitMsg) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        console.warn('[githubSync] GITHUB_TOKEN non défini — synchronisation ignorée.');
        return { success: false, error: 'GITHUB_TOKEN manquant' };
    }

    try {
        const headers = {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'messenger-bot-sync'
        };

        // 1. Récupérer le SHA actuel du fichier sur GitHub
        let sha = null;
        try {
            const getRes = await axios.get(
                `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath}`,
                { headers, params: { ref: GITHUB_BRANCH } }
            );
            sha = getRes.data.sha;
        } catch (e) {
            // Fichier inexistant sur GitHub → création (sha reste null)
            if (e.response && e.response.status !== 404) throw e;
        }

        // 2. Lire le contenu local et l'encoder en base64
        const content = fs.readFileSync(localPath, 'utf8');
        const contentB64 = Buffer.from(content, 'utf8').toString('base64');

        // 3. Mettre à jour (ou créer) le fichier sur GitHub
        const body = {
            message: commitMsg,
            content: contentB64,
            branch: GITHUB_BRANCH,
            ...(sha ? { sha } : {})
        };

        await axios.put(
            `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath}`,
            body,
            { headers }
        );

        console.log(`[githubSync] ✅ ${githubPath} synchronisé sur GitHub.`);
        return { success: true };
    } catch (error) {
        const msg = error.response?.data?.message || error.message;
        console.error(`[githubSync] ❌ Erreur synchronisation ${githubPath}:`, msg);
        return { success: false, error: msg };
    }
}

module.exports = { syncFileToGitHub };
