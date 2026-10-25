/**
 * Custom Testcontainer module for Odoo development.
 *
 * Provides high-level API for starting Odoo with specific modules,
 * custom addons, and proper cleanup.
 */

import { randomUUID } from 'node:crypto';
import { ModuleManager, OdooClient } from '@godoo-dev/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import Dockerode, { type HostConfig } from 'dockerode';
import {
  GenericContainer,
  Network,
  type StartedNetwork,
  type StartedTestContainer,
  Wait,
} from 'testcontainers';
import {
  createSnapshotCache,
  ensureSnapshotDir,
  hasSnapshot,
  restoreSnapshot,
  type SnapshotCacheOptions,
  saveSnapshot,
  snapshotBindMount,
} from './snapshot-cache.js';
import { normaliseOdooVersion } from './version.js';

/** Bind only the run's ephemeral published ports, never a shared LAN interface. */
function bindLoopback(config: HostConfig): void {
  for (const bindings of Object.values(config.PortBindings ?? {}) as { HostIp?: string }[][]) {
    for (const binding of bindings ?? []) binding.HostIp = '127.0.0.1';
  }
}
class LoopbackOdooContainer extends GenericContainer {
  protected async beforeContainerCreated(): Promise<void> {
    bindLoopback(this.hostConfig);
  }
}
class LoopbackPostgresContainer extends PostgreSqlContainer {
  protected async beforeContainerCreated(): Promise<void> {
    bindLoopback(this.hostConfig);
  }
}

const POSTGRES_IMAGE = 'postgres:15-alpine';

/** Remove only this invocation's labeled containers and exact newly created network. */
async function cleanupOwnedRun(
  containers: StartedTestContainer[],
  network: StartedNetwork,
  runId: string,
): Promise<void> {
  const docker = new Dockerode();
  await Promise.allSettled(containers.map((c) => c.stop()));
  const filters = { label: [`dev.godoo.test-run=${runId}`] };
  const remaining = await docker.listContainers({ all: true, filters });
  for (const info of remaining) {
    if (info.Labels['dev.godoo.test-run'] !== runId)
      throw new Error('Container ownership mismatch');
    await docker.getContainer(info.Id).remove({ force: true, v: true });
  }
  try {
    await network.stop();
  } catch (error) {
    // A shared/foreign endpoint must not be force-disconnected to make cleanup green.
    const networks = await docker.listNetworks({ filters: { id: [network.getId()] } });
    if (networks.length) throw error;
  }
  const leaked = await docker.listContainers({ all: true, filters });
  if (leaked.length)
    throw new Error(`Owned containers leaked: ${leaked.map((c) => c.Id).join(',')}`);
  const networks = await docker.listNetworks({ filters: { id: [network.getId()] } });
  if (networks.length) throw new Error(`Owned network leaked: ${network.getId()}`);
  console.log(
    'GODOO_CLEANUP_PROOF ' +
      JSON.stringify({
        runId,
        networkId: network.getId(),
        containers: containers.map((c) => c.getId()),
        remainingContainers: 0,
        remainingNetworks: 0,
      }),
  );
}

// ── Public types ────────────────────────────────────────────────────

export interface AddonsMount {
  /** Local source directory (e.g., './oca-addons' or './my-custom-addons') */
  source: string;
  /** Mount point inside container (e.g., '/mnt/oca-addons') */
  target?: string;
  /** Mount mode (default: 'ro' for read-only) */
  mode?: 'ro' | 'rw';
}

export interface OdooTestContainerOptions {
  /** Odoo modules to install (e.g., ['hr_attendance', 'project', 'sale']) */
  modules?: string[];
  /** Custom addons to mount - can be string (single path) or AddonsMount[] (multiple) */
  addonsPath?: string | AddonsMount[];
  /** Database name (default: 'test_odoo') */
  database?: string;
  /** Admin password (default: 'admin') */
  adminPassword?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Startup timeout in ms (default: 180000) */
  startupTimeout?: number;
  /**
   * Cache the post-init/module-install database baseline as a local pg_dump.
   * Enabled by default. Set false to force a cold Odoo init every time.
   */
  snapshot?: boolean | SnapshotCacheOptions;
}

export interface StartedOdooContainer {
  odooContainer: StartedTestContainer;
  postgresContainer: StartedPostgreSqlContainer | StartedTestContainer;
  client: OdooClient;
  moduleManager: ModuleManager;
  url: string;
  database: string;
  cleanup: () => Promise<void>;
}

export class OdooTestContainer {
  private options: Required<Omit<OdooTestContainerOptions, 'addonsPath' | 'env' | 'snapshot'>> & {
    addonsPath?: string | AddonsMount[];
    env: Record<string, string>;
    snapshot?: boolean | SnapshotCacheOptions;
  };

  constructor(options: OdooTestContainerOptions = {}) {
    this.options = {
      modules: [],
      database: 'test_odoo',
      adminPassword: 'admin',
      startupTimeout: 300_000, // 5 min — DB init can take 3–4 min in CI
      env: {},
      ...options,
    };
  }

