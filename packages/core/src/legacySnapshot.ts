// TODO(v7): remove this module and its callers. It reads snapshots written by
// 6.0.0-beta.1, which used `$`- and `_`-prefixed field names that stores such
// as Convex reject. Snapshots are written with the new names only.

// Legacy marker key -> [new key, other keys the marker object may have].
const markers: Record<string, [string, string[]]> = {
  $actor: ['@actor', ['incarnation']],
  $error: ['@error', ['message']],
  $stateNode: ['@stateNode', []],
  $systemMapper: ['@systemMapper', []]
};

const fields: Record<string, string> = {
  _stateInputs: 'stateInputs',
  _nextTimerId: 'nextTimerId',
  _nextActorIds: 'nextActorIds'
};

// Persisted snapshots are JSON; live objects (actors, state nodes, errors)
// are left alone.
function isPlain(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null || Array.isArray(value);
}

function renameMarkers(value: any, allowed: readonly string[]): any {
  if (!isPlain(value)) return value;
  if (Array.isArray(value)) {
    const items = value.map((item) => renameMarkers(item, allowed));
    return items.some((item, i) => item !== value[i]) ? items : value;
  }
  const keys = Object.keys(value);
  const legacy = keys.find((key) => allowed.includes(key));
  if (
    legacy &&
    typeof value[legacy] === 'string' &&
    keys.every((key) => key === legacy || markers[legacy][1].includes(key))
  ) {
    const { [legacy]: name, ...rest } = value;
    return { [markers[legacy][0]]: name, ...rest };
  }
  let copy: any;
  for (const key of keys) {
    const item = renameMarkers(value[key], allowed);
    if (item !== value[key]) (copy ??= { ...value })[key] = item;
  }
  return copy ?? value;
}

// beta.1 always wrote `_nextTimerId` on machine snapshots. Current snapshots
// write `nextTimerId`, so marker-shaped data in them is left alone.
function isLegacyEnvelope(envelope: any): boolean {
  return (
    isPlain(envelope) &&
    '_nextTimerId' in envelope &&
    !('nextTimerId' in envelope)
  );
}

function renameFields(envelope: any): any {
  // A live machine snapshot keeps its `_`-prefixed in-memory fields.
  if (!isPlain(envelope) || typeof envelope.matches === 'function')
    return envelope;
  let copy: any;
  for (const [legacy, name] of Object.entries(fields)) {
    if (legacy in envelope && !(name in envelope)) {
      const { [legacy]: value, ...rest } = copy ?? envelope;
      copy = { ...rest, [name]: value };
    }
  }
  return copy ?? envelope;
}

/** Upgrades a persisted machine snapshot written by 6.0.0-beta.1. */
export function upgradeLegacyPersistedSnapshot<T>(snapshot: T): T {
  if (
    (snapshot as any)?.machine &&
    typeof (snapshot as any).matches === 'function'
  )
    return snapshot;
  if (!isLegacyEnvelope(snapshot)) return snapshot;
  return renameMarkers(renameFields(snapshot), ['$actor']);
}

/** Upgrades a `systemTransition` snapshot written by 6.0.0-beta.1. */
export function upgradeLegacySystemSnapshot<T>(snapshot: T): T {
  const actors: any[] = Object.values((snapshot as any)?.actors ?? {});
  if (!actors.some((actor) => isLegacyEnvelope(actor?.snapshot)))
    return snapshot;
  const upgraded = renameMarkers(snapshot, Object.keys(markers));
  if (!upgraded?.actors) return upgraded;
  let renamed: any;
  for (const [address, actor] of Object.entries<any>(upgraded.actors)) {
    const data = renameFields(actor?.snapshot);
    if (data !== actor?.snapshot)
      (renamed ??= { ...upgraded.actors })[address] = {
        ...actor,
        snapshot: data
      };
  }
  return renamed ? { ...upgraded, actors: renamed } : upgraded;
}
