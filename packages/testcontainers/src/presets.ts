/**
 * Convenience presets for common Odoo setups.
 */

import {
  OdooTestContainer,
  type OdooTestContainerOptions,
  type StartedOdooContainer,
} from './odoo-container.js';

/**
 * Convenience function to start Odoo testcontainer.
 */
export async function startOdoo(options?: OdooTestContainerOptions): Promise<StartedOdooContainer> {
  return new OdooTestContainer(options).start();
}

/**
 * Predefined configurations for common Odoo development scenarios.
 */
export interface OdooPresetsApi {
  /** Basic Odoo with core modules */
  standard: () => Promise<StartedOdooContainer>;
  /** HR & Attendance modules */
  hr: () => Promise<StartedOdooContainer>;
  /** Project management modules */
  project: () => Promise<StartedOdooContainer>;
  /** Sales & CRM modules */
  sales: () => Promise<StartedOdooContainer>;
  /** Manufacturing modules */
  manufacturing: () => Promise<StartedOdooContainer>;
  /** Website & eCommerce modules */
  website: () => Promise<StartedOdooContainer>;
  /** Accounting & Finance modules */
  accounting: () => Promise<StartedOdooContainer>;
  /** Full development environment with most common modules */
  full: () => Promise<StartedOdooContainer>;
  /** OCA-focused preset — includes modules commonly used with OCA addons */
  oca: (addonsPath: string) => Promise<StartedOdooContainer>;
}

export const OdooPresets: OdooPresetsApi = {
  standard: (): Promise<StartedOdooContainer> =>
    startOdoo({
      modules: ['base', 'web'],
    }),

  hr: (): Promise<StartedOdooContainer> =>
    startOdoo({
      modules: ['hr', 'hr_attendance'],
    }),

  project: (): Promise<StartedOdooContainer> =>
    startOdoo({
      modules: ['project', 'hr_timesheet'],
    }),

  sales: (): Promise<StartedOdooContainer> =>
    startOdoo({
      modules: ['sale', 'crm', 'account'],
    }),

  manufacturing: (): Promise<StartedOdooContainer> =>
    startOdoo({
      modules: ['mrp', 'stock', 'purchase'],
    }),

  website: (): Promise<StartedOdooContainer> =>
    startOdoo({
      modules: ['website', 'website_sale', 'website_blog'],
    }),

  accounting: (): Promise<StartedOdooContainer> =>
    startOdoo({
      modules: ['account', 'account_accountant', 'account_invoicing'],
    }),

  full: (): Promise<StartedOdooContainer> =>
    startOdoo({
      modules: [
        'hr',
        'hr_attendance',
        'hr_holidays',
        'hr_timesheet',
        'project',
        'project_timesheet',
        'sale',
        'crm',
        'account',
        'purchase',
        'stock',
        'mrp',
        'website',
        'website_sale',
      ],
    }),

  oca: (addonsPath: string): Promise<StartedOdooContainer> =>
    startOdoo({
      modules: ['base', 'web', 'account', 'sale', 'purchase', 'stock', 'hr', 'project'],
      addonsPath,
    }),
};
