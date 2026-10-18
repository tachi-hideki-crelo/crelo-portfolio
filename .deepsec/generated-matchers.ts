import { compileDeclarativeMatchers, type DeepsecPlugin } from 'deepsec/config';

export const generatedMatchersPlugin: DeepsecPlugin = {
  name: 'crelo-generated-matchers',
  matchers: compileDeclarativeMatchers([]),
};
