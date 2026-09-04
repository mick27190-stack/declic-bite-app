import { describe, it, expect, vi } from "vitest";
import { isOrderPaymentAuthorized } from "./useOrders";

// Le module importe le client Supabase et le toast : on les neutralise,
// seule la fonction pure de visibilité est testée ici.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

/**
 * Règle métier : une commande n'apparaît dans le back-office admin qu'une
 * fois son paiement autorisé par la banque. Elle y arrive alors au statut
 * « En attente » (pending) tant que l'admin ne l'a pas confirmée.
 */
describe("isOrderPaymentAuthorized — visibilité back-office après paiement", () => {
  it("une commande payée (authorized) au statut pending est visible → « En attente »", () => {
    expect(
      isOrderPaymentAuthorized({
        status: "pending",
        capture_status: "authorized",
        stripe_payment_intent_id: "pi_123",
      }),
    ).toBe(true);
  });

  it("une commande payée (captured) reste visible", () => {
    expect(
      isOrderPaymentAuthorized({
        status: "confirmed",
        capture_status: "captured",
        stripe_payment_intent_id: "pi_123",
      }),
    ).toBe(true);
  });

  it("une commande dont le paiement n'est pas encore autorisé est masquée", () => {
    expect(
      isOrderPaymentAuthorized({
        status: "pending",
        capture_status: "pending",
        stripe_payment_intent_id: "pi_123",
      }),
    ).toBe(false);
  });

  it("un panier abandonné sans paiement (pending, aucune autorisation) est masqué", () => {
    expect(
      isOrderPaymentAuthorized({
        status: "pending",
        capture_status: null,
        stripe_payment_intent_id: null,
      }),
    ).toBe(false);
  });

  it("une commande annulée après autorisation reste visible (suivi des annulations)", () => {
    expect(
      isOrderPaymentAuthorized({
        status: "cancelled",
        capture_status: "cancelled",
        stripe_payment_intent_id: "pi_123",
      }),
    ).toBe(true);
  });

  it("une autorisation annulée sans paiement créé et toujours pending est masquée", () => {
    expect(
      isOrderPaymentAuthorized({
        status: "pending",
        capture_status: "cancelled",
        stripe_payment_intent_id: null,
      }),
    ).toBe(false);
  });

  it("une ancienne commande sans capture_status mais déjà confirmée reste visible", () => {
    expect(
      isOrderPaymentAuthorized({
        status: "confirmed",
        capture_status: null,
      }),
    ).toBe(true);
  });
});
