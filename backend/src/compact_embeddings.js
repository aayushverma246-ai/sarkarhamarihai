// Compact embeddings_json: average all per-topic vectors into a single centroid vector per job
// This reduces DB from ~5.8GB to a manageable size for Vercel deployment

const { getDb, initDb } = require('./db');

async function main() {
    await initDb();
    const db = getDb();

    console.log("Processing jobs for compaction in batches...");
    
    let totalCompacted = 0;
    let offset = 0;
    const batchSize = 500;

    while (true) {
        // Fetch a manageable batch of jobs that aren't centroids yet
        // We look for any embedding entry that isn't the single 'centroid' marker
        // Simplified check: any job that has more than a few characters but isn't a small array with "centroid"
        const result = await db.execute({
            sql: `SELECT id, embeddings_json FROM jobs 
                  WHERE embeddings_json IS NOT NULL AND embeddings_json != ''
                  AND embeddings_json NOT LIKE '%"text":"centroid"%'
                  LIMIT ? OFFSET ?`,
            args: [batchSize, offset]
        });
        
        const jobs = result.rows;
        if (!jobs || jobs.length === 0) break;

        console.log(`Processing batch of ${jobs.length} jobs (offset ${offset})...`);

        for (const job of jobs) {
            try {
                const entries = JSON.parse(job.embeddings_json);
                if (!entries || entries.length === 0) continue;

                // Average all vectors into one centroid
                const dim = entries[0].vector ? entries[0].vector.length : 0;
                if (dim === 0) continue;

                const centroid = new Array(dim).fill(0);
                let validCount = 0;
                for (const entry of entries) {
                    if (entry.vector && entry.vector.length === dim) {
                        for (let d = 0; d < dim; d++) {
                            centroid[d] += entry.vector[d];
                        }
                        validCount++;
                    }
                }
                if (validCount > 0) {
                    for (let d = 0; d < dim; d++) {
                        centroid[d] /= validCount;
                    }
                }

                // Store as compact single-entry array
                const compactJson = JSON.stringify([{ text: "centroid", vector: centroid }]);

                await db.execute({
                    sql: "UPDATE jobs SET embeddings_json = ? WHERE id = ?",
                    args: [compactJson, job.id]
                });

                totalCompacted++;
            } catch (e) {
                // Skip broken entries
            }
        }
        
        console.log(`  Compacted ${totalCompacted} so far.`);
        // Note: we don't necessarily need to increment offset if our WHERE clause 
        // now excludes already compacted jobs, but for safety against infinite loops:
        // offset += batchSize; 
        // Actually, since the WHERE clause filtered it, offset 0 will get the NEXT non-compacted batch.
    }

    console.log("Compacted " + totalCompacted + " jobs total.");
    
    // VACUUM to reclaim space
    console.log("Running VACUUM...");
    await db.execute("VACUUM");
    
    console.log("Done!");
    process.exit(0);
}

main().catch(console.error);
