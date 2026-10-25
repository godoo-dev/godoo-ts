export interface ModuleInfo {
  id: number;
  name: string;
  state: 'uninstalled' | 'installed' | 'to install' | 'to upgrade' | 'to remove' | 'uninstallable';
  shortdesc?: string;
  summary?: string;
  description?: string;
  author?: string;
  website?: string;
  installed_version?: string;
  latest_version?: string;
  license?: string;
  application?: boolean;
  category_id?: [number, string];
}

export interface ModuleListOptions {
  /** Filter modules by state */
  state?: ModuleInfo['state'];
  /** Filter modules that are applications */
  application?: boolean;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}
