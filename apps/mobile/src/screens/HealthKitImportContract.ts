/**
 * §14 THE CONTRACT — preview/commit/undo shapes for the Apple Health import.
 *
 * The canonical §14 types live in models/ImportTypes.ts (backend-owned); this
 * file re-exports them so the screens keep a single import site, and holds the
 * thin `HealthKitImportBackend` seam the screens render against. The REAL
 * produce/commit/undo functions live on the useLedger hook, so the seam is
 * constructed INSIDE HealthKitPreviewScreen (a useMemo over the hook's
 * functions) rather than exported as a singleton from here.
 *
 * Screens in this folder consume ONLY the fields named in the §14 types and
 * mutate ONLY `collision.resolution`.
 */
import { Platform } from 'react-native';
import type { HealthKitSource } from '../services/HealthKitSource';
import type { ImportPreview, CommitResult, UndoResult } from '../models/ImportTypes';

export type {
    CollisionResolution,
    ImportPreviewRow,
    ImportPreview,
    CommitResult,
    UndoResult,
} from '../models/ImportTypes';

/**
 * The thin seam the screens are built against. The screens never import the
 * HealthKit library or touch services directly — they call these callbacks
 * and render whatever comes back.
 *
 * NOTE: the real `commitPreview` on useLedger is a single atomic call with no
 * progress source, so `commit` takes no onProgress callback — the commit UI
 * renders an indeterminate state (never fake counts).
 */
export interface HealthKitImportBackend {
    /** Whether HealthKit exists on this device (drives the entry-point card). */
    isAvailable: () => Promise<boolean>;
    /**
     * Builds the preview from Apple Health — decrypts the ledger once for the
     * collision index, so it can take a moment; the screen shows a spinner the
     * whole time. Throws when HealthKit is unavailable on this device.
     */
    producePreview: () => Promise<ImportPreview>;
    /**
     * Inscribes every non-collision row plus every collision row whose
     * resolution is 'import-anyway'. Atomic; no per-row progress exists.
     */
    commit: (preview: ImportPreview) => Promise<CommitResult>;
    /** Purges exactly the ids a commit created. Rethrows on failure. */
    undo: (inscribedIds: string[]) => Promise<UndoResult>;
}

/**
 * INSTANCE SHARING — module-level lazy singleton.
 *
 * The priming screen fires the OS permission sheet and the preview screen runs
 * the query, and both MUST use the same HealthKitSource instance (per the
 * backend contract). React Navigation params must be serializable, so the
 * class instance cannot ride through route params; a module-level singleton is
 * the simplest correct mechanism (HealthKitSource carries no per-screen state
 * — just the wrapped native client). Lazily constructed via require() so the
 * native HealthKit library stays out of the app boot graph (same pattern the
 * backend uses in useLedger), and never constructed at all off-iOS.
 */
let sharedSource: HealthKitSource | null = null;

export function getSharedHealthKitSource(): HealthKitSource {
    if (!sharedSource) {
        // Lazy require: keeps @kingstinct/react-native-healthkit out of module
        // init (documented device trap forbids dynamic import(); require is fine).
        const { HealthKitSource: Source } = require('../services/HealthKitSource');
        sharedSource = new Source() as HealthKitSource;
    }
    return sharedSource;
}

/**
 * Availability probe for the Import screen's entry card. Async so callers can
 * treat it uniformly; gates on Platform first so the native module is never
 * required on Android, and fails closed (false) if the native check throws.
 */
export async function isHealthKitAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    try {
        return getSharedHealthKitSource().isAvailable();
    } catch (e) {
        console.warn('[HealthKitImportContract] availability check failed', e);
        return false;
    }
}
