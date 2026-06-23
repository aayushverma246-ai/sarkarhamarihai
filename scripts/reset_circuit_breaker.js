'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

function getSb() {
  return createClient(
    process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

(async () => {
  try {
    const sb = getSb();
    console.log('Resetting circuit breaker...');
    const { error } = await sb.from('ai_recommendation_cache')
      .upsert({
        key: 'gemini:circuit_breaker',
        data: { tripped_until: 0 },
        updated_at: new Date().toISOString()
      });
    if (error) {
      console.error('Failed to reset circuit breaker in DB:', error.message);
    } else {
      console.log('Successfully reset circuit breaker in DB!');
    }
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
})();
