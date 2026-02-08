export const dynamic = "force-dynamic";

export default function AppHome() {
  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>ASC Inventory</h1>

        <form action="/api/logout" method="POST">
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Lock
          </button>
        </form>
      </div>

      <p style={{ marginTop: 10, opacity: 0.8 }}>
        You’re unlocked. Next we’ll add: Location picker → Mode (Use/Restock) →
        Scanner input.
      </p>
    </div>
  );
}
