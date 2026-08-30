import type { Page, Route } from "@playwright/test";

/**
 * Backend simulé pour les tests E2E de bout en bout des flux de commande.
 *
 * Toutes les requêtes vers Supabase (auth, REST, RPC, Edge Functions) sont
 * interceptées : les scénarios sont donc déterministes, ne touchent aucune
 * donnée réelle et ne nécessitent ni session Lovable ni clés Stripe.
 *
 * Le helper enregistre les appels sortants (Edge Functions, INSERT/PATCH sur
 * `orders`) pour permettre les assertions sur le contrat backend :
 * capture (`confirm-order`), annulation (`cancel-order`) et réponse à une
 * contre-proposition d'horaire (`respond-to-delivery-time`).
 */

export const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";

export interface RecordedCall {
  name: string;
  body: Record<string, unknown>;
}

export interface RecordedWrite {
  method: string;
  url: string;
  body: Record<string, unknown>;
}

export interface BackendRecorder {
  /** Appels aux Edge Functions, dans l'ordre. */
  functionCalls: RecordedCall[];
  /** INSERT / PATCH émis sur la table `orders`. */
  orderWrites: RecordedWrite[];
  /** Dernier appel à une Edge Function donnée. */
  lastCall(name: string): RecordedCall | undefined;
  /** Nombre d'appels à une Edge Function donnée. */
  countCalls(name: string): number;
}

export interface MockBackendOptions {
  /** Lignes renvoyées par table pour les GET REST (`orders`, `profiles`, ...). */
  tables?: Record<string, unknown[]>;
  /** Rôles renvoyés pour l'utilisateur simulé. */
  roles?: string[];
  /** Réponses personnalisées des Edge Functions. */
  functions?: Record<
    string,
    { status?: number; body: Record<string, unknown> }
  >;
  /** Ligne renvoyée par un INSERT sur `orders`. */
  onCreateOrder?: (payload: Record<string, unknown>) => Record<string, unknown>;
  /** Connecter (ou non) une session Supabase simulée. */
  authenticated?: boolean;
}

function tableFromUrl(url: string): string | null {
  const m = url.match(/\/rest\/v1\/([^/?]+)/);
  return m ? m[1] : null;
}

function parseBody(route: Route): Record<string, unknown> {
  try {
    const raw = route.request().postData();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/** Session Supabase factice, valide côté client (jamais envoyée au vrai backend). */
export function fakeSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: "e2e-fake-access-token",
    refresh_token: "e2e-fake-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: TEST_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "e2e@declicpizza.fr",
      phone: "33600000000",
      app_metadata: { provider: "phone" },
      user_metadata: { first_name: "E2E", last_name: "Test" },
      created_at: new Date().toISOString(),
    },
  };
}

export async function mockBackend(
  page: Page,
  options: MockBackendOptions = {},
): Promise<BackendRecorder> {
  const {
    tables = {},
    roles = [],
    functions = {},
    onCreateOrder,
    authenticated = true,
  } = options;

  const recorder: BackendRecorder = {
    functionCalls: [],
    orderWrites: [],
    lastCall(name) {
      return [...this.functionCalls].reverse().find((c) => c.name === name);
    },
    countCalls(name) {
      return this.functionCalls.filter((c) => c.name === name).length;
    },
  };

  // Stripe.js et le realtime ne doivent jamais sortir du sandbox de test.
  await page.route("https://js.stripe.com/**", (route) => route.abort());
  await page.route("**/realtime/v1/**", (route) => route.abort());

  // 1) REST générique : lecture des tables simulées, écritures enregistrées.
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();
    const table = tableFromUrl(url);

    if (method === "OPTIONS") return json(route, {});

    // RPC (prix serveur, etc.) : réponse neutre, le front retombe sur son calcul local.
    if (url.includes("/rest/v1/rpc/")) return json(route, null);

    if (table === "user_roles") {
      return json(route, roles.map((role) => ({ role })));
    }

    if (table === "orders") {
      if (method === "POST") {
        const body = parseBody(route);
        const payload = Array.isArray(body) ? body[0] : body;
        recorder.orderWrites.push({ method, url, body: payload });
        const created = onCreateOrder
          ? onCreateOrder(payload)
          : {
              id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: "pending",
              capture_status: "pending",
              site: "conches",
              ...payload,
            };
        return json(route, [created], 201);
      }
      if (method === "PATCH") {
        recorder.orderWrites.push({ method, url, body: parseBody(route) });
        return json(route, [], 200);
      }
      return json(route, tables.orders ?? []);
    }

    // Consentement RGPD à jour par défaut : la modale bloquante de
    // régularisation ne doit pas masquer les écrans testés.
    if (table === "consentements" && method === "GET") {
      return json(route, tables.consentements ?? [{ id: "e2e-consent" }]);
    }

    if (method === "GET") return json(route, tables[table ?? ""] ?? []);
    return json(route, []);

  });

  // 2) Auth : session factice, aucun échange avec le vrai serveur d'auth.
  await page.route("**/auth/v1/**", async (route) => {
    const url = route.request().url();
    if (!authenticated) return json(route, { user: null }, 401);
    if (url.includes("/auth/v1/user")) return json(route, fakeSession().user);
    if (url.includes("/auth/v1/token")) return json(route, fakeSession());
    if (url.includes("/auth/v1/logout")) return json(route, {}, 204);
    return json(route, {});
  });

  // 3) Edge Functions : enregistrement + réponse configurable.
  await page.route("**/functions/v1/**", async (route) => {
    const name = route.request().url().split("/functions/v1/")[1].split("?")[0];
    if (route.request().method() === "OPTIONS") return json(route, {});
    recorder.functionCalls.push({ name, body: parseBody(route) });
    const configured = functions[name];
    return json(route, configured?.body ?? { success: true }, configured?.status ?? 200);
  });

  return recorder;
}

/** Injecte la session simulée dans le localStorage (origine localhost). */
export async function installFakeSession(page: Page, baseUrl: string) {
  const projectId =
    process.env.VITE_SUPABASE_PROJECT_ID ?? "tzamsbbpygevsdvugdbv";
  await page.goto(baseUrl);
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [`sb-${projectId}-auth-token`, JSON.stringify(fakeSession())] as const,
  );
}
