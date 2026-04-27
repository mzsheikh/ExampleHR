import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended
});

export default [
  {
    ignores: [".next/**", "node_modules/**", "storybook-static/**", "coverage/**"]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript", "plugin:storybook/recommended")
];
