// eslint.config.js  (ESLint flat config — ESLint 9+)
import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";

export default [
  js.configs.recommended,
  {
    plugins: { jsdoc },
    rules: {
      // JSDoc
      "jsdoc/require-jsdoc": [
        "warn",
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, ArrowFunctionExpression: false },
        },
      ],
      "jsdoc/require-param": "warn",
      "jsdoc/require-param-type": "warn",
      "jsdoc/require-returns": "warn",

      // General
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "warn",
      eqeqeq: ["error", "always"],
      curly: "error",
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { process: "readonly", URL: "readonly", URLSearchParams: "readonly" },
    },
    ignores: ["node_modules/**", "coverage/**"],
  },
];
