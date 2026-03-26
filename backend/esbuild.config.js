require('esbuild').build({
    entryPoints: ['serverless.js'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    external: ['node:*'],
    outfile: '../dist/netlify/functions/api.js',
}).then(() => console.log('✅ Serverless backend bundled successfully!'))
    .catch((e) => {
        console.error('❌ Build failed:', e);
        process.exit(1);
    });
