export const dynamic = "force-dynamic";

export default function LockPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const next = searchParams?.next ?? "/app";

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 16 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
        Inventory Locked
      </h1>
      <p style={{ opacity: 0.8, marginBottom: 18 }}>
        Enter the master PIN to continue.
      </p>

      <form action="/api/unlock" method="POST">
        <input type="hidden" name="next" value={next} />

        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
          Master PIN
        </label>

        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ccc",
            fontSize: 18,
          }}
          required
        />

        <button
          type="submit"
          style={{
            marginTop: 14,
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "none",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Unlock
        </button>
      </form>

      <p style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
        Tip: You can change the PIN anytime in Vercel Environment Variables
        (MASTER_PIN).
      </p>
    </div>
  );
}
