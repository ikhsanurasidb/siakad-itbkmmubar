const serverUrl = process.env.SEED_SERVER_URL ?? "http://localhost:3000";
const password = process.env.SEED_SUPERADMIN_PASSWORD;

if (!password) {
  throw new Error(
    "SEED_SUPERADMIN_PASSWORD wajib diisi dan tidak boleh disimpan di repository."
  );
}

const response = await fetch(`${serverUrl}/api/seed/superadmin`, {
  body: JSON.stringify({
    email: process.env.SEED_SUPERADMIN_EMAIL,
    identifier: process.env.SEED_SUPERADMIN_IDENTIFIER,
    name: process.env.SEED_SUPERADMIN_NAME,
    password,
  }),
  headers: { "content-type": "application/json" },
  method: "POST",
});

const payload = (await response.json()) as {
  identifier?: string;
  message?: string;
};
if (!response.ok) {
  throw new Error(
    payload.message ?? `Seed gagal dengan status ${response.status}.`
  );
}

console.log(`Superadmin seeded: ${payload.identifier}`);
