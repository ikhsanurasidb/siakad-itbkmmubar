const serverUrl = process.env.SEED_SERVER_URL ?? "http://localhost:3000";
const password = process.env.SEED_DATA_PASSWORD;

if (!password) {
  throw new Error(
    "SEED_DATA_PASSWORD wajib diisi dan tidak boleh disimpan di repository."
  );
}

const response = await fetch(`${serverUrl}/api/seed/data`, {
  body: JSON.stringify({ password }),
  headers: { "content-type": "application/json" },
  method: "POST",
});

const payload = (await response.json()) as {
  accountCount?: number;
  courseCount?: number;
  identifiers?: string[];
  lecturerCount?: number;
  message?: string;
  programCount?: number;
  studentCount?: number;
};
if (!response.ok) {
  throw new Error(
    payload.message ?? `Seed data gagal dengan status ${response.status}.`
  );
}

console.log(
  JSON.stringify(
    {
      accountCount: payload.accountCount,
      courseCount: payload.courseCount,
      identifiers: payload.identifiers,
      lecturerCount: payload.lecturerCount,
      programCount: payload.programCount,
      serverUrl,
      studentCount: payload.studentCount,
    },
    null,
    2
  )
);
