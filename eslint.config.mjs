import js from "@eslint/js";
import globals from "globals";
// import { defineConfig } from "eslint/config";

export default [
  js.configs.recommended,
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  { files: ["**/*.{js,mjs,cjs}"], languageOptions: { globals: globals.node } },
];
