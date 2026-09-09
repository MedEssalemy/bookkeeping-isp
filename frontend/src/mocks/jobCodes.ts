import type { JobCode } from '../types/proposal'
import { JOB_CODE_SEED } from './configLists'

/**
 * Job codes now live in the admin-configurable config-list store (spec §3.4).
 * This re-export keeps a single source of truth for any non-component code that
 * still wants the raw label list. Components must use `useConfigList('job_codes')`
 * instead of importing this array.
 */
export const JOB_CODES: JobCode[] = JOB_CODE_SEED
