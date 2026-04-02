const Jimp = require('jimp');
const path = require('path');

async function fixLogo() {
    console.log('--- Logo Refinement v11 starting ---');
    const sourcePath = path.join(process.cwd(), 'public', 'logo.png');
    const outputPath = path.join(process.cwd(), 'public', 'logo-no-bg.png');

    try {
        const image = await Jimp.read(sourcePath);

        // 1. Massive Supersampling (4x) for extreme edge smoothness
        const processed = image.clone().scale(4, Jimp.RESIZE_BICUBIC);
        const pWidth = processed.bitmap.width;
        const pHeight = processed.bitmap.height;

        // 2. Sample multiple corner pixels to ensure we catch the background color accurately
        const corners = [
            Jimp.intToRGBA(processed.getPixelColor(0, 0)),
            Jimp.intToRGBA(processed.getPixelColor(pWidth - 1, 0)),
            Jimp.intToRGBA(processed.getPixelColor(0, pHeight - 1)),
            Jimp.intToRGBA(processed.getPixelColor(pWidth - 1, pHeight - 1))
        ];

        // Calculate average background color from corners
        const bgRGBA = {
            r: Math.round(corners.reduce((sum, c) => sum + c.r, 0) / 4),
            g: Math.round(corners.reduce((sum, c) => sum + c.g, 0) / 4),
            b: Math.round(corners.reduce((sum, c) => sum + c.b, 0) / 4)
        };

        console.log('Detected Average Background Color:', bgRGBA);

        processed.scan(0, 0, pWidth, pHeight, (x, y, idx) => {
            const r = processed.bitmap.data[idx + 0];
            const g = processed.bitmap.data[idx + 1];
            const b = processed.bitmap.data[idx + 2];

            const diff = Math.sqrt(
                Math.pow(r - bgRGBA.r, 2) +
                Math.pow(g - bgRGBA.g, 2) +
                Math.pow(b - bgRGBA.b, 2)
            );

            // 3. Wide-spectrum feathering to prevent any harsh edges or "halos"
            // Threshold is the "kill zone" for the background
            const threshold = 18;
            const featherSpace = 65;

            if (diff < threshold) {
                processed.bitmap.data[idx + 3] = 0;
            } else if (diff < threshold + featherSpace) {
                const alpha = ((diff - threshold) / featherSpace) * 255;
                // Soft alpha transition
                processed.bitmap.data[idx + 3] = Math.max(0, Math.min(255, alpha));
            } else {
                processed.bitmap.data[idx + 3] = 255;
            }
        });

        // 4. Downscale back but stay higher than original for retina clarity
        // If original was 100x100, we now have 400x400. Let's keep it at 200x200 (2x density).
        processed.scale(0.5, Jimp.RESIZE_BICUBIC);

        // 5. Very subtle sharpening after downscale to keep details crisp
        processed.convolute([
            [0, -1, 0],
            [-1, 5, -1],
            [0, -1, 0]
        ]);
        // Reduce sharpening intensity by blending back partially if Jimp supported it easily, 
        // but here we rely on the convolution matrix to find edges.

        await processed.writeAsync(outputPath);
        console.log('Success: Refined logo v11 saved with high-density alpha channels.');

    } catch (err) {
        console.error('Error generating logo:', err);
        process.exit(1);
    }
}

fixLogo();
