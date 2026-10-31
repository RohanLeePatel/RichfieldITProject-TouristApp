// Help content and legal text shown on the settings page.
//
// The privacy policy and terms below are a starting template written for a
// South African travel app (POPIA). Have them reviewed before launch and
// update LEGAL_LAST_UPDATED whenever the wording changes.

import { SUPPORT_EMAIL } from "../../api/settings.js";

export const LEGAL_LAST_UPDATED = "2026-10-28";

export const FAQS = [
  {
    q: "How do I change my password?",
    a: "Go to Security and choose Change password. We'll email a 6-digit code to your account address. Enter it with your new password, which must be at least 8 characters long.",
  },
  {
    q: "I'm not receiving notifications. What should I check?",
    a: "Under Notifications, make sure the channel (email or browser) is switched on, and that the topic you expect is turned on for that channel. For email, check your spam or promotions folder and add our address to your contacts.",
  },
  {
    q: "Why can't I turn on browser notifications?",
    a: "Your browser has to give Roamio permission. If you blocked it earlier, click the padlock or site-settings icon next to the web address, allow Notifications for this site, then reload the page and switch browser notifications on again.",
  },
  {
    q: "I see a sign-in I don't recognise. What should I do?",
    a: "Change your password straight away, then use Sign out of all other sessions under Security. If you still see activity you don't recognise, report it to us from Help and support.",
  },
  {
    q: "Who can see the travellers I save?",
    a: "Only you. Saved traveller details are used to fill in bookings you make, and are never shown to other members of your travel groups. You can edit or remove a traveller at any time.",
  },
  {
    q: "Can I save a child as a traveller?",
    a: "Yes, if you are their parent or legal guardian. We'll ask you to confirm this when you save a traveller who is under 18.",
  },
  {
    q: "What is included when I download my data?",
    a: "Your profile, preferences, notification settings and saved travellers, in a machine-readable JSON file. The file contains personal information, so store it somewhere safe.",
  },
  {
    q: "What happens when I delete my account?",
    a: "Your profile, saved travellers, preferences and trips you own are permanently deleted. Records we must keep by law, such as payment records, are kept only for as long as required. This can't be undone.",
  },
  {
    q: "How do I change my home currency or translation language?",
    a: "Open Profile & preferences, choose a new home currency or Translate into language, then select Save changes. The trip wizard and translator use these choices.",
  },
];

export const REPORT_CATEGORIES = [
  "Something isn't working",
  "Booking or trip",
  "Account and sign-in",
  "Payments and expenses",
  "Translator",
  "Suggestion",
  "Other",
];

export const PRIVACY_POLICY = [
  {
    heading: "Who we are",
    body: [
      "Roamio is a travel planning app that helps you plan trips, manage bookings and travel with others. This policy explains what personal information we collect, why we collect it and the choices you have. We process personal information in line with the Protection of Personal Information Act, 2013 (POPIA).",
    ],
  },
  {
    heading: "Information we collect",
    body: [
      "Account details: your name, email address, password (stored only as a secure hash) and profile photo.",
      "Preferences: your home currency, translation language, theme and notification choices.",
      "Travel information: trips, itineraries, bookings and expenses you add or that are shared with you.",
      "Saved travellers: details you add about people you travel with, such as names, dates of birth and passport details.",
      "Security information: devices, approximate location and IP addresses used to sign in, so we can protect your account.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To provide and improve Roamio, send booking confirmations and travel updates you've chosen to receive, keep your account secure and respond when you contact us. We don't sell your personal information.",
    ],
  },
  {
    heading: "Saved travellers",
    body: [
      "You may only save another person's details with their permission, or as their parent or legal guardian if they are under 18. We use these details only to complete bookings you make, and passport and ID numbers are stored encrypted and shown masked.",
    ],
  },
  {
    heading: "Sharing",
    body: [
      "We share information with airlines, accommodation providers and other travel partners only when it's needed for a booking you make, and with service providers who help us run Roamio under contracts that require them to protect it. We disclose information to authorities only when the law requires it.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "We keep your information while your account is open. When you delete your account, we delete your personal information, except records we must keep by law, which we keep only for as long as required.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "You can access, correct and download your information, object to certain processing, and delete your account from Settings at any time. If you're unhappy with how we handle your information, you may complain to the Information Regulator of South Africa.",
    ],
  },
  {
    heading: "Contact us",
    body: [`Questions about privacy? Email ${SUPPORT_EMAIL}.`],
  },
];

export const TERMS = [
  {
    heading: "Using Roamio",
    body: [
      "By creating an account or using Roamio you agree to these terms. You must be at least 18 years old to hold an account. Children may travel as saved travellers on a parent's or guardian's account.",
    ],
  },
  {
    heading: "Your account",
    body: [
      "Keep your sign-in details secure and tell us straight away if you think someone else has accessed your account. You're responsible for activity on your account and for making sure the details you provide are accurate.",
    ],
  },
  {
    heading: "Bookings and travel partners",
    body: [
      "Flights, stays and other services are provided by third-party travel partners under their own terms, including their change and cancellation rules. Roamio isn't responsible for a partner's service, but we'll help where we can if something goes wrong.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Don't misuse Roamio, interfere with its security, upload unlawful content or add another person's details without their permission.",
    ],
  },
  {
    heading: "Translations and recommendations",
    body: [
      "Translations and travel recommendations are provided to help you and may not always be accurate. Check important information, such as safety notices, medical details and legal requirements, with an official source.",
    ],
  },
  {
    heading: "Liability",
    body: [
      "To the extent the law allows, Roamio isn't liable for indirect losses or for losses caused by travel partners, travel disruptions or events outside our control. Nothing in these terms limits rights you have under the Consumer Protection Act.",
    ],
  },
  {
    heading: "Ending your account",
    body: [
      "You can delete your account at any time in Settings. We may suspend accounts that break these terms, and will tell you why unless the law prevents us.",
    ],
  },
  {
    heading: "Changes and governing law",
    body: [
      "We'll tell you about important changes to these terms before they take effect. These terms are governed by the laws of the Republic of South Africa.",
      `Questions? Email ${SUPPORT_EMAIL}.`,
    ],
  },
];
