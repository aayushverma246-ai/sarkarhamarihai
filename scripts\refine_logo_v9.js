const Jimp = require('jimp');
const path = require('path');

async function fixLogo() {
    console.log('--- Logo Refinement v9 starting ---');
    const sourcePath = path.join(process.cwd(), 'public', 'logo.png');
    const outputPath = path.join(process.cwd(), 'public', 'logo-no-bg.png');

    try {
        const image = await Jimp.read(sourcePath);
        const width = image.bitmap.width;
        const height = image.bitmap.height;

        console.log(`Analyzing logo: ${width}x${height}`);

        // 1. Better upscaling for smoother edges (anti-aliasing)
        // We'll scale up 2x, process, then scale back down with filtering
        const processed = image.clone().scale(2, Jimp.RESIZE_BICUBIC);
        const pWidth = processed.bitmap.width;
        const pHeight = processed.bitmap.height;

        // 2. Advanced Background Removal
        // We assume the top-left pixel is representative of the background color
        const bgRGBA = Jimp.intToRGBA(processed.getPixelColor(0, 0));
        console.log('Detected background color:', bgRGBA);

        processed.scan(0, 0, pWidth, pHeight, (x, y, idx) => {
            const r = processed.bitmap.data[idx + 0];
            const g = processed.bitmap.data[idx + 1];
            const b = processed.bitmap.data[idx + 2];

            // Calculate distance to background color
            const diff = Math.sqrt(
                Math.pow(r - bgRGBA.r, 2) +
                Math.pow(g - bgRGBA.g, 2) +
                Math.pow(b - bgRGBA.b, 2)
            );

            // 3. Smooth alpha transition (Feathering)
            // Anything very close is transparent, anything far is opaque
            // Between is a gradient
            const threshold = 10;
            const feather = 40;

            if (diff < threshold) {
                processed.bitmap.data[idx + 3] = 0; // Pure background
            } else if (diff < threshold + feather) {
                const alpha = ((diff - threshold) / feather) * 255;
                // If it's a dark pixel being feathered, let's nudge it slightly towards white 
                // to avoid "black fringe" in light mode
                processed.bitmap.data[idx + 3] = alpha;
            } else {
                processed.bitmap.data[idx + 3] = 255; // Core logo
            }
        });

        // 4. Downscale back to original with filtering (this is the supersampling part)
        processed.scale(0.5, Jimp.RESIZE_HERMITE);

        await processed.writeAsync(outputPath);
        console.log('Success: Refined logo saved to public/logo-no-bg.png');

    } catch (err) {
        console.error('Error generating logo:', err);
        process.exit(1);
    }
}

fixLogo();