  /**
   * Start Odoo container with PostgreSQL and install requested modules.
   *
   * When snapshot caching is enabled, the first run for a given
   * Odoo/modules/addons/env hash writes a local pg_dump. Later starts restore
   * that baseline and skip Odoo --init plus module installation.
   */
  async start(): Promise<StartedOdooContainer> {
    const odooVer = normaliseOdooVersion(process.env.ODOO_VERSION);
    const snapshot = createSnapshotCache(this.options.snapshot, {
      odooVersion: odooVer,
      postgresImage: POSTGRES_IMAGE,
      modules: this.options.modules,
      addonsPath: this.options.addonsPath,
      database: this.options.database,
      adminPassword: this.options.adminPassword,
      env: this.options.env,
    });
    const snapshotHit = hasSnapshot(snapshot);

    if (snapshot.enabled) {
      ensureSnapshotDir(snapshot);
      console.log(
        snapshotHit
          ? `⚡ Starting Odoo testcontainer from snapshot ${snapshot.key}`
          : `🚀 Starting Odoo testcontainer cold; will save snapshot ${snapshot.key}`,
      );
    } else {
      console.log(
        `🚀 Starting Odoo testcontainer with modules: ${this.options.modules.join(', ')}`,
      );
    }

    // Create a network for container communication
    const runId = randomUUID();
    const labels = { 'dev.godoo.test-run': runId };
    const network = await new Network().start();

    // Track started containers for cleanup on error
    const startedContainers: StartedTestContainer[] = [];

    try {
      // ── Postgres ──────────────────────────────────────────────────────
      const pgUser = 'odoo';
      const pgPassword = 'odoo';

      const postgresContainer: StartedPostgreSqlContainer | StartedTestContainer =
        await new LoopbackPostgresContainer(POSTGRES_IMAGE)
          .withLabels(labels)
          .withDatabase(this.options.database)
          .withUsername(pgUser)
          .withPassword(pgPassword)
          .withNetwork(network)
          .withNetworkAliases('db')
          .withBindMounts(snapshotBindMount(snapshot))
          .start();

      startedContainers.push(postgresContainer);
      console.log(
        `✅ PostgreSQL ready at ` +
          `${postgresContainer.getHost()}:${postgresContainer.getMappedPort(5432)}`,
      );

      if (snapshotHit) {
        await restoreSnapshot(postgresContainer, snapshot, this.options.database, pgUser);
        console.log(`✅ Restored Odoo database snapshot ${snapshot.key}`);
      }

      // ── Odoo ──────────────────────────────────────────────────────────
      //
      // --max-cron-threads 0 disables the cron scheduler:
      //   • Eliminates ir_cron advisory-lock races during DB init
      //   • Saves ~60–90 s of startup time in CI
      //   • Safe for test environments (no scheduled jobs needed)
      //
      // Snapshot hit: no --init (database already exists + modules installed).
      // Snapshot miss: --init base creates the database structure.
      const odooCommand = snapshotHit
        ? ['--database', this.options.database, '--without-demo', 'all', '--max-cron-threads', '0']
        : [
            '--database',
            this.options.database,
            '--init',
            'base',
            '--without-demo',
            'all',
            '--max-cron-threads',
            '0',
          ];

      let odooContainer = new LoopbackOdooContainer(`odoo:${odooVer}`)
        .withLabels(labels)
        .withNetwork(network)
        .withEnvironment({
          HOST: 'db',
          PORT: '5432',
          USER: pgUser,
          PASSWORD: pgPassword,
          ...this.options.env,
        })
        .withCommand(odooCommand)
        .withStartupTimeout(this.options.startupTimeout)
        .withExposedPorts(8069)
        .withWaitStrategy(
          // /web/health fires as soon as the HTTP listener binds (before
          // the ORM is ready). waitForOdooReady() then probes
          // /web/session/authenticate until auth succeeds.
          Wait.forHttp('/web/health', 8069)
            .forStatusCode(200)
            .withStartupTimeout(this.options.startupTimeout),
        );

      // Mount custom addons if specified
      if (this.options.addonsPath) {
        const { bindMounts, addonsPaths } = this.prepareAddonMounts(this.options.addonsPath);

        odooContainer = odooContainer.withBindMounts(bindMounts);

        // Tell Odoo where to find all the addons
        const allAddonsPaths = [
          '/usr/lib/python3/dist-packages/odoo/addons', // Core Odoo addons
          ...addonsPaths, // Custom addon paths
        ].join(',');

        odooContainer = odooContainer.withCommand([
          ...odooCommand,
          '--addons-path',
          allAddonsPaths,
        ]);
      }

      const startedOdooContainer = await odooContainer.start();
      startedContainers.push(startedOdooContainer);
      const url = `http://${startedOdooContainer.getHost()}:${startedOdooContainer.getMappedPort(8069)}`;

      console.log(`✅ Odoo ready at ${url}`);

      // Wait for ORM/session to be ready (not just HTTP listener)
      await this.waitForOdooReady(url, this.options.database);

      // Create authenticated client
      const client = new OdooClient({
        url,
        database: this.options.database,
        username: 'admin',
        password: this.options.adminPassword,
      });

      await client.authenticate();
      const server = await client.getServerInfo();
      if (server.major !== Number.parseInt(odooVer, 10)) {
        throw new Error(`Requested Odoo ${odooVer}, observed ${server.version}`);
      }
      const docker = new Dockerode();
      const owned = await Promise.all(
        [startedOdooContainer, postgresContainer].map(async (container) => {
          const info = await docker.getContainer(container.getId()).inspect();
          const image = await docker.getImage(info.Image).inspect();
          return {
            id: container.getId(),
            imageId: info.Image,
            imageDigests: image.RepoDigests,
            ports: info.NetworkSettings.Ports,
          };
        }),
      );
      console.log(
        'GODOO_ODOO_PROOF ' +
          JSON.stringify({
            runId,
            requested: odooVer,
            observed: server,
            modules: this.options.modules,
            networkId: network.getId(),
            containers: owned,
          }),
      );

      const moduleManager = new ModuleManager(client);

      // ── Module installation ───────────────────────────────────────────
      if (!snapshotHit && this.options.modules.length > 0) {
        await this.installModules(moduleManager, this.options.modules);
      } else if (snapshotHit) {
        console.log('✅ All requested modules already present in snapshot');
      }

      if (!snapshotHit && snapshot.enabled) {
        await saveSnapshot(postgresContainer, snapshot, this.options.database, pgUser);
        console.log(`✅ Saved Odoo database snapshot ${snapshot.key}`);
      }

      return {
        odooContainer: startedOdooContainer,
        postgresContainer,
        client,
        moduleManager,
        url,
        database: this.options.database,
        cleanup: async () => {
          console.log('🧹 Cleaning up Odoo testcontainer...');
          client.logout();
          await cleanupOwnedRun(startedContainers, network, runId);
          console.log('✅ Cleanup complete');
        },
      };
    } catch (error) {
      try {
        await cleanupOwnedRun(startedContainers, network, runId);
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Startup failed and owned cleanup failed');
      }
      throw error;
    }
  }

