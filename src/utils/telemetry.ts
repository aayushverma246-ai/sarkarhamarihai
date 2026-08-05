// Telemetry and Error Tracking Adapter (SaaS & Production Grade)
// Seamlessly routes client-side errors and performance events to central logs

interface TelemetryEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: string;
}

const isProd = import.meta.env.PROD;

export const telemetry = {
  // Capture errors securely
  captureException: (error: Error, context?: Record<string, any>) => {
    const errorDetails = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      context: context || {},
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    if (!isProd) {
      console.group('🚨 [Telemetry Exception]');
      console.error(error);
      console.log('Context:', context);
      console.groupEnd();
      return;
    }

    // In production: Send asynchronously to backend health/log endpoint
    fetch('/api/health/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'error', data: errorDetails }),
    }).catch((err) => {
      // Fail silently to prevent telemetry requests from crashing the user experience
      console.warn('[Telemetry failed to dispatch error]:', err.message);
    });
  },

  // Track key conversion events (signups, saves, roadmap generations)
  track: (eventName: string, properties?: Record<string, any>) => {
    const eventData: TelemetryEvent = {
      event: eventName,
      properties: properties || {},
      timestamp: new Date().toISOString(),
    };

    if (!isProd) {
      console.log(`📊 [Telemetry Event]: ${eventName}`, properties);
      return;
    }

    // In production: Dispatch telemetry event to backend health/log endpoint
    fetch('/api/health/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'event', data: eventData }),
    }).catch((err) => {
      console.warn('[Telemetry failed to dispatch event]:', err.message);
    });
  }
};
