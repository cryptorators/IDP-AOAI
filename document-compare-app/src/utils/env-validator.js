const fs = require('fs');
const path = require('path');

function validateEnvFile(projectRoot) {
    const possiblePaths = [
        path.resolve(projectRoot, '.env'),
        path.resolve(projectRoot, 'src', '.env'),
        path.resolve(projectRoot, '..', '.env')
    ];

    console.log('Searching for .env file in:');
    possiblePaths.forEach(p => console.log(` - ${p}`));

    const envPath = possiblePaths.find(p => fs.existsSync(p));
    
    if (!envPath) {
        console.error('No .env file found in any of the searched locations');
        console.error('Please ensure .env file exists in one of these locations:');
        possiblePaths.forEach(p => console.error(` - ${p}`));
        process.exit(1);
    }

    console.log(`Found .env file at: ${envPath}`);
    return envPath;
}

module.exports = { validateEnvFile };
