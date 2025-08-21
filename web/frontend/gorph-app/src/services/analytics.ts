import { Platform } from 'react-native';

class AnalyticsService {
  private static instance: AnalyticsService;
  private isInitialized = false;
  private domain = 'gorph.ai'; // Your domain
  private scriptLoaded = false;

  private constructor() {}

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  async initialize() {
    try {
      // Plausible script is now loaded directly in HTML head
      this.isInitialized = true;
      console.log('📊 Plausible Analytics initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize analytics:', error);
    }
  }

  // Track custom events
  trackEvent(eventName: string, properties?: Record<string, any>) {
    if (!this.isInitialized || typeof window === 'undefined') return;

    // Plausible custom events
    if (window.plausible) {
      window.plausible(eventName, {
        props: {
          ...properties,
          platform: Platform.OS,
          timestamp: new Date().toISOString(),
        }
      });
    }
  }

  // Track page views (automatic with Plausible)
  trackPageView(pageName: string) {
    if (!this.isInitialized || typeof window === 'undefined') return;

    // Plausible automatically tracks page views
    // This is just for custom page tracking if needed
    this.trackEvent('page_view', {
      page_name: pageName,
    });
  }

  // Gorph-specific events
  trackDiagramCreated(method: 'template' | 'ai' | 'manual', templateName?: string) {
    this.trackEvent('diagram_created', {
      creation_method: method,
      template_name: templateName,
    });
  }

  trackAIGeneration(prompt: string, success: boolean, provider?: string) {
    this.trackEvent('ai_generation', {
      prompt_length: prompt.length,
      success,
      ai_provider: provider,
    });
  }

  trackTemplateUsed(templateName: string) {
    this.trackEvent('template_used', {
      template_name: templateName,
    });
  }

  trackYAMLValidation(isValid: boolean, errorCount?: number) {
    this.trackEvent('yaml_validation', {
      is_valid: isValid,
      error_count: errorCount || 0,
    });
  }

  trackDiagramExport(format: 'svg' | 'png' | 'dot') {
    this.trackEvent('diagram_exported', {
      export_format: format,
    });
  }

  trackTabSwitch(fromTab: string, toTab: string) {
    this.trackEvent('tab_switched', {
      from_tab: fromTab,
      to_tab: toTab,
    });
  }

  trackOnboardingStep(step: string, completed: boolean) {
    this.trackEvent('onboarding_step', {
      step,
      completed,
    });
  }

  // User session tracking
  trackAppLaunch() {
    this.trackEvent('app_launched', {
      launch_time: new Date().toISOString(),
    });
  }

  trackAppBackground() {
    this.trackEvent('app_backgrounded');
  }

  trackAppForeground() {
    this.trackEvent('app_foregrounded');
  }

  // Error tracking
  trackError(error: Error, context?: string) {
    this.trackEvent('app_error', {
      error_message: error.message,
      context,
      platform: Platform.OS,
    });
  }
}

// Add Plausible to window object for TypeScript
declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, any> }) => void;
  }
}

export default AnalyticsService.getInstance(); 