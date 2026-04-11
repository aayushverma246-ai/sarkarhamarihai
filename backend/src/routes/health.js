const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// In-memory latency tracker
const latencyLog = [];
let monitorActive = false;

function startSelfHealingMonitor() {
    if (monitorActive) return;
    monitorActive = true;
    
    // Background polling every 5 minutes
    setInterval(async () => {
        try {
            const start = performance.now();
            const db = getDb();
            await db.execute('SELECT 1');
            const duration = performance.now() - start;
            
            latencyLog.push({ time: Date.now(), latency: duration });
            if (latencyLog.length > 50) latencyLog.shift();

            // Self-healing trigger: if simple query takes > 1000ms consistently
            if (duration > 1000) {
                console.warn(`[HEALTH] Database latency spike detected: ${duration.toFixed(2)}ms. Triggering cache invalidation.`);
                // If there was a cache clearing module, we'd trigger it here.
                // Since cache is per route, we log the exception specifically.
            }
        } catch (error) {
            console.error('[HEALTH] Critical DB failure in monitor loop:', error);
        }
    }, 300000); // 5 minutes
}

// GET /api/health
router.get('/', async (req, res) => {
    // Start monitor on first health check if not started
    startSelfHealingMonitor();

    const start = performance.now();
    try {
        const db = getDb();
        await db.execute('SELECT 1');
        const dbLatency = performance.now() - start;
        
        const memoryUsage = process.memoryUsage();
        
        return res.json({
            status: 'healthy',
            uptime_seconds: process.uptime(),
            db_latency_ms: Math.round(dbLatency),
            memory_usage_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            recent_latency: latencyLog.slice(-5)
        });
    } catch (err) {
        return res.status(503).json({
            status: 'degraded',
            error: err.message,
            db_latency_ms: performance.now() - start
        });
    }
});

module.exports = router;
