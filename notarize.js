const { notarize } = require('@electron/notarize');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

async function notarizeDmg() {
    const appleId = process.env.APPLE_ID;
    const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
    const teamId = process.env.APPLE_TEAM_ID;

    if (!appleId || !appleIdPassword || !teamId) {
        console.log('Skipping notarization: missing APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID');
        return;
    }

    const outputDir = path.resolve(__dirname, 'dist-mac');
    const dmgFiles = fs.readdirSync(outputDir).filter((file) => file.endsWith('.dmg'));

    if (dmgFiles.length === 0) {
        throw new Error(`No DMG files found in ${outputDir}`);
    }

    for (const dmgFile of dmgFiles) {
        const dmgPath = path.join(outputDir, dmgFile);

        console.log(`Notarizing ${dmgPath}...`);

        await notarize({
            appPath: dmgPath,
            appleId,
            appleIdPassword,
            teamId,
        });

        console.log(`Stapling ${dmgPath}...`);
        execFileSync('xcrun', ['stapler', 'staple', dmgPath], { stdio: 'inherit' });

        console.log(`Validating stapled ticket for ${dmgPath}...`);
        execFileSync('xcrun', ['stapler', 'validate', dmgPath], { stdio: 'inherit' });
    }

    console.log('DMG notarization complete');
}

notarizeDmg().catch((error) => {
    console.error('DMG notarization failed');
    console.error(error);
    process.exit(1);
});
