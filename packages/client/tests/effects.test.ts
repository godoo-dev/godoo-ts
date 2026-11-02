import { describe, expect, it } from 'vitest';
import {
  composeEffects,
  EFFECTS,
  getHelperEffects,
  type RpcEffectManifest,
  resolveRpcEffects,
} from '../src/effects';
import { getSdkReference, SDK_REFERENCE } from '../src/reference';

function manifest(
  effects: RpcEffectManifest['declarations'][number]['effects'],
  model = 'res.partner',
  method = 'read',
): RpcEffectManifest {
  return {
    schemaVersion: 1,
    source: 'host-reviewed-target-revision',
    declarations: [{ model, method, effects }],
  };
}

describe('host effect boundary', () => {
  it('requires trusted effective implementation coverage, even for familiar names', () => {
    expect(resolveRpcEffects('res.partner', 'read')).toEqual(EFFECTS);
    expect(resolveRpcEffects('res.partner', 'custom')).toEqual(EFFECTS);
    expect(resolveRpcEffects('res.partner', 'read', { addons: [manifest(['read'])] })).toEqual(
      EFFECTS,
    );
    expect(resolveRpcEffects('other.model', 'read', { effective: manifest(['read']) })).toEqual(
      EFFECTS,
    );
    expect(resolveRpcEffects('res.partner', 'read', { effective: manifest(['read']) })).toEqual([
      'read',
    ]);
  });

  it('unions overrides and duplicates without erasing effects or unknown behavior', () => {
    const effective = manifest(['read']);
    expect(
      resolveRpcEffects('res.partner', 'read', {
        effective,
        addons: [manifest(['external', 'destructive']), manifest(['read'])],
      }),
    ).toEqual(['read', 'destructive', 'external']);
    expect(
      resolveRpcEffects('res.partner', 'read', {
        effective,
        addons: [manifest(['unknown']), manifest([])],
      }),
    ).toEqual(EFFECTS);
    expect(composeEffects(['read'], ['unknown'], [])).toEqual(EFFECTS);
    expect(Object.isFrozen(resolveRpcEffects('res.partner', 'read', { effective }))).toBe(true);
  });

  it('fails closed on malformed versions, effects, names and addon declarations', () => {
    const effective = manifest(['read']);
    for (const bad of [
      null,
      {},
      { ...effective, schemaVersion: 2 },
      manifest(['typo'] as never),
      manifest([], '*'),
      { ...effective, declarations: [null] },
    ]) {
      expect(
        resolveRpcEffects('res.partner', 'read', { effective: bad as RpcEffectManifest }),
      ).toEqual(EFFECTS);
      expect(
        resolveRpcEffects('res.partner', 'read', { effective, addons: [bad as RpcEffectManifest] }),
      ).toEqual(EFFECTS);
    }
  });

  it('rejects null and sparse declarations instead of granting a weaker effect', () => {
    const effective = manifest(['read']);
    expect(resolveRpcEffects('res.partner', 'read', { effective, addons: null } as never)).toEqual(
      EFFECTS,
    );
    expect(resolveRpcEffects('res.partner', 'read', null as never)).toEqual(EFFECTS);
    expect(resolveRpcEffects('res.partner', 'read', { effective: manifest(Array(1)) })).toEqual(
      EFFECTS,
    );
    expect(
      resolveRpcEffects('res.partner', 'read', {
        effective: { ...effective, declarations: Array(1) },
      }),
    ).toEqual(EFFECTS);
    expect(resolveRpcEffects('res.partner', 'read', { effective, addons: Array(1) })).toEqual(
      EFFECTS,
    );
    expect(composeEffects(Array(1))).toEqual(EFFECTS);
  });

  it('classifies raw calls through effective RPC facts without bypassing unknown overrides', () => {
    const raw = getHelperEffects('client.call');
    expect(raw.rpc).toBe('dynamic');
    expect(
      composeEffects(
        raw.effects,
        resolveRpcEffects('res.partner', 'read', {
          effective: manifest(['read']),
        }),
      ),
    ).toEqual(['read']);
    expect(
      composeEffects(
        raw.effects,
        resolveRpcEffects('res.partner', 'custom', {
          effective: manifest(['mutate'], 'res.partner', 'custom'),
        }),
      ),
    ).toEqual(['mutate']);
    expect(composeEffects(raw.effects, resolveRpcEffects('res.partner', 'custom'))).toEqual(
      EFFECTS,
    );
    expect(
      composeEffects(
        raw.effects,
        resolveRpcEffects('res.partner', 'read', {
          effective: manifest(['read']),
          addons: [manifest(['unknown'])],
        }),
      ),
    ).toEqual(EFFECTS);
  });

  it('retains library minima even when a host declaration understates a known operation', () => {
    expect(
      resolveRpcEffects('res.partner', 'unlink', {
        effective: manifest([], 'res.partner', 'unlink'),
      }),
    ).toEqual(['mutate', 'destructive']);
    expect(
      resolveRpcEffects('ir.module.module', 'button_immediate_install', {
        effective: manifest([], 'ir.module.module', 'button_immediate_install'),
      }),
    ).toContain('schema');
    expect(getHelperEffects('mail.postInternalNote').effects).toContain('external');
    expect(getHelperEffects('urls.getPortalUrl').effects).toContain('disclose');
    expect(getHelperEffects('new.unlistedHelper').effects).toEqual(EFFECTS);
    expect(getHelperEffects('accounting.isClosingEntryFromLines')).toEqual({
      effects: [],
      rpc: 'none',
    });
  });

  it('exposes immutable progressively selectable reference material', () => {
    expect(SDK_REFERENCE.effectContractVersion).toBe(1);
    expect(getSdkReference('properties')?.helpers.map((entry) => entry.path)).toContain(
      'properties.binding.create',
    );
    expect(getSdkReference('missing')).toBeUndefined();
    expect(Object.isFrozen(getHelperEffects('client.read').effects)).toBe(true);
  });
});
