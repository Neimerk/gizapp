import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockInvoke     = vi.fn();
const mockEq         = vi.fn();
const mockGetSession = vi.fn();

vi.mock("../lib/supabase", () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    auth:      { getSession: mockGetSession },
    from:      () => ({ update: () => ({ eq: mockEq }) }),
  },
}));

vi.mock("../stores/authStore", () => ({
  useAuthStore: {
    getState: () => ({ user: { id: "user-1" } }),
  },
}));

// ── Import after mocks ─────────────────────────────────────────────────────

const { adminUpdateWithdrawal, requestWithdrawal } = await import(
  "../services/paymentApi"
);

// ── Tests ──────────────────────────────────────────────────────────────────

describe("adminUpdateWithdrawal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chama process-withdrawal e retorna sem erros quando status=paid e ok=true", async () => {
    mockInvoke.mockResolvedValue({ error: null, data: { ok: true } });

    await expect(adminUpdateWithdrawal("wd-1", "paid")).resolves.toBeUndefined();
    expect(mockInvoke).toHaveBeenCalledWith("process-withdrawal", {
      body: { withdrawalId: "wd-1" },
    });
  });

  it("lança erro quando process-withdrawal retorna ok=false", async () => {
    mockInvoke.mockResolvedValue({ error: null, data: { ok: false, error: "Saldo insuficiente" } });

    await expect(adminUpdateWithdrawal("wd-2", "paid")).rejects.toThrow("Saldo insuficiente");
  });

  it("lança erro quando invoke retorna res.error", async () => {
    mockInvoke.mockResolvedValue({ error: { message: "Timeout" }, data: null });

    await expect(adminUpdateWithdrawal("wd-3", "paid")).rejects.toThrow("Timeout");
  });

  it("atualiza o banco diretamente quando status=failed", async () => {
    mockEq.mockResolvedValue({ error: null });

    await expect(adminUpdateWithdrawal("wd-4", "failed")).resolves.toBeUndefined();
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith("id", "wd-4");
  });
});

describe("requestWithdrawal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna withdrawalId em caso de sucesso", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "tok-abc" } },
    });
    mockInvoke.mockResolvedValue({
      error: null,
      data: { ok: true, withdrawalId: "wd-ok-1" },
    });

    const result = await requestWithdrawal({
      amount:     100,
      pixKey:     "11999999999",
      pixKeyType: "phone",
    });

    expect(result).toEqual({ withdrawalId: "wd-ok-1" });
    expect(mockInvoke).toHaveBeenCalledWith("create-withdrawal", {
      body: { amount: 100, pixKey: "11999999999", pixKeyType: "phone" },
    });
  });
});
