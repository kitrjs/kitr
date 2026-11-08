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
    // Everything that sends data out waits for consent, not only exceptions: messages and
    // breadcrumbs carry page content, and setUser carries who the visitor is.
    for (const method of ['captureException', 'captureMessage', 'addBreadcrumb', 'setTag']) {
      const original = monitoring[method]?.bind(monitoring)
      if (!original) continue
      monitoring[method] = (...args: unknown[]) => {
        if (monitoring.__consentGate) original(...args)
      }
    }
    const setUser = monitoring.setUser?.bind(monitoring)
    if (setUser) {
      monitoring.__consentSetUser = setUser
      monitoring.setUser = (user: unknown) => {
        // Kept, so granting consent later identifies the visitor without the app asking again.
        monitoring.__consentUser = user
        if (monitoring.__consentGate) setUser(user)
      }
    }
  }
  const was = monitoring.__consentGate
  monitoring.__consentGate = allowed
  const setUser = monitoring.__consentSetUser
  if (setUser && was !== allowed && monitoring.__consentUser !== undefined)
    setUser(allowed ? monitoring.__consentUser : null)
}

export default consentProvider
