export const env = {
  es6: true,
  node: true,
  commonjs: true, // ✅ add this
};
export const parserOptions = {
  ecmaVersion: 2018,
};
export const extends1 = [
  "eslint:recommended",
  "google",
];
export const rules = {
  "no-restricted-globals": ["error", "name", "length"],
  "prefer-arrow-callback": "error",
  "quotes": ["error", "double", { "allowTemplateLiterals": true }],
};
export const overrides = [
  {
    files: ["**/*.spec.*"],
    env: {
      mocha: true,
    },
    rules: {},
  },
];
export const globals = {
  module: "writable", // ✅ allow module
  exports: "writable", // ✅ allow exports
  require: "readonly", // ✅ allow require
};
