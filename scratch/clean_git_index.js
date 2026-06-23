const { execSync } = require('child_process');

try {
    // Get all files from git ls-files -s
    const output = execSync('git ls-files -s', { encoding: 'utf8' });
    const lines = output.split('\n');
    const backslashFiles = [];

    for (const line of lines) {
        if (line.includes('\\')) {
            // Extract the quoted path or path with backslash
            const match = line.match(/\t"?(.+?)"?$/);
            if (match) {
                let filePath = match[1];
                // Replace double backslashes with single backslash for git pathspec if quoted
                filePath = filePath.replace(/\\\\/g, '\\');
                backslashFiles.push(filePath);
            }
        }
    }

    console.log(`Found ${backslashFiles.length} files with backslashes in the git index:`);
    console.log(backslashFiles);

    if (backslashFiles.length > 0) {
        for (const file of backslashFiles) {
            console.log(`Removing from index: ${file}`);
            // Run git update-index --force-remove with NTFs safety
            execSync(`git -c core.protectNTFS=false update-index --force-remove "${file}"`);
        }
        console.log('Successfully cleaned up all backslash files from the git index.');
    } else {
        console.log('No backslash files found in the git index.');
    }
} catch (error) {
    console.error('Error cleaning git index:', error.message);
}
