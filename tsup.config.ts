import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/cli.ts"],
    outDir: "dist",
    format: ["esm"],           // ESM is fine for Node 18+
    platform: "node",
    target: "node18",
    sourcemap: false,
    clean: true,
    minify: false,
    dts: false,                // CLI only, no types needed
    banner: { js: "#!/usr/bin/env node" },  // keep shebang at top
    define: {
        __VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0")
    }
});
