import { compileHttpsRules } from '../../shared/https';
import type { Module } from '../module';
import { installRules } from '../rules';

/** Loading pages over HTTPS only. */
export function createHttpsModule(): Module {
  return {
    name: 'https',
    sections: ['https'],
    async apply({ https }) {
      await installRules('https', compileHttpsRules(https));
    },
  };
}
