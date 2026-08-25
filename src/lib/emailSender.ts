/**
 * Envoi d'emails (confirmation d'inscription, etc.)
 *
 * Implémentation via Brevo API.
 * Si un jour on change de fournisseur (Resend, AWS SES, ...),
 * on pourra remplacer ce fichier sans toucher au reste de l'app.
 * 
 * Les templates d'emails utilisent MJML pour un rendu responsive et professionnel.
 */

import {
  compileConfirmationTemplate,
  compilePasswordResetTemplate,
} from './emailTemplates/compileTemplate'

const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'no-reply@yams.local'

async function sendEmail(params: {
  to: string
  subject: string
  text: string
  html: string
}) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY!,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: BREVO_FROM_EMAIL },
      to: [{ email: params.to }],
      subject: params.subject,
      textContent: params.text,
      htmlContent: params.html,
    }),
  })

  if (!response.ok) {
    throw new Error(`Brevo a refusé l'envoi (${response.status}): ${await response.text()}`)
  }
}

export async function sendConfirmationEmail(params: {
  to: string
  confirmationUrl: string
}) {
  const { to, confirmationUrl } = params

  // Vérifier que Brevo est configuré
  if (!BREVO_API_KEY) {
    console.warn('⚠️ BREVO_API_KEY non configurée. Les emails seront simplement logués en console.')
    return
  }

  const subject = 'Confirme ton inscription à Yams Online'
  const text = `Bienvenue sur Yams Online !

Merci de ton inscription. Pour activer ton compte, clique sur le lien suivant :
${confirmationUrl}

Si tu n'es pas à l'origine de cette inscription, tu peux ignorer cet email.`

  // Compiler le template MJML en HTML
  let html: string
  try {
    html = compileConfirmationTemplate(confirmationUrl)
  } catch (error) {
    console.error('❌ Erreur lors de la compilation du template MJML:', error)
    // Fallback vers un HTML simple en cas d'erreur
    html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6;">
        <h2>Bienvenue sur Yams Online 🎲</h2>
        <p>Merci de ton inscription ! Pour activer ton compte, clique sur le lien suivant :</p>
        <p><a href="${confirmationUrl}">${confirmationUrl}</a></p>
      </div>
    `
  }

  try {
    await sendEmail({ to, subject, text, html })
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email de confirmation:', error)
    throw error
  }
}

export async function sendPasswordResetEmail(params: {
  to: string
  resetUrl: string
}) {
  const { to, resetUrl } = params

  // Vérifier que Brevo est configuré
  if (!BREVO_API_KEY) {
    console.warn('⚠️ BREVO_API_KEY non configurée. Les emails seront simplement logués en console.')
    return
  }

  const subject = 'Réinitialisation de ton mot de passe Yams Online'
  const text = `Tu as demandé à réinitialiser ton mot de passe Yams Online.

Pour définir un nouveau mot de passe, clique sur le lien suivant :
${resetUrl}

Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet email.`

  // Compiler le template MJML en HTML
  let html: string
  try {
    html = compilePasswordResetTemplate(resetUrl)
  } catch (error) {
    console.error('❌ Erreur lors de la compilation du template MJML:', error)
    // Fallback vers un HTML simple en cas d'erreur
    html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6;">
        <h2>Réinitialisation de ton mot de passe 🔑</h2>
        <p>Tu as demandé à réinitialiser ton mot de passe. Clique sur le lien suivant :</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
      </div>
    `
  }

  try {
    await sendEmail({ to, subject, text, html })
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email de réinitialisation:', error)
    throw error
  }
}


