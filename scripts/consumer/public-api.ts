import {
  type Domain,
  getPropertyValue,
  inspectModulePrerequisites,
  OdooClient,
  type OdooCrudClient,
  type PropertiesReadFormat,
  type PropertiesWriteFormat,
  type PropertyReadValueType,
  propertiesToWriteFormat,
} from '@godoo-dev/client';
import { generateCompleteFile, Introspector, type ModelMetadata } from '@godoo-dev/introspection';
import {
  normaliseOdooVersion,
  type OdooTestContainerOptions,
  type StartedOdooContainer,
  startOdoo,
} from '@godoo-dev/testcontainers';

const client: OdooCrudClient = new OdooClient({
  url: 'http://127.0.0.1:1',
  database: 'disposable',
  username: 'admin',
  password: 'admin',
});
const domain: Domain = [['name', '=', 'Example']];
const options: OdooTestContainerOptions = { modules: ['base'], snapshot: false };
const provision: (options?: OdooTestContainerOptions) => Promise<StartedOdooContainer> = startOdoo;
const introspector = new Introspector(client as OdooClient);
const propertyRead: PropertiesReadFormat = [
  { name: 'owner', string: 'Owner', type: 'many2one', comodel: 'res.partner', value: [41, null] },
  {
    name: 'watchers',
    string: 'Watchers',
    type: 'many2many',
    comodel: 'res.partner',
    value: [[42, 'B']],
  },
  { name: 'tags', string: 'Tags', type: 'tags', tags: [['ready', 'Ready', 1]], value: ['ready'] },
  { name: 'clear', string: 'Clear', type: 'integer', value: null },
];
export const propertyWrite: PropertiesWriteFormat = propertiesToWriteFormat(propertyRead);
export const propertyRaw: PropertyReadValueType = getPropertyValue(propertyRead, 'owner');
// Relation display tuples belong to RPC reads, never dictionary writes.
// @ts-expect-error A display tuple is not a property dictionary-write value.
const invalidPropertyWrite: PropertiesWriteFormat = { owner: [41, 'Display name'] };
void invalidPropertyWrite;
export const publicTypes = {
  client,
  domain,
  options,
  provision,
  introspector,
  normaliseOdooVersion,
  inspectModulePrerequisites,
};
export const generate: (metadata: ModelMetadata[]) => string = generateCompleteFile;
