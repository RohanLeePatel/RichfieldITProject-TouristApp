// Help content and legal text shown on the settings page.
//
// The privacy policy and terms below are a starting template written for a
// South African travel app (POPIA). Have them reviewed before launch and
// update LEGAL_LAST_UPDATED whenever the wording changes, and TERMS_VERSION in
// backend/project-backend/src/services/authService.js to the same date.

import { SUPPORT_EMAIL } from "../../api/settings.js";

export const LEGAL_LAST_UPDATED = "2026-10-31";

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
    a: "Go to Settings, then Privacy & data, then Delete account, and enter your password. Your profile, preferences, saved travellers, sign-in history, chat and translation history are deleted straight away, along with trips that only you were part of. In groups with other people the trips stay for them. Records we must keep by law are kept only for as long as required. This can't be undone.",
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
      "Roamio is a travel planning app that helps you plan trips, keep your itinerary, budget and documents together, and travel with others. This policy explains what personal information we collect, why, who we share it with and the choices you have. We process personal information in line with the Protection of Personal Information Act, 2013 (POPIA).",
      `Our Information Officer can be reached at ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    heading: "Information we collect",
    body: [
      "Account details: your name, email address and password. Your password is stored only as a secure hash, never as readable text.",
      "Trip information: the trips, itineraries, budgets, expenses, travel groups and invitations you create or that are shared with you, and the booking documents (PDFs and images) you attach to a trip.",
      "Assistant and translator content: the questions you ask the trip assistant and its replies, and the text and photos you translate, with your translation history.",
      "Preferences: your currency, language, theme and notification choices. Your profile photo is kept in your own browser rather than on our servers.",
      "Saved travellers: if you save the details of people you travel with, we keep their name, date of birth, nationality, contact details, the type and expiry date of their travel document, and a record that you had their permission.",
      "Sign-in history: each time you sign in we record the time, your browser and operating system, your IP address and an approximate location (a country and city worked out from the IP address). It lets you see your signed-in devices and spot activity you don't recognise, and is kept for 90 days.",
      "Technical information: like most websites, our hosting records your IP address and the pages requested in server logs, which we use to keep Roamio running and secure.",
      "We never store passport or ID numbers. For a saved traveller we keep only the document type, its expiry date and the last 4 characters of the number.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To run Roamio: sign you in, send the verification and password-reset codes you ask for, show your trips to the people you share them with, give you recommendations, weather, safety advice and translations, and answer your questions in the assistant. We also use it to keep the service secure and to respond when you contact us. We don't sell your personal information and we don't use it for advertising.",
    ],
  },
  {
    heading: "Who else handles your information",
    body: [
      "We use these service providers to run Roamio. Each receives only what it needs to do its job:",
      "Supabase and Vercel host our database, file storage and servers. Your account, trips, documents, chat history and translation history are stored there.",
      "Google (Gemini) powers the trip assistant. When you chat, your messages and basic facts about the trip you're asking about (destination, dates, itinerary, safety advisory and weather) are sent to Google. On the free service we use, Google may use these prompts to improve its products, so please don't put sensitive personal details in the chat.",
      "DeepL translates the text you ask to translate. OCR.space reads the text in photos you scan. Geoapify finds places and landmarks from the destinations you search. OpenWeather provides weather for your destination. Map images are loaded from OpenStreetMap, which sees your IP address when a map is shown.",
      "Our email provider delivers the codes and notices we send you.",
      "Several of these providers run servers outside South Africa. We choose providers that protect personal information, and we share it with authorities only when the law requires it.",
    ],
  },
  {
    heading: "Cookies and similar storage",
    body: [
      "We use cookies only to keep you signed in. They are strictly necessary: a short-lived access cookie and a longer refresh cookie, both hidden from page scripts. We also use your browser's storage to remember choices such as your theme, active trip and dismissed tips.",
      "We do not use advertising or tracking cookies. If that changes, we will update this policy and ask for your consent first.",
    ],
  },
  {
    heading: "Saved travellers and other people's details",
    body: [
      "You may only add another person's details with their permission, or as their parent or legal guardian if they are under 18. You can edit or delete a saved traveller in Settings at any time.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "We keep your information while your account is open. You can delete your account yourself in Settings (you will need your password), or email us from the address on your account and we will do it within 30 days. Your profile, preferences, saved travellers, sign-in history, chat history and translation history are deleted, along with trips that only you were part of. In a group with other people, the trips stay for them, and if you were its owner another member takes over. We keep only records the law requires us to keep, and only for as long as required.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "You can ask to see, correct, download or delete your information, and object to certain processing, by emailing us. You can change your name and preferences in Settings, and the Download my data option there gives you a file with your profile, preferences, saved travellers, groups and trips, notifications, assistant chats, translation history and sign-in history. If you are unhappy with how we handle your information, you may complain to the Information Regulator of South Africa.",
    ],
  },
  {
    heading: "Keeping your information safe",
    body: [
      "Connections to Roamio are encrypted, passwords and verification codes are stored as hashes, and a trip's documents and details are only available to the people on that trip. No system is perfectly secure. If a breach affects your information, we will tell you and the Information Regulator as the law requires.",
    ],
  },
  {
    heading: "Changes and contact",
    body: [
      "We'll tell you about important changes before they take effect, and the date at the top shows when this policy was last updated.",
      `Questions about privacy? Email ${SUPPORT_EMAIL}.`,
    ],
  },
];

export const TERMS = [
  {
    heading: "Using Roamio",
    body: [
      "By creating an account or using Roamio you agree to these terms and to our Privacy Policy. You must be at least 18 years old to hold an account.",
    ],
  },
  {
    heading: "Your account",
    body: [
      "Keep your sign-in details secure and tell us straight away if you think someone else has accessed your account. You're responsible for activity on your account and for making sure the details you provide are accurate.",
    ],
  },
  {
    heading: "What Roamio is",
    body: [
      "Roamio is a planning tool. It helps you choose destinations, build an itinerary, track a budget and keep your documents together. We don't sell flights, accommodation or other travel services, and we're not a party to any booking you make with a third party. Their terms, including change and cancellation rules, apply to those bookings.",
    ],
  },
  {
    heading: "Recommendations, translations and the assistant",
    body: [
      "Recommendations, translations, weather, safety information and the trip assistant's answers are produced with the help of automated systems and third-party data. They are provided to help you and can be wrong or out of date. Check anything important, such as safety notices, health and medical advice, visa and entry rules and legal requirements, with an official source before you rely on it.",
    ],
  },
  {
    heading: "Your content and shared trips",
    body: [
      "You keep ownership of what you add, such as trips, notes and documents. You allow us to store, display and process it as needed to run Roamio and to show it to the people you share it with. Anything you put in a shared trip or travel group can be seen by its members, so share only what you're happy for them to see.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Don't misuse Roamio. In particular, don't:",
      "interfere with its security or try to reach other people's accounts or data;",
      "upload unlawful content, or files that contain malware or that you have no right to share;",
      "add another person's details without their permission;",
      "use automated tools to scrape the service or put an unreasonable load on it, or use the assistant to produce harmful or unlawful content.",
    ],
  },
  {
    heading: "Availability",
    body: [
      "We work to keep Roamio running, but we can't promise it will always be available or error-free. We may change or remove features, and we rely on third-party services that can fail. Keep a copy of anything you can't afford to lose, such as booking confirmations.",
    ],
  },
  {
    heading: "Liability",
    body: [
      "To the extent the law allows, Roamio isn't liable for indirect losses, or for losses caused by travel partners, travel disruptions, inaccurate third-party information or events outside our control. Nothing in these terms limits rights you have under the Consumer Protection Act.",
    ],
  },
  {
    heading: "Ending your account",
    body: [
      "You can stop using Roamio at any time, and delete your account in Settings (or by email), as described in the Privacy Policy. We may suspend accounts that break these terms, and will tell you why unless the law prevents us.",
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
