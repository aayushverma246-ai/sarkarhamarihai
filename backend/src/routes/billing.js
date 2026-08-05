const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// GET /api/billing/status
router.get('/status', auth, async (req, res) => {
  try {
    // Under the launch offer, all users are dynamically granted free premium access.
    // In the future, this query will lookup details in the users or subscriptions table in Supabase.
    return res.json({
      success: true,
      tier: 'Pro Launch Offer',
      is_premium: true,
      expires_at: '2028-12-31T23:59:59Z',
      price_monthly: 0,
      active_features: [
        'Unlimited AI Study Roadmaps',
        'Real-time Vacancy Deadlines',
        '80%+ Syllabus Overlap Matcher',
        'Instant Regional Language Translation'
      ],
      billing_history: [],
      promo_active: true,
      promo_message: 'Launch Promotion: Unlimited premium study features unlocked for free!'
    });
  } catch (err) {
    console.error('[Billing Status Route] Error:', err.message);
    return res.status(500).json({ error: 'Billing status check failed' });
  }
});

// POST /api/billing/activate-trial
router.post('/activate-trial', auth, async (req, res) => {
  return res.json({
    success: true,
    message: 'Premium trial activated successfully!'
  });
});

module.exports = router;
