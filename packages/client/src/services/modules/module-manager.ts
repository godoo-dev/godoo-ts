/**
 * Module manager for installing, uninstalling, and managing Odoo modules
 *
 * Provides methods for managing Odoo addons/modules through the ir.module.module API
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_module.py
 */

import debug from 'debug';
import type { OdooClient } from '../../client/odoo-client';
import type { Domain } from '../../rpc/types';
import {
  inspectModulePrerequisites,
  type ModuleInspectionOptions,
  type ModulePrerequisiteInspection,
} from './inspection';

import {
  type ModuleOperationOptions,
  type ModuleOperationResult,
  performModuleOperation,
} from './lifecycle';
import type { ModuleInfo, ModuleListOptions } from './module-types';

export type { ModuleInfo, ModuleListOptions } from './module-types';

const log = debug('odoo-client:module-manager');

/**
 * Manager for Odoo module operations
 *
 * Handles installation, uninstallation, upgrades, and listing of Odoo modules.
 */
export class ModuleManager {
  private client: OdooClient;

  constructor(client: OdooClient) {
    this.client = client;
  }

  /** Read registered addon states and transitive dependency facts without mutations. */
  inspectPrerequisites(
    moduleNames: readonly string[],
    options: ModuleInspectionOptions = {},
  ): Promise<ModulePrerequisiteInspection> {
    return inspectModulePrerequisites(this.client, moduleNames, options);
  }

  private _catalogRevision = 0;

  /** Conservative local invalidation signal; compare in finally after lifecycle calls. */
  get catalogRevision(): number {
    return this._catalogRevision;
  }

  /** Explicit install with fresh dependency postconditions; installed modules are verified no-ops. */
  installModule(
    moduleName: string,
    options: ModuleOperationOptions = {},
  ): Promise<ModuleOperationResult> {
    return performModuleOperation(this.client, 'install', moduleName, options, () => {
      this._catalogRevision++;
    });
  }

  /**
   * Uninstall a module by name
   *
   * Uses button_immediate_uninstall method from ir.module.module model.
   * This method uninstalls the module immediately.
   *
   * @param moduleName - Technical name of the module
   * @returns Module info after uninstallation
   *
   * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_module.py#L550
   *
   * @example
   * ```typescript
   * await moduleManager.uninstallModule('project');
   * ```
   */
  async uninstallModule(moduleName: string): Promise<ModuleInfo> {
    log('Uninstalling module: %s', moduleName);

    // Find the module
    const modules = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      [['name', '=', moduleName]],
      { fields: ['id', 'name', 'state'], limit: 1 },
    );

    if (modules.length === 0) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    const module = modules[0];

    if (module.state === 'uninstalled') {
      log('Module %s is already uninstalled', moduleName);
      return module;
    }

    if (module.state !== 'installed') {
      throw new Error(
        `Module '${moduleName}' cannot be uninstalled (current state: ${module.state})`,
      );
    }

    // Uninstall the module using button_immediate_uninstall
    log('Calling button_immediate_uninstall for module %s (id: %d)', moduleName, module.id);
    await this.client.call('ir.module.module', 'button_immediate_uninstall', [[module.id]]);

    // Fetch updated module info
    const [updatedModule] = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      [['id', '=', module.id]],
      {
        fields: ['id', 'name', 'state', 'shortdesc', 'summary', 'installed_version', 'application'],
      },
    );

    log('Module %s uninstalled successfully (state: %s)', moduleName, updatedModule.state);
    return updatedModule;
  }

  /** Explicit upgrade with fresh dependency postconditions; Odoo owns dependent upgrades. */
  upgradeModule(
    moduleName: string,
    options: ModuleOperationOptions = {},
  ): Promise<ModuleOperationResult> {
    return performModuleOperation(this.client, 'upgrade', moduleName, options, () => {
      this._catalogRevision++;
    });
  }

  /**
   * List available modules with optional filtering
   *
   * @param options - Filtering and pagination options
   * @returns Array of module information
   *
   * @example
   * ```typescript
   * // List all installed modules
   * const installed = await moduleManager.listModules({ state: 'installed' });
   *
   * // List all applications
   * const apps = await moduleManager.listModules({ application: true });
   * ```
   */
  async listModules(options: ModuleListOptions = {}): Promise<ModuleInfo[]> {
    log('Listing modules with options: %o', options);

    const domain: Domain = [];

    if (options.state) {
      domain.push(['state', '=', options.state]);
    }

    if (options.application !== undefined) {
      domain.push(['application', '=', options.application]);
    }

    const searchOptions: {
      fields: string[];
      limit?: number;
      offset?: number;
    } = {
      fields: [
        'id',
        'name',
        'state',
        'shortdesc',
        'summary',
        'author',
        'website',
        'installed_version',
        'latest_version',
        'license',
        'application',
        'category_id',
      ],
    };

    if (options.limit !== undefined) {
      searchOptions.limit = options.limit;
    }

    if (options.offset !== undefined) {
      searchOptions.offset = options.offset;
    }

    const modules = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      domain,
      searchOptions,
    );

    log('Found %d modules', modules.length);
    return modules;
  }

  /**
   * Get detailed information about a specific module
   *
   * @param moduleName - Technical name of the module
   * @returns Detailed module information
   *
   * @example
   * ```typescript
   * const info = await moduleManager.getModuleInfo('project');
   * console.log(info.description);
   * ```
   */
  async getModuleInfo(moduleName: string): Promise<ModuleInfo> {
    log('Getting info for module: %s', moduleName);

    const modules = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      [['name', '=', moduleName]],
      {
        fields: [
          'id',
          'name',
          'state',
          'shortdesc',
          'summary',
          'description',
          'author',
          'website',
          'installed_version',
          'latest_version',
          'license',
          'application',
          'category_id',
        ],
        limit: 1,
      },
    );

    if (modules.length === 0) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    return modules[0];
  }

  /**
   * Check if a module is installed
   *
   * @param moduleName - Technical name of the module
   * @returns True if module is installed
   *
   * @example
   * ```typescript
   * if (await moduleManager.isModuleInstalled('project')) {
   *   console.log('Project module is installed');
   * }
   * ```
   */
  async isModuleInstalled(moduleName: string): Promise<boolean> {
    log('Checking if module is installed: %s', moduleName);

    const modules = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      [
        ['name', '=', moduleName],
        ['state', '=', 'installed'],
      ],
      { fields: ['id'], limit: 1 },
    );

    return modules.length > 0;
  }
}
