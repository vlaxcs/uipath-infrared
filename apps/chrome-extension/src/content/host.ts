export const HOST_ID = "infrared-extension-host";

export function ensureHost(doc: Document = document): ShadowRoot | null {
  if (doc.getElementById(HOST_ID)) return null;

  const host = doc.createElement("div");
  host.id = HOST_ID;
  doc.documentElement.appendChild(host);
  return host.attachShadow({ mode: "open" });
}
