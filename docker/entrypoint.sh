#!/bin/sh
set -e

if [ -z "$SQLITE_PATH" ]; then
  echo "[Entrypoint] Mode PostgreSQL terdeteksi. Memastikan skema tabel siap..."
  node -e '
    const fs = require("node:fs");
    const { createRequire } = require("node:module");
    const { resolveDatabaseConfig } = require("./database/dist/index.js");
    const cfg = resolveDatabaseConfig();
    if (cfg.provider === "postgresql") {
      const prismaEntry = require.resolve("prisma/config", { paths: ["./database"] });
      const prismaReq = createRequire(prismaEntry);
      const pgMod = prismaReq("postgres");
      const postgres = typeof pgMod === "function" ? pgMod : pgMod.default;
      const sql = postgres(cfg.url, { max: 1, onnotice: () => {} });
      const ddl = fs.readFileSync("./docker/init-postgres.sql", "utf8");
      sql.unsafe(ddl)
        .then(() => sql.end({ timeout: 5 }))
        .then(() => console.log("[Entrypoint] Skema PostgreSQL terverifikasi."))
        .catch((err) => {
          console.error("[Entrypoint] Gagal inisialisasi skema PostgreSQL:", err.message);
          process.exit(1);
        });
    }
  '
fi

echo "[Entrypoint] Menjalankan server production Ruang Baca..."
exec node dist/main.js
