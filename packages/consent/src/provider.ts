import { defineProvider } from '@kitr/core'
import { type Consent, type ConsentConfig, createConsent } from './index'

/**
 * Binds `consent` and gates the trackers: analytics stays queued until its category is granted
 * (and is disabled again when it is withdrawn); monitoring is gated only when `config.monitoring`
 * names a category. Put the provider after the analytics and monitoring ones in kitrrc.ts.
 */
export const consentProvider = defineProvider({
  name: 'consent',
  register(app) {
    const config = app.config.get('consent', {} as ConsentConfig)
    app.container.singleton('consent', () => createConsent(config, app))
  },
  boot(app) {
    if (!app.isClient) return
    const config = app.config.get('consent', {} as ConsentConfig)
    const consent = app.container.use('consent')
    const apply = () => {
      gateAnalytics(app, consent, config.analytics === undefined ? 'analytics' : config.analytics)
      gateMonitoring(app, consent, config.monitoring ?? false)
    }
    apply()
    consent.subscribe(apply)
  },
})

function gateAnalytics(app: any, consent: Consent, category: string | false) {
  if (category === false || !app.container.has('analytics')) return
  const analytics = app.container.use('analytics')
  if (consent.has(category)) void analytics.enable()
  else analytics.disable()
}

function gateMonitoring(app: any, consent: Consent, category: string | false) {
  if (category === false || !app.container.has('monitoring')) return
  const monitoring = app.container.use('monitoring')
  const allowed = consent.has(category)
  if (monitoring.__consentGate === undefined) {
    const original = monitoring.captureException.bind(monitoring)
    monitoring.captureException = (error: unknown, context?: unknown) => {
      if (monitoring.__consentGate) original(error, context)
    }
  }
  monitoring.__consentGate = allowed
}

export default consentProvider
