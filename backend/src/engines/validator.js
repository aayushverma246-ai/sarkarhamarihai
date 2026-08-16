'use strict';

const https = require('https');
const http = require('http');

/**
 * Validates a single link by doing a HEAD request with timeout
 */
function checkLinkStatus(urlStr) {
  return new Promise((resolve) => {
    if (!urlStr || !urlStr.startsWith('http')) return resolve('broken');
    
    try {
      const url = new URL(urlStr);
      const reqModule = url.protocol === 'https:' ? https : http;
      const req = reqModule.request(url, { method: 'HEAD', timeout: 4000 }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve('valid');
        } else {
          resolve('broken');
        }
      });
      
      req.on('timeout', () => { req.destroy(); resolve('timeout'); });
      req.on('error', () => resolve('broken'));
      req.end();
    } catch {
      resolve('broken');
    }
  });
}

/**
 * Checks dates to transition form_status
 */
function computeFormStatus(startDateStr, endDateStr) {
  const now = new Date();
  now.setHours(0,0,0,0);
  
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  if (now > end) {
    const diffTime = now.getTime() - end.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) return 'RECENTLY_CLOSED';
    return 'CLOSED';
  }
  
  if (now >= start && now <= end) {
    return 'LIVE';
  }
  
  if (now < start) {
    return 'UPCOMING';
  }
  
  return 'UPCOMING';
}

module.exports = { checkLinkStatus, computeFormStatus };
