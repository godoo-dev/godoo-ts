import { EFFECT_CONTRACT_VERSION, HELPER_EFFECTS, type HelperEffectDeclaration } from './effects';

export interface SdkReferenceIndex {
  readonly schemaVersion: 1;
  readonly revision: string;
  readonly effectContractVersion: 1;
  readonly packages: Readonly<{ client: string; introspection: string }>;
  readonly entrypoints: readonly string[];
  readonly sections: readonly string[];
  readonly guide: string;
  readonly declarations: string;
}

export interface SdkReferenceSection {
  readonly schemaVersion: 1;
  readonly revision: string;
  readonly section: string;
  readonly helpers: readonly (HelperEffectDeclaration & { readonly path: string })[];
}

/** Progressive, library-owned reference index; package bytes bind its exact revision. */
export const SDK_REFERENCE: SdkReferenceIndex = Object.freeze({
  schemaVersion: 1,
  revision: 'portable-v1',
  effectContractVersion: EFFECT_CONTRACT_VERSION,
  packages: Object.freeze({
    client: '@godoo-dev/client',
    introspection: '@godoo-dev/introspection',
  }),
  entrypoints: Object.freeze([
    '@godoo-dev/client/portable',
    '@godoo-dev/client/effects',
    '@godoo-dev/client/reference',
    '@godoo-dev/introspection/portable',
    '@godoo-dev/introspection/formatters',
  ]),
  sections: Object.freeze([
    'client',
    'accounting',
    'attendance',
    'timesheets',
    'mail',
    'urls',
    'modules',
    'properties',
    'cdc',
    'introspection',
    'formatters',
    'propertyCodecs',
  ]),
  guide: 'README.md#portable-client',
  declarations: 'Each entrypoint exports its bundled TypeScript declarations.',
});

/** Load only one API family; effects are minima and never attest server overrides. */
export function getSdkReference(section: string): SdkReferenceSection | undefined {
  if (!SDK_REFERENCE.sections.includes(section)) return undefined;
  return Object.freeze({
    schemaVersion: SDK_REFERENCE.schemaVersion,
    revision: SDK_REFERENCE.revision,
    section,
    helpers: Object.freeze(
      Object.entries(HELPER_EFFECTS)
        .filter(([path]) => path === section || path.startsWith(`${section}.`))
        .map(([path, declaration]) => Object.freeze({ path, ...declaration })),
    ),
  });
}
