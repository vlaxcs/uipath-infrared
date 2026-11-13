export type Language = "ro" | "en";

export type DeviceState = "danger" | "warn" | "fixed";
export type Device = { name: string; state: DeviceState; status: string };
export type Severity = "high" | "medium" | "low";
export type Find = { code: string; name: string; detail: string; severity: Severity };

export type Content = {
  skipLink: string;
  languageLabel: string;
  byDigi: string;
  nav: { cta: string; progress: string; sections: string[] };
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    primary: string;
    secondary: string;
    chatImage: string;
    chatAlt: string;
  };
  finds: { eyebrow: string; title: string; lead: string; severity: Record<Severity, string>; items: Find[] };
  how: {
    eyebrow: string;
    title: string;
    steps: { title: string; body: string }[];
    devices: Device[];
    incoming: string;
    outgoing: string;
    checked: string;
    nextStep: string;
    promise: string;
  };
  faq: { eyebrow: string; title: string; items: { q: string; a: string }[] };
  footer: { title: string; lead: string; back: string; tokensLink: string; productLink: string };
  tokens: {
    title: string;
    lead: string;
    colors: string;
    pairs: string;
    pass: string;
    fail: string;
    copy: string;
    copied: string;
    reset: string;
  };
};

const ro: Content = {
  skipLink: "Sari la conținut",
  languageLabel: "Limba",
  byDigi: "de la Digi",
  nav: { cta: "Cum funcționează", progress: "Secțiunile paginii", sections: ["Acasă", "Ce găsește", "Cum funcționează", "Întrebări", "Final"] },
  hero: {
    eyebrow: "Pentru internetul de acasă",
    title: "Îți spunem ce să repari la internetul de acasă.",
    lead: "Netpotu se uită la aparatele din casă și îți scrie pe WhatsApp ce ai de făcut. Câte un pas, în cuvinte simple.",
    primary: "Vezi cum funcționează",
    secondary: "Ce poate găsi",
    chatImage: "/wa-chat-ro.webp",
    chatAlt:
      "Conversație pe WhatsApp cu Netpotu: ce filmează camera Hikvision poate fi văzut de alții de pe Wi-Fi, iar primul pas este să deschizi aplicația camerei. Dedesubt, butoanele Am terminat, Gata, ce urmează? și Explică mai simplu.",
  },
  finds: {
    eyebrow: "Ce poate găsi",
    title: "Lucruri pe care nu le vezi, dar le poți repara.",
    lead: "Câteva exemple. Netpotu îți spune doar ce a găsit la tine acasă și începe cu ce e mai grav.",
    severity: { high: "Grav", medium: "Mediu", low: "Mic" },
    items: [
      { code: "CAMERA_STREAM_EXPOSED", name: "Alții pot vedea imaginea camerei tale", detail: "Oricine e pe Wi-Fi-ul tău o poate deschide.", severity: "high" },
      { code: "TELNET_OPEN", name: "Un străin poate prelua controlul unui aparat", detail: "Intrarea nu e protejată, iar parola poate fi furată.", severity: "high" },
      { code: "HTTP_ADMIN_CLEARTEXT", name: "Parola din setările routerului poate fi citită", detail: "Oricine e pe Wi-Fi-ul tău o poate vedea când o scrii.", severity: "medium" },
      { code: "MQTT_EXPOSED", name: "Aparatele smart pot primi comenzi de la alții", detail: "Oricine e pe Wi-Fi-ul tău poate încerca să le dea comenzi.", severity: "medium" },
      { code: "PRINTER_RAW_EXPOSED", name: "Oricine poate trimite documente la imprimantă", detail: "Îți poate consuma hârtia și cerneala.", severity: "low" },
      { code: "UNKNOWN_DEVICE", name: "Un aparat necunoscut e conectat la Wi-Fi", detail: "Nu știm ce este. Verifică dacă e al tău.", severity: "low" },
    ],
  },
  how: {
    eyebrow: "În 4 pași",
    title: "Cum funcționează",
    steps: [
      { title: "Routerul se uită", body: "Vede ce aparate ai și ce lasă deschis." },
      { title: "Primești un mesaj", body: "Îți scrie pe WhatsApp ce să repari primul." },
      { title: "Faci ce scrie", body: "Un singur pas, în cuvinte simple." },
      { title: "Routerul verifică", body: "Vede dacă a mers și trece mai departe." },
    ],
    devices: [
      { name: "Camera", state: "danger", status: "Expusă" },
      { name: "Imprimanta", state: "warn", status: "De verificat" },
      { name: "Televizorul", state: "fixed", status: "În regulă" },
    ],
    incoming: "Deschide pe telefon aplicația pentru cameră.",
    outgoing: "Am terminat",
    checked: "Rezolvat",
    nextStep: "Urmează pasul 2",
    promise: "Nu îți cerem niciodată un link, o parolă sau bani.",
  },
  faq: {
    eyebrow: "Întrebări",
    title: "Ce vor să știe oamenii",
    items: [
      { q: "Trebuie să instalez ceva?", a: "Nu. Netpotu merge pe routerul Digi pe care îl ai deja. Mesajele vin pe WhatsApp." },
      { q: "Ce fac dacă nu înțeleg un pas?", a: "Scrii că nu înțelegi sau apeși butonul de explicație. Primești același pas, spus mai simplu." },
      { q: "Unele lucruri le repară Digi pentru mine?", a: "Da. Ce ține de routerul Digi se poate repara de la distanță, dar numai după ce ești de acord în mesaj." },
      { q: "Ce date pleacă din casa mea?", a: "Adresele aparatelor și istoricul rămân în router. Spre Digi pleacă doar pașii, ce fel de aparate ai, marca lor și programul de pe ele, ca să te poată ajuta dacă suni la suport." },
      { q: "Cum știu că mesajul e chiar de la Netpotu?", a: "Netpotu nu îți cere niciodată un link, o parolă sau bani. Dacă un mesaj îți cere așa ceva, nu e de la noi." },
    ],
  },
  footer: {
    title: "Netpotu vine cu routerul Digi.",
    lead: "Nu instalezi nimic. Mesajele vin pe WhatsApp, de la Netpotu.",
    back: "Înapoi la început",
    tokensLink: "Tokenuri de design",
    productLink: "Înapoi la produs",
  },
  tokens: {
    title: "Tokenuri de design",
    lead: "Schimbă o culoare aici, vezi contrastul, apoi copiază blocul în src/tokens.css.",
    colors: "Culori",
    pairs: "Contrast text pe fundal (WCAG AA)",
    pass: "Trece",
    fail: "Nu trece",
    copy: "Copiază tokens.css",
    copied: "Copiat",
    reset: "Resetează",
  },
};

