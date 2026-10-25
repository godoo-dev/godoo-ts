import {
  type Domain,
  inspectModulePrerequisites,
  OdooClient,
  type OdooCrudClient,
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
