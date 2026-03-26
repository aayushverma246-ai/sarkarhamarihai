const Jimp = require('jimp');
const path = require('path');

async function fixLogo() {
    console.log('--- Logo Refinement v10 (High Res + Alpha Feathering) starting ---');
    const sourcePath = path.join(process.cwd(), 'public', 'logo.png');
    const outputPath = path.join(process.cwd(), 'public', 'logo-no-bg.png');

    try {
        const image = await Jimp.read(sourcePath);

        // 1. Supersample (Scale up 3x for maximum edge precision)
        const processed = image.clone().scale(3, Jimp.RESIZE_BICUBIC);
        const pWidth = processed.bitmap.width;
        const pHeight = processed.bitmap.height;

        // 2. Identify Background (sampling from multiple corners for robustness)
        const corners = [
            Jimp.intToRGBA(processed.getPixelColor(0, 0)),
            Jimp.intToRGBA(processed.getPixelColor(pWidth - 1, 0)),
            Jimp.intToRGBA(processed.getPixelColor(0, pHeight - 1)),
            Jimp.intToRGBA(processed.getPixelColor(pWidth - 1, pHeight - 1))
        ];
        const bgRGBA = corners[0]; // Primary bg assumption

        console.log('Processing with supersampling and alpha-feathering...');

        processed.scan(0, 0, pWidth, pHeight, (x, y, idx) => {
            const r = processed.bitmap.data[idx + 0];
            const g = processed.bitmap.data[idx + 1];
            const b = processed.bitmap.data[idx + 2];

            const diff = Math.sqrt(
                Math.pow(r - bgRGBA.r, 2) +
                Math.pow(g - bgRGBA.g, 2) +
                Math.pow(b - bgRGBA.b, 2)
            );

            // 3. More aggressive threshold to kill the "halo"
            // We use a wider feathering range to ensure smoothness
            const threshold = 15;
            const feather = 60;

            if (diff < threshold) {
                processed.bitmap.data[idx + 3] = 0;
            } else if (diff < threshold + feather) {
                const alpha = ((diff - threshold) / feather) * 255;
                processed.bitmap.data[idx + 3] = alpha;
            } else {
                processed.bitmap.data[idx + 3] = 255;
            }
        });

        // 4. Downscale with a higher quality filter (HERMITE or MITCHELL)
        processed.scale(1 / 3, Jimp.RESIZE_HERMITE);

        // 5. Apply a tiny Gaussian Blur to the whole image to blend edges even further
        // (Just 1px blur is enough to smooth the anti-aliasing)
        processed.blur(1);

        await processed.writeAsync(outputPath);
        console.log('Success: Refined logo v10 saved.');

    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fixLogo();
