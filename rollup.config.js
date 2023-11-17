import merge from 'deepmerge';
import url from 'postcss-url';
import reporter from 'postcss-reporter';
import postcss from 'rollup-plugin-postcss';
import sourcemaps from 'rollup-plugin-sourcemaps';

import { createSpaConfig } from '@open-wc/building-rollup';

const baseConfig = createSpaConfig({
  outputDir: 'build',
  //developmentMode: process.env.ROLLUP_WATCH === 'true',
  developmentMode: true,
  injectServiceWorker: true
});

/*
baseConfig.plugins.push(
    postcss({
 
        plugins: [
            url({
                url: "inline"
            }),
            reporter()
        ],
        extract: false
    })
)
*/

baseConfig.plugins.unshift(sourcemaps());

const realConfig = merge(baseConfig, {
  input: './www/index.html',
  output: {
    sourcemap: true,
  }
});

export default realConfig;

console.log(realConfig);