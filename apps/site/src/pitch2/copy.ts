import type { Language } from "../content";

type Point = { who: string; text: string };
type Shot = { src: string; width: number; height: number; who: string; alt: string };
type Section = { id: string; label: string; title: string; tagline?: string; shots?: [Shot, Shot]; points: Point[] };

export type Pitch2Copy = {
  title: string;
  skipLink: string;
  languageLabel: string;
  byDigi: string;
  sections: [Section, Section, Section];
  closing: string;
};

export const pitch2Copy: Record<Language, Pitch2Copy> = {
  en: {
    title: "Netpotu | Pitch",
    skipLink: "Skip to content",
    languageLabel: "Language",
    byDigi: "Service for internet providers",
    closing: "Netpotu comes bundled with the router.",
    sections: [
      {
        id: "problema",
        label: "The problem",
        title: "The law puts home security on the provider. The customer doesn't see the risk.",
        points: [
          { who: "Providers", text: "Must secure the service and warn subscribers about risks (Law 506/2004, NIS2)." },
          { who: "Customers", text: "Don't know what is open in their own home." },
        ],
      },
      { id: "solutia", label: "How we solved it", title: "ACTIONABLE reports, built from the home network.", tagline: "TAP and SOLVE.",
        shots: [
          { src: "/pitch-operator-ro.webp", width: 1600, height: 990, who: "You, the provider", alt: "The operator's page for one customer report: score 85, 3 of 5 steps fixed, the technical explanation and what to tell the customer on the phone." },
          { src: "/pitch-whatsapp-ro.webp", width: 672, height: 1310, who: "Your customer", alt: "The customer's WhatsApp chat with Netpotu: the customer taps I'm done, the step is checked and marked fixed, the next step arrives with three buttons." },
        ],
        points: [] },
      {
        id: "de-ce-noi",
        label: "Why us",
        title: "The customer gets it from their internet provider.",
        points: [
          { who: "You, the provider", text: "See the full context of every home, without a call." },
          { who: "Your customer", text: "Gets the reports on WhatsApp. Nothing to install. Discovers the fixes through a learning map." },
        ],
      },
    ],
  },
  ro: {
    title: "Netpotu | Pitch",
    skipLink: "Sari la conținut",
    languageLabel: "Limba",
    byDigi: "Serviciu pentru furnizorii de internet",
    closing: "Netpotu vine la pachet cu routerul.",
    sections: [
      {
        id: "problema",
        label: "Problema",
        title: "Legea pune siguranța casei pe furnizor. Clientul nu vede riscul.",
        points: [
          { who: "Furnizorii", text: "Trebuie să securizeze serviciul și să-și anunțe abonații despre riscuri (Legea 506/2004, NIS2)." },
          { who: "Clienții", text: "Nu știu ce e deschis în propria casă." },
        ],
      },
      { id: "solutia", label: "Cum am rezolvat-o", title: "Rapoarte ACȚIONABILE, pe baza rețelei de acasă.", tagline: "APEȘI și REZOLVI.",
        shots: [
          { src: "/pitch-operator-ro.webp", width: 1600, height: 990, who: "Tu, ca furnizor", alt: "Pagina operatorului pentru raportul unui client: scor 85, 3 din 5 pași rezolvați, explicația tehnică și ce îi spune clientului la telefon." },
          { src: "/pitch-whatsapp-ro.webp", width: 672, height: 1310, who: "Clientul tău", alt: "Conversația clientului cu Netpotu pe WhatsApp: apasă Am terminat, pasul e verificat și rezolvat, apoi vine pasul următor cu trei butoane." },
        ],
        points: [] },
      {
        id: "de-ce-noi",
        label: "De ce noi",
        title: "Clientul alege serviciul de la furnizorul de internet.",
        points: [
          { who: "Tu, ca furnizor", text: "Vezi tot contextul fiecărei case, fără apel." },
          { who: "Clientul tău", text: "Primește rapoartele pe WhatsApp. Nu instalează nimic. Descoperă reparațiile pe o hartă de învățare." },
        ],
      },
    ],
  },
};
