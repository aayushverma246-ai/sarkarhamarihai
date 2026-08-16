require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');
const { richnessScore } = require('../backend/src/engines/deduplicator');

async function run() {
    try {
        await initDb();
        const db = getDb();
        console.log("--- Starting database deduplication ---");

        // Find all duplicate name + org pairs
        const dupRes = await db.execute(`
            SELECT job_name, organization, COUNT(*) as cnt 
            FROM jobs 
            GROUP BY job_name, organization 
            HAVING COUNT(*) > 1
        `);

        console.log(`Found ${dupRes.rows.length} duplicate job name + organization groups.`);

        for (const group of dupRes.rows) {
            const { job_name, organization } = group;
            console.log(`\nDeduplicating group: "${job_name}" | "${organization}"`);

            // Fetch all rows for this group
            const rowsRes = await db.execute({
                sql: "SELECT * FROM jobs WHERE job_name = ? AND organization = ?",
                args: [job_name, organization]
            });

            const rows = rowsRes.rows;
            
            // Score each row and sort by score descending
            const scoredRows = rows.map(r => ({
                row: r,
                score: richnessScore(r)
            })).sort((a, b) => b.score - a.score);

            // Keep the highest scored row, delete the others after transferring references
            const keepRow = scoredRows[0].row;
            const deleteRows = scoredRows.slice(1).map(sr => sr.row);

            console.log(`  Keeping row ID: "${keepRow.id}" (Score: ${scoredRows[0].score}, Category: "${keepRow.job_category}", Status: "${keepRow.form_status}")`);

            for (const delRow of deleteRows) {
                console.log(`  Deleting row ID: "${delRow.id}" (Score: ${richnessScore(delRow)}, Category: "${delRow.job_category}", Status: "${delRow.form_status}")`);
                
                // 1. Merge liked_jobs
                const likes = (await db.execute({
                    sql: 'SELECT user_id FROM liked_jobs WHERE job_id = ?',
                    args: [delRow.id]
                })).rows || [];
                
                for (const like of likes) {
                    try {
                        await db.execute({
                            sql: 'INSERT INTO liked_jobs (id, user_id, job_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
                            args: [`like-${like.user_id}-${keepRow.id}`, like.user_id, keepRow.id]
                        });
                    } catch (e) { }
                }
                await db.execute({ sql: 'DELETE FROM liked_jobs WHERE job_id = ?', args: [delRow.id] });

                // 2. Merge notifications
                await db.execute({
                    sql: 'UPDATE notifications SET job_id = ? WHERE job_id = ?',
                    args: [keepRow.id, delRow.id]
                });

                // 3. Merge roadmaps
                const roadmaps = (await db.execute({
                    sql: 'SELECT user_id, roadmap_content FROM roadmaps WHERE job_id = ?',
                    args: [delRow.id]
                })).rows || [];
                for (const r of roadmaps) {
                    try {
                        await db.execute({
                            sql: 'INSERT INTO roadmaps (id, user_id, job_id, roadmap_content) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
                            args: [`roadmap-${r.user_id}-${keepRow.id}`, r.user_id, keepRow.id, r.roadmap_content]
                        });
                    } catch (e) { }
                }
                await db.execute({ sql: 'DELETE FROM roadmaps WHERE job_id = ?', args: [delRow.id] });

                // 4. Finally, delete the duplicate job row
                await db.execute({
                    sql: 'DELETE FROM jobs WHERE id = ?',
                    args: [delRow.id]
                });
            }
        }

        console.log("\n--- Database deduplication completed successfully ---");
        process.exit(0);
    } catch (err) {
        console.error("Deduplication error:", err);
        process.exit(1);
    }
}

run();
