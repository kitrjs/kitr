import { createSessionController } from '@kitr/auth/server'
import { resetPasswordMail, verifyEmailMail } from '#server/mail/auth'
import { auth } from '#server/auth'

/**
 * Session, sign-in, sign-up, sign-out, email verification and password reset as one controller.
 * `server/routes.ts` links its methods; every state-changing one checks the CSRF token.
 */
export default createSessionController({
  ...auth,
  // Links in emails point at APP_URL, never at whatever Host header the request carried.
  appUrl: process.env.APP_URL,
  mail: { verifyEmail: verifyEmailMail, resetPassword: resetPasswordMail },
})
