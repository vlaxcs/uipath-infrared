export type Language = "ro" | "en";

export type ResourceState = "danger" | "warn" | "fixed";
export type Resource = { name: string; state: ResourceState; status: string };
export type Criterion = "cost" | "availability" | "database";
export type Finding = { name: string; detail: string; criterion: Criterion };
export type Plan = { name: string; price: string; unit: string; detail: string };

export type Content = {
  skipLink: string;
  languageLabel: string;
  tagline: string;
  nav: { cta: string; progress: string; sections: string[] };
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    primary: string;
    secondary: string;
    scene: { label: string };
  };
  run: { eyebrow: string; title: string; label: string; steps: { stage: string; result: string }[]; status: string };
  finds: { eyebrow: string; title: string; criteria: Record<Criterion, string>; items: Finding[] };
  how: {
    eyebrow: string;
    title: string;
    steps: { title: string; body: string }[];
    resources: Resource[];
    criteria: string[];
    rehearsal: string[];
    change: { current: string; next: string };
    promise: string;
  };
  pricing: { eyebrow: string; title: string; plans: Plan[]; compare: string };
  faq: { eyebrow: string; title: string; items: { q: string; a: string }[] };
  footer: { title: string; back: string; tokensLink: string; productLink: string };
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
  tagline: "infrastructură per proiect",
  nav: { cta: "Cum funcționează", progress: "Secțiunile paginii", sections: ["Acasă", "Un run", "Ce găsește", "Cum funcționează", "Prețuri", "Întrebări", "Final"] },
  hero: {
    eyebrow: "Pentru CTO",
    title: "Infrastructura, construită pe proiectele tale.",
    lead: "Citește cloud-ul. Decide per proiect. Testează în sandbox. Îți dă pașii.",
    primary: "Cum funcționează",
    secondary: "Ce găsește",
    scene: { label: "Două site-uri de infrastructură care își schimbă componentele." },
  },
  run: {
    eyebrow: "Un run",
    title: "Șase etape. Un plan.",
    label: "Un run Infrared",
    steps: [
      { stage: "extract", result: "resurse și dependențe" },
      { stage: "investigate", result: "CPU, RAM, GPU, tokeni" },
      { stage: "propose", result: "layout-uri candidate" },
      { stage: "evaluate", result: "preț, constrângeri, rang" },
      { stage: "rehearse", result: "trafic și căderi" },
      { stage: "present", result: "planul, pas cu pas" },
    ],
    status: "gata de aprobare",
  },
  finds: {
    eyebrow: "Ce găsește",
    title: "Din consum măsurat. Nu din estimări.",
    criteria: { cost: "Cost", availability: "Disponibilitate", database: "Baze de date" },
    items: [
      { name: "Resurse idle și orfane", detail: "Instanțe, volume, IP-uri nefolosite.", criterion: "cost" },
      { name: "Rightsizing", detail: "Din CPU și RAM măsurate.", criterion: "cost" },
      { name: "GPU și tokeni", detail: "Capacitate nefolosită, consum LLM scump.", criterion: "cost" },
      { name: "Runner-e GitHub", detail: "Optimizate sau mutate on-prem.", criterion: "cost" },
      { name: "Fără fallback", detail: "Ce cade cu o zonă sau un nod.", criterion: "availability" },
      { name: "Dependențe rupte", detail: "Egress și latență, prețuite.", criterion: "availability" },
      { name: "Tabele calde", detail: "Din pg_stat_statements.", criterion: "database" },
      { name: "Domenii amestecate", detail: "Split-uri, replici, partiționare.", criterion: "database" },
    ],
  },
  how: {
    eyebrow: "În 4 pași",
    title: "Cum funcționează",
    steps: [
      { title: "Citește", body: "Read-only: resurse, metrici, scheme." },
      { title: "Decide", body: "Per proiect, după criteriile lui." },
      { title: "Testează", body: "Trafic și căderi, în sandbox." },
      { title: "Arată", body: "Pașii, cu costul de după." },
    ],
    resources: [
      { name: "rds-orders", state: "danger", status: "o zonă" },
      { name: "ec2-api", state: "warn", status: "prea mare" },
      { name: "s3-assets", state: "fixed", status: "ok" },
    ],
    criteria: ["Disponibilitate", "Cost", "Zone"],
    rehearsal: ["trafic simulat", "nod oprit", "fallback ok"],
    change: { current: "Pasul 1: mută baza", next: "Pasul 2" },
    promise: "Read-only. Nu aplică nimic singur.",
  },
  pricing: {
    eyebrow: "Prețuri",
    title: "Per companie.",
    plans: [
      { name: "Pachet", price: "100 USD", unit: "5 run-uri", detail: "20 USD per run." },
      { name: "Abonament", price: "200 USD", unit: "pe lună", detail: "Run-uri programate." },
    ],
    compare: "Un review de consultant pornește de la 495 USD.",
  },
  faq: {
    eyebrow: "Întrebări",
    title: "Ce întreabă un CTO",
    items: [
      { q: "Ce acces cere?", a: "Read-only: AWS describe și list, CloudWatch, Postgres, GitHub." },
      { q: "Cum ajunge schimbarea în producție?", a: "Ca pull request. Îl aprobi tu, îl aplică CI-ul tău." },
      { q: "Unde se poate muta?", a: "AWS, GCP, Azure, Supabase, Neon, Hetzner, Fly.io, R2, B2, Upstash, RunPod, on-prem." },
      { q: "De ce nu Vantage sau Infracost?", a: "Ele raportează costul. Infrared propune schimbarea." },
      { q: "De unde vin cifrele?", a: "Dintr-un motor determinist: prețuri, SLA, consum măsurat." },
    ],
  },
  footer: {
    title: "Infrastructura care urmează proiectele.",
    back: "Sus",
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
  tagline: "infrastructure per project",
  nav: { cta: "How it works", progress: "Page sections", sections: ["Home", "A run", "What it finds", "How it works", "Pricing", "Questions", "End"] },
  hero: {
    eyebrow: "For CTOs",
    title: "Infrastructure, built around your projects.",
    lead: "Reads your cloud. Decides per project. Rehearses in a sandbox. Hands you the steps.",
    primary: "How it works",
    secondary: "What it finds",
    scene: { label: "Two infrastructure sites exchanging components." },
  },
  run: {
    eyebrow: "A run",
    title: "Six stages. One plan.",
    label: "An Infrared run",
    steps: [
      { stage: "extract", result: "resources and dependencies" },
      { stage: "investigate", result: "CPU, RAM, GPU, tokens" },
      { stage: "propose", result: "candidate layouts" },
      { stage: "evaluate", result: "price, constraints, rank" },
      { stage: "rehearse", result: "traffic and failures" },
      { stage: "present", result: "the plan, step by step" },
    ],
    status: "ready for approval",
  },
  finds: {
    eyebrow: "What it finds",
    title: "Measured usage. Not estimates.",
    criteria: { cost: "Cost", availability: "Availability", database: "Databases" },
    items: [
      { name: "Idle and orphan resources", detail: "Unused instances, volumes, IPs.", criterion: "cost" },
      { name: "Rightsizing", detail: "From measured CPU and RAM.", criterion: "cost" },
      { name: "GPU and tokens", detail: "Idle capacity, costly LLM spend.", criterion: "cost" },
      { name: "GitHub runners", detail: "Optimised or moved on-prem.", criterion: "cost" },
      { name: "No fallback", detail: "What fails with one zone or node.", criterion: "availability" },
      { name: "Split dependencies", detail: "Egress and latency, priced.", criterion: "availability" },
      { name: "Hot tables", detail: "From pg_stat_statements.", criterion: "database" },
      { name: "Mixed domains", detail: "Splits, replicas, partitioning.", criterion: "database" },
    ],
  },
  how: {
    eyebrow: "In 4 steps",
    title: "How it works",
    steps: [
      { title: "Reads", body: "Read-only: resources, metrics, schemas." },
      { title: "Decides", body: "Per project, on its criteria." },
      { title: "Rehearses", body: "Traffic and failures, in a sandbox." },
      { title: "Shows", body: "The steps, with the cost after." },
    ],
    resources: [
      { name: "rds-orders", state: "danger", status: "one zone" },
      { name: "ec2-api", state: "warn", status: "oversized" },
      { name: "s3-assets", state: "fixed", status: "ok" },
    ],
    criteria: ["Availability", "Cost", "Zones"],
    rehearsal: ["traffic simulated", "node stopped", "fallback ok"],
    change: { current: "Step 1: move the database", next: "Step 2" },
    promise: "Read-only. Never applies a change itself.",
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Per company.",
    plans: [
      { name: "Pack", price: "100 USD", unit: "5 runs", detail: "20 USD a run." },
      { name: "Subscription", price: "200 USD", unit: "a month", detail: "Scheduled runs." },
    ],
    compare: "A consultant review starts at 495 USD.",
  },
  faq: {
    eyebrow: "Questions",
    title: "What CTOs ask",
    items: [
      { q: "What access does it need?", a: "Read-only: AWS describe and list, CloudWatch, Postgres, GitHub." },
      { q: "How does a change reach production?", a: "As a pull request. You approve it, your CI applies it." },
      { q: "Where can it move?", a: "AWS, GCP, Azure, Supabase, Neon, Hetzner, Fly.io, R2, B2, Upstash, RunPod, on-prem." },
      { q: "Why not Vantage or Infracost?", a: "They report the cost. Infrared proposes the change." },
      { q: "Where do the numbers come from?", a: "A deterministic engine: prices, SLAs, measured usage." },
    ],
  },
  footer: {
    title: "Infrastructure that follows your projects.",
    back: "Top",
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