  // ── Addon helpers ─────────────────────────────────────────────────────

  /**
   * Prepare addon mounts from various input formats.
   */
  private prepareAddonMounts(addonsPath: string | AddonsMount[]): {
    bindMounts: Array<{ source: string; target: string; mode?: 'ro' | 'rw' }>;
    addonsPaths: string[];
  } {
    const bindMounts: Array<{ source: string; target: string; mode?: 'ro' | 'rw' }> = [];
    const addonsPaths: string[] = [];

    if (typeof addonsPath === 'string') {
      // Simple string path
      const target = '/mnt/extra-addons';
      bindMounts.push({
        source: addonsPath,
        target,
        mode: 'ro',
      });
      addonsPaths.push(target);
    } else {
      // Array of AddonsMount objects
      addonsPath.forEach((mount, index) => {
        const target = mount.target || `/mnt/addons-${index}`;
        bindMounts.push({
          source: mount.source,
          target,
          mode: mount.mode ?? 'ro',
        });
        addonsPaths.push(target);
      });
    }

    return { bindMounts, addonsPaths };
  }

  // ── Readiness helpers ─────────────────────────────────────────────────

  /**
   * Wait for Odoo's ORM/session layer to be ready.
   *
   * /web/health returns 200 as soon as the HTTP listener binds, but the
   * ORM and session handler (/web/session/authenticate) may not be ready
   * for several more seconds. Polling authenticate — the same endpoint
   * that clients will use immediately after startup — ensures the server
   * is truly ready before we hand it to the test.
   */
  private async waitForOdooReady(url: string, database: string, maxAttempts = 30): Promise<void> {
    const authPayload = JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: database, login: 'admin', password: this.options.adminPassword },
    });

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${url}/web/session/authenticate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: authPayload,
        });

        if (response.ok) {
          // Odoo returns HTTP 200 even before the DB exists, with uid=false.
          // Only proceed when uid is a positive integer (auth succeeded).
          const data = (await response.json()) as { result?: { uid?: number | false } };
          if (data.result?.uid) {
            console.log(`✅ Odoo session handler ready (attempt ${i + 1})`);
            return;
          }
        }
      } catch {
        // not ready yet — swallow and retry
      }

      console.log(`⏳ Waiting for Odoo session handler... (attempt ${i + 1}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Odoo session handler did not become ready within timeout');
  }

  // ── Module installation ───────────────────────────────────────────────

  /**
   * Install modules with dependency resolution.
   */
  private async installModules(moduleManager: ModuleManager, modules: string[]): Promise<void> {
    console.log(`📦 Installing Odoo modules: ${modules.join(', ')}`);

    for (const module of modules) {
      if (!(await moduleManager.isModuleInstalled(module))) {
        console.log(`📦 Installing ${module}...`);
        await moduleManager.installModule(module);
        console.log(`✅ ${module} installed`);
      } else {
        console.log(`✅ ${module} already installed`);
      }
    }
  }
}
