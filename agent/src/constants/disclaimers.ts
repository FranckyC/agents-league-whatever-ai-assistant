/** Supported locale codes for disclaimers. */
export type DisclaimerLocale = 'en-US' | 'fr-FR';

/** Default locale used when the caller's language is unknown or unsupported. */
export const DEFAULT_LOCALE: DisclaimerLocale = 'en-US';

/** Structured disclaimer content for each locale. */
export interface DisclaimerContent {
  title: string;
  aiAccuracyTitle: string;
  aiAccuracyBody: string;
  dataPrivacyTitle: string;
  dataPrivacyBody: string;
  acceptance: string;
}

const disclaimerContent: Record<DisclaimerLocale, DisclaimerContent> = {
  'en-US': {
    title: '⚠️ Important Notice',
    aiAccuracyTitle: '🤖 AI-Generated Content',
    aiAccuracyBody:
      'This agent is powered by AI and may occasionally generate inaccurate or ' +
      'incomplete information (sometimes called "hallucinations"). Always verify ' +
      'critical facts before making decisions based on its output.',
    dataPrivacyTitle: '🔒 Data Privacy',
    dataPrivacyBody:
      'Your data is processed in accordance with our company\'s privacy policy and ' +
      'Microsoft\'s Responsible AI principles. No conversation data is shared with ' +
      'third parties or used to train models outside the organisation.',
    acceptance:
      'By continuing to use this agent you acknowledge and accept these terms.',
  },
  'fr-FR': {
    title: '⚠️ Avis important',
    aiAccuracyTitle: '🤖 Contenu généré par l\'IA',
    aiAccuracyBody:
      'Cet agent est propulsé par l\'IA et peut occasionnellement générer des ' +
      'informations inexactes ou incomplètes (parfois appelées « hallucinations »). ' +
      'Vérifiez toujours les faits importants avant de prendre des décisions basées sur ses réponses.',
    dataPrivacyTitle: '🔒 Confidentialité des données',
    dataPrivacyBody:
      'Vos données sont traitées conformément à la politique de confidentialité de ' +
      'notre entreprise et aux principes d\'IA responsable de Microsoft. Aucune donnée ' +
      'de conversation n\'est partagée avec des tiers ni utilisée pour entraîner des ' +
      'modèles en dehors de l\'organisation.',
    acceptance:
      'En continuant à utiliser cet agent, vous reconnaissez et acceptez ces conditions.',
  },
};

/**
 * Returns the structured disclaimer content for the given locale.
 * Falls back to `DEFAULT_LOCALE` when the requested locale is not available.
 *
 * @param locale - A BCP-47 locale string (e.g. `'fr-FR'`, `'en-US'`).
 */
export function getDisclaimerContent(locale?: string | null): DisclaimerContent {
  const key = (locale ?? DEFAULT_LOCALE) as DisclaimerLocale;
  return disclaimerContent[key] ?? disclaimerContent[DEFAULT_LOCALE];
}
