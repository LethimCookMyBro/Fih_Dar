// --import bootstrap: registers alias-loader.mjs as an ESM loader hook so
// officer-workflow.test.mjs can import the real src/server/*.ts modules
// (unmodified) directly under Node. Run via the `masterpass:officer-test`
// npm script, which supplies the required --conditions=react-server and
// --experimental-transform-types flags.
import { register } from 'node:module';

register('./alias-loader.mjs', import.meta.url);
