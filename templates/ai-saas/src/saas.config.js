// Everything that makes this SaaS yours, in one place: name, words, plans and the AI feature.
// Prices shown here are what customers read; what they pay is the Stripe price in src/backend.json
// (replace each price_Replace… id there with your own from Stripe → Products).

export const PRODUCT = {
  name: 'Draftwise',
  tagline: 'Client proposals, written in minutes.',
  pitch:
    'Paste what the client asked for. Draftwise writes a clear, specific proposal in your voice, and your whole team can pick it up from there.',
  supportEmail: 'hello@draftwise.co'
};

// Plans: product must match a product in src/backend.json "payments".
export const PLANS = [
  {
    product: 'pro',
    name: 'Pro',
    price: '$29 a month',
    credits: 1000,
    features: ['1,000 drafts a month', 'Your own tone of voice', 'Export to Word and Google Docs']
  },
  {
    product: 'team',
    name: 'Team',
    price: '$99 a month',
    credits: 5000,
    features: ['5,000 drafts a month', 'Shared drafts for up to 20 people', 'Roles for clients and reviewers']
  }
];
export const FREE_CREDITS = 25;

// The AI feature: what the model is asked to do with the customer's brief.
export const AI = {
  system:
    'You write client proposals for small agencies and consultants. Write in plain, confident English. ' +
    'Structure: a one-line summary, what we understood, what we will do (3 to 5 steps), timeline, price ' +
    'placeholder [PRICE], and next step. Never invent facts about the client; mark gaps as [TO CONFIRM].',
  maxTokens: 1200
};

export const FAQ = [
  ['What counts as a draft?', 'Each time you ask for a proposal, that is one draft and uses one credit. If something goes wrong and no draft comes back, the credit is returned.'],
  ['Can my team see my drafts?', 'Drafts belong to your team. Everyone you invite can read them; members and admins can edit; viewers can only read.'],
  ['Can I cancel?', 'Yes, any time from Billing. You keep your plan until the end of the month you paid for.'],
  ['Is my data used to train AI?', 'No. Your briefs and drafts are stored for your team only.']
];