const en: Content = {
  skipLink: "Skip to content",
  languageLabel: "Language",
  byDigi: "by Digi",
  nav: { cta: "How it works", progress: "Page sections", sections: ["Home", "What it finds", "How it works", "Questions", "End"] },
  hero: {
    eyebrow: "For your home internet",
    title: "We tell you what to fix on your home internet.",
    lead: "Netpotu looks at the devices in your home and writes to you on WhatsApp what to do. One step at a time, in simple words.",
    primary: "See how it works",
    secondary: "What it can find",
    chatImage: "/wa-chat-ro.webp",
    chatAlt:
      "A WhatsApp chat with Netpotu, in Romanian: what the Hikvision camera films can be seen by others on the Wi-Fi, and the first step is to open the camera's app. Below it, the buttons I'm done, Done, what's next? and Explain it simpler.",
  },
  finds: {
    eyebrow: "What it can find",
    title: "Things you can't see, but can fix.",
    lead: "A few examples. Netpotu only tells you what it found in your home, and starts with the worst.",
    severity: { high: "Serious", medium: "Medium", low: "Minor" },
    items: [
      { code: "CAMERA_STREAM_EXPOSED", name: "Others can see what your camera films", detail: "Anyone on your Wi-Fi can open its picture.", severity: "high" },
      { code: "TELNET_OPEN", name: "A stranger could take control of a device", detail: "The login is not protected, so the password can be stolen.", severity: "high" },
      { code: "HTTP_ADMIN_CLEARTEXT", name: "The password to your router settings can be read", detail: "Anyone on your Wi-Fi can see it when you type it.", severity: "medium" },
      { code: "MQTT_EXPOSED", name: "Smart devices can take orders from others", detail: "Anyone on your Wi-Fi could try to give them commands.", severity: "medium" },
      { code: "PRINTER_RAW_EXPOSED", name: "Anyone can send documents to your printer", detail: "They could use up your paper and ink.", severity: "low" },
      { code: "UNKNOWN_DEVICE", name: "An unknown device is on your Wi-Fi", detail: "We do not know what it is. Check that it is yours.", severity: "low" },
    ],
  },
  how: {
    eyebrow: "In 4 steps",
    title: "How it works",
    steps: [
      { title: "The router looks", body: "It sees your devices and what they leave open." },
      { title: "You get a message", body: "It writes on WhatsApp what to fix first." },
      { title: "You do what it says", body: "One step, in simple words." },
      { title: "The router checks", body: "It sees if it worked and moves on." },
    ],
    devices: [
      { name: "Camera", state: "danger", status: "Exposed" },
      { name: "Printer", state: "warn", status: "To check" },
      { name: "TV", state: "fixed", status: "All good" },
    ],
    incoming: "Open the app for your camera on your phone.",
    outgoing: "I'm done",
    checked: "Fixed",
    nextStep: "Step 2 is next",
    promise: "We never ask you for a link, a password or money.",
  },
  faq: {
    eyebrow: "Questions",
    title: "What people ask",
    items: [
      { q: "Do I have to install anything?", a: "No. Netpotu runs on the Digi router you already have. The messages come on WhatsApp." },
      { q: "What if I don't understand a step?", a: "Write that you don't understand, or tap the explain button. You get the same step, said more simply." },
      { q: "Does Digi fix some things for me?", a: "Yes. What belongs to the Digi router can be fixed remotely, but only after you agree in the message." },
      { q: "What data leaves my home?", a: "Your devices' addresses and the history stay in the router. Only the steps, what kind of devices you have, their brand and the software on them go to Digi, so they can help if you call support." },
      { q: "How do I know a message is really from Netpotu?", a: "Netpotu never asks you for a link, a password or money. If a message asks for that, it is not from us." },
    ],
  },
  footer: {
    title: "Netpotu comes with your Digi router.",
    lead: "You install nothing. The messages come on WhatsApp, from Netpotu.",
    back: "Back to the start",
    tokensLink: "Design tokens",
    productLink: "Back to the product",
  },
  tokens: {
    title: "Design tokens",
    lead: "Change a colour here, check the contrast, then copy the block into src/tokens.css.",
    colors: "Colours",
    pairs: "Text on background contrast (WCAG AA)",
    pass: "Pass",
    fail: "Fail",
    copy: "Copy tokens.css",
    copied: "Copied",
    reset: "Reset",
  },
};

export const content: Record<Language, Content> = { ro, en };
