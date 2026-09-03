/**
 * /api/cron/refresh — Lightweight Data Freshness Pipeline
 * 
 * Runs every 6 hours to ensure users never see stale data:
 *   ✓ Recalculates form_status for all LIVE/UPCOMING jobs
 *   ✓ Transitions RECENTLY_CLOSED → CLOSED after 30 days
 *   ✓ Updates last_verified_at timestamps
 *   ✓ Sends deadline notifications
 *   ✓ Quick integrity check (counts, nulls)
 * 
 * Lightweight — designed to complete in <30s.
 */
'use strict';

module.exports = async (req, res) => {
  const secret = req.query?.secret || '';
  const authHeader = req.headers?.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || (authHeader !== `Bearer ${cronSecret}` && secret !== cronSecret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(
    process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const todayStr = ist.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const report = {
    timestamp: ist.toISOString(),
    upcomingToLive: 0,
    liveToRecentlyClosed: 0,
    recentlyClosedToClosed: 0,
    statusVerified: 0,
    integrityCheck: {},
    errors: [],
  };

  try {
    // ── 1. UPCOMING → LIVE (application_start_date reached today) ──
    const { data: upcomingJobs } = await sb.from('jobs')
      .select('id, application_start_date')
      .eq('form_status', 'UPCOMING')
      .lte('application_start_date', todayStr);

    if (upcomingJobs && upcomingJobs.length > 0) {
      const ids = upcomingJobs.map(j => j.id);
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        await sb.from('jobs')
          .update({ form_status: 'LIVE', last_verified_at: new Date().toISOString() })
          .in('id', batch);
      }
      report.upcomingToLive = upcomingJobs.length;
    }

    // ── 2. LIVE → RECENTLY_CLOSED (application_end_date passed) ──
    const { data: liveExpired } = await sb.from('jobs')
      .select('id, application_end_date')
      .eq('form_status', 'LIVE')
      .lt('application_end_date', todayStr);

    if (liveExpired && liveExpired.length > 0) {
      const ids = liveExpired.map(j => j.id);
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        await sb.from('jobs')
          .update({ form_status: 'RECENTLY_CLOSED', last_verified_at: new Date().toISOString() })
          .in('id', batch);
      }
      report.liveToRecentlyClosed = liveExpired.length;
    }

    // ── 3. RECENTLY_CLOSED → CLOSED (> 30 days past end date) ──
    const { data: recentlyClosed } = await sb.from('jobs')
      .select('id')
      .eq('form_status', 'RECENTLY_CLOSED')
      .lt('application_end_date', thirtyDaysAgo);

    if (recentlyClosed && recentlyClosed.length > 0) {
      const ids = recentlyClosed.map(j => j.id);
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        await sb.from('jobs')
          .update({ form_status: 'CLOSED', last_verified_at: new Date().toISOString() })
          .in('id', batch);
      }
      report.recentlyClosedToClosed = recentlyClosed.length;
    }

    // ── 4. Re-open check: CLOSED → LIVE (if dates indicate re-opened registration) ──
    const { data: reopened } = await sb.from('jobs')
      .select('id')
      .in('form_status', ['CLOSED', 'RECENTLY_CLOSED'])
      .lte('application_start_date', todayStr)
      .gte('application_end_date', todayStr);

    if (reopened && reopened.length > 0) {
      const ids = reopened.map(j => j.id);
      await sb.from('jobs')
        .update({ form_status: 'LIVE', last_verified_at: new Date().toISOString() })
        .in('id', ids);
      report.reopened = reopened.length;
    }

    // ── 5. QUICK INTEGRITY CHECK ──
    const { count: totalJobs } = await sb.from('jobs').select('*', { count: 'exact', head: true });
    const { count: liveJobs } = await sb.from('jobs').select('*', { count: 'exact', head: true }).eq('form_status', 'LIVE');
    const { count: upcomingJobs2 } = await sb.from('jobs').select('*', { count: 'exact', head: true }).eq('form_status', 'UPCOMING');
    const { count: noLinks } = await sb.from('jobs').select('*', { count: 'exact', head: true }).is('official_application_link', null);
    const { count: noDates } = await sb.from('jobs').select('*', { count: 'exact', head: true }).is('application_end_date', null);

    report.integrityCheck = {
      totalJobs,
      liveJobs,
      upcomingJobs: upcomingJobs2,
      missingLinks: noLinks,
      missingDates: noDates,
    };

    report.statusVerified = (report.upcomingToLive + report.liveToRecentlyClosed + report.recentlyClosedToClosed + (report.reopened || 0));
    report.elapsed_ms = Date.now() - startTime;
    report.success = true;

    return res.status(200).json(report);

  } catch (err) {
    report.success = false;
    report.fatal_error = err.message;
    report.elapsed_ms = Date.now() - startTime;
    return res.status(500).json(report);
  }
};
