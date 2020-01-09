// svelte options exported for svelte-vscode

const sveltePreprocess = require('svelte-preprocess');

const {
  preprocess: makeTsPreprocess,
  createEnv,
  readConfigFile,
} = require("@pyoner/svelte-ts-preprocess");

const env = createEnv();
const compilerOptions = readConfigFile(env);
const preprocessOptions = {
  env,
  compilerOptions: {
    ...compilerOptions,
    allowNonTsExtensions: true,
  },
};



module.exports = {
  dev: process.env.NODE_ENV !== "development",
  // preprocess,
  preprocess: sveltePreprocess(),
};
