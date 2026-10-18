#!/usr/bin/env bash
# No compose, deployment, credentials, published ports or external runtime network.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null
validation_id="yams-docker-validation-$$"
builder="$validation_id:builder"
runner="$validation_id:runner"
container=""
context_dir=$(mktemp -d)
cleanup() {
  if [[ -n "$container" ]]; then docker rm -f "$container" >/dev/null 2>&1 || true; fi
  docker image rm "$builder" "$runner" >/dev/null 2>&1 || true
  rm -rf "$context_dir"
}
trap cleanup EXIT
# Build from tracked files only; local untracked secrets cannot enter this context.
git ls-files -z | tar --null -T - -cf - | tar -xf - -C "$context_dir"
printf '%s\n' 'YAMS_DOCKER_''EXCLUDED_ENV_CANARY' > "$context_dir/.env.validation"
mkdir -p "$context_dir/validation-nested"
printf '%s\n' 'YAMS_DOCKER_''EXCLUDED_ENV_CANARY' > "$context_dir/validation-nested/.env.validation"
args=(--platform linux/amd64 --build-arg NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=public-docker-validation-only)
docker build "${args[@]}" --target builder -t "$builder" "$context_dir"
docker build "${args[@]}" -t "$runner" "$context_dir"
for image in "$builder" "$runner"; do
  [[ $(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image") == linux/amd64 ]]
  docker run --rm --network none --entrypoint node "$image" -e '
    const assert = require("node:assert/strict");
    assert.equal(process.version, "v24.22.0");
    assert.equal(process.arch, "x64");
    assert.ok(process.report.getReport().header.glibcVersionRuntime);
    for (const name of Object.keys(process.env)) {
      if (/^(SUPABASE_|AUTH_JWT|GUEST_JWT|BACKOFFICE_|BREVO_|JWT_SECRET)/.test(name)) throw Error(`Unexpected image environment: ${name}`);
    }
    require("sharp");
    require("@next/swc-linux-x64-gnu");
  '
done
# Inspect both stages: ignored files must never enter even the builder filesystem.
for image in "$builder" "$runner"; do
  docker run --rm --network none --entrypoint node "$image" -e '
    const fs = require("node:fs");
    function scan(dir) {
      for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
        const path = `${dir}/${entry.name}`;
        if (entry.name.startsWith(".env")) throw Error(`Environment file: ${path}`);
        if (entry.isDirectory()) scan(path);
        else if (entry.isFile() && fs.readFileSync(path).includes("YAMS_DOCKER_" + "EXCLUDED_ENV_CANARY")) throw Error(`Leaked canary: ${path}`);
      }
    }
    scan("/app");
  '
done
docker run --rm --network none --entrypoint node "$runner" -e '
  const fs = require("node:fs");
  for (const path of ["dist/server.js", ".next/BUILD_ID", "public", "package.json", "node_modules/next"]) fs.accessSync(path);
  for (const path of [".git", "src", "scripts", "supabase"]) if (fs.existsSync(path)) throw Error(`Unexpected runtime source: ${path}`);
'
# A closed loopback endpoint fails immediately when startup tries restoring games.
# The real server must still serve health; no Supabase or JWT secret is supplied.
container=$(docker run -d --network none \
  -e NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=public-docker-validation-only \
  -e SUPABASE_URL=http://127.0.0.1:9 \
  -e SUPABASE_SERVICE_ROLE_KEY=public-docker-validation-only \
  "$runner")
if ! docker exec "$container" node -e '
  const deadline = Date.now() + 60000;
  async function poll() {
    while (Date.now() < deadline) {
      try {
        const response = await fetch("http://127.0.0.1:3000/api/health", {signal: AbortSignal.timeout(2000)});
        if (response.status === 200 && (await response.json()).status === "ok") return;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw Error("Health smoke test timed out");
  }
  poll().catch(error => { console.error(error); process.exit(1); });
'; then
  docker logs "$container"
  exit 1
fi
printf 'Docker build, native bindings, image contents and isolated health smoke test passed.\n'
