import { ref, computed, watch, nextTick } from 'vue'
import type {
  ProposalType,
  ProposalStatus,
  StandardLineItem,
  MPLineItem,
  ClientContact,
  MPDestination,
  ProposalPayload,
} from '../types/proposal'

// ── Line item factories ────────────────────────────────────────────────────────

function newStandardItem(): StandardLineItem {
  return {
    id: Math.random().toString(36).slice(2),
    job_code: null,
    description: '',
    qty: null,
    rate: 0,
    amount: 0,
  }
}

function newMPItem(): MPLineItem {
  return {
    id: Math.random().toString(36).slice(2),
    job_code: 'Medical Physics Services',
    services: '',
    hourly_rate: null,
    hours_estimated: 0,
    estimated_fee: 0,
  }
}

// ── Computed-field formulas (spec §4.4 §4.6) ──────────────────────────────────

function computeAmount(qty: number | null, rate: number): number {
  if (qty === null || qty === undefined || (qty as unknown as string) === '') return rate
  return qty * rate
}

function computeEstimatedFee(hourlyRate: number | null, hours: number): number {
  if (hourlyRate === null || hourlyRate === undefined || (hourlyRate as unknown as string) === '') return hours
  return hourlyRate * hours
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useProposalForm() {
  // ── Core ─────────────────────────────────────────────────────────────────────
  const type = ref<ProposalType>('Standard')
  const typeLocked = ref<boolean>(false)  // becomes true after first save
  const status = ref<ProposalStatus>('Draft')
  const date = ref<string>(new Date().toISOString().slice(0, 10))
  const number = ref<string>('')

  // ── Standard fields ──────────────────────────────────────────────────────────
  const clientName = ref<string>('')
  const address = ref<string>('')
  const title = ref<string>('')
  const businessName = ref<string>('')
  const department = ref<string>('')
  const phone = ref<string>('')
  const email = ref<string>('')
  const projectNo = ref<string>('')
  const projectName = ref<string>('')
  const agreementNo = ref<string>('')
  const proposalValidTill = ref<string>('')

  // ── MP fields ────────────────────────────────────────────────────────────────
  const reference = ref<string>('')
  const projectLocation = ref<string>('')
  const projectType = ref<string>('')

  // ── Lookup state ─────────────────────────────────────────────────────────────
  // Holds the rows returned by /clients/lookup for the current Client Name
  const clientContactOptions = ref<ClientContact[]>([])
  // Stable index of the picked contact within clientContactOptions, or -1 if
  // none. Used by the Contact picker UI; survives address edits so we know
  // which row's data is currently in the form.
  const selectedContactIndex = ref<number>(-1)
  // City/state derived from the selected address (used to query tax rate)
  const lookupCity = ref<string>('')
  const lookupState = ref<string>('')

  // ── Tax ──────────────────────────────────────────────────────────────────────
  const taxable = ref<boolean>(true)   // default; MP gets flipped below
  const taxRate = ref<number>(0)
  const taxRateEdited = ref<boolean>(false)  // sticky-override flag (§4.7.3)

  // When type changes (before first save), apply default Taxable per spec §4.3
  watch(type, (t) => {
    if (typeLocked.value) return
    taxable.value = t === 'Standard'
    taxRateEdited.value = false
    if (!taxable.value) taxRate.value = 0
  })

  // ── Line items ───────────────────────────────────────────────────────────────
  const standardItems = ref<StandardLineItem[]>([newStandardItem()])
  const mpItems = ref<MPLineItem[]>([newMPItem()])

  // ── Rich text ────────────────────────────────────────────────────────────────
  const notes = ref<string>('')
  const servicesProvided = ref<string>('')  // MP only

  // ── Dirty tracking ────────────────────────────────────────────────────────────
  const isDirty = ref<boolean>(false)

  // ── Computed line items + totals ──────────────────────────────────────────────

  const computedStandardItems = computed<StandardLineItem[]>(() =>
    standardItems.value.map((item) => ({
      ...item,
      amount: computeAmount(item.qty, item.rate),
    })),
  )

  const computedMPItems = computed<MPLineItem[]>(() =>
    mpItems.value.map((item) => ({
      ...item,
      estimated_fee: computeEstimatedFee(item.hourly_rate, item.hours_estimated),
    })),
  )

  const subtotal = computed(() => {
    if (type.value === 'Standard') {
      return computedStandardItems.value.reduce((s, i) => s + i.amount, 0)
    }
    return computedMPItems.value.reduce((s, i) => s + i.estimated_fee, 0)
  })

  const salesTax = computed(() => taxable.value ? subtotal.value * taxRate.value : 0)
  const total = computed(() => subtotal.value + salesTax.value)

  // ── Line item actions ─────────────────────────────────────────────────────────

  function addStandardItem() { standardItems.value.push(newStandardItem()); isDirty.value = true }
  function removeStandardItem(id: string) {
    standardItems.value = standardItems.value.filter((i) => i.id !== id)
    isDirty.value = true
  }
  function addMPItem() { mpItems.value.push(newMPItem()); isDirty.value = true }
  function removeMPItem(id: string) {
    mpItems.value = mpItems.value.filter((i) => i.id !== id)
    isDirty.value = true
  }

  // ── Lookup handlers ──────────────────────────────────────────────────────────

  function applyContact(c: ClientContact) {
    // Only fill blank fields if the user has already overridden them?
    // Spec §4.7.1: "manual edit does NOT reset on subsequent lookups" — but here
    // we're handling the *first* time the user picks. Overwrite everything from
    // the contact record; subsequent lookups in the same session preserve overrides.
    // Prefer the joined full-address string ("Street, City, ST Zip") when the
    // contact provides one. Falls back to the bare street address for older
    // rows that pre-date the address_full field.
    address.value = c.address_full ?? c.address ?? ''
    title.value = c.title ?? ''
    businessName.value = c.business_name ?? ''
    department.value = c.department ?? ''
    phone.value = c.phone ?? ''
    email.value = c.email ?? ''
    lookupCity.value = c.city ?? ''
    lookupState.value = c.state ?? ''
  }

  function clearContactFields() {
    address.value = ''
    title.value = ''
    businessName.value = ''
    department.value = ''
    phone.value = ''
    email.value = ''
    lookupCity.value = ''
    lookupState.value = ''
  }

  function onClientContactsLoaded(rows: ClientContact[]) {
    clientContactOptions.value = rows
    selectedContactIndex.value = -1
    if (rows.length === 0) {
      clearContactFields()
    } else if (rows.length === 1) {
      selectedContactIndex.value = 0
      applyContact(rows[0])
    } else {
      // multiple rows — clear contact fields, await Contact selection
      clearContactFields()
    }
  }

  // Pick a contact by its index in clientContactOptions. Index is the stable
  // key (not address) because two contacts at the same client may share an
  // address but differ in person/department/facility.
  function onContactSelected(index: number) {
    selectedContactIndex.value = index
    const c = clientContactOptions.value[index]
    if (c) applyContact(c)
  }

  // Kept for backward compatibility with anything still calling the old API.
  // Matches by address; not used by the new Contact picker.
  function onAddressSelected(addr: string) {
    const idx = clientContactOptions.value.findIndex((c) => c.address === addr)
    if (idx >= 0) onContactSelected(idx)
  }

  /**
   * Pick a contact row directly (used by the unified Client Name picker that
   * lists one row per facility). This is the new canonical entry point now
   * that the picker no longer goes through person-name → facility steps.
   *
   * Setting `peerRows` lets the form remember all rows for the same person —
   * useful if downstream code still inspects `clientContactOptions`.
   */
  function onContactRowSelected(contact: ClientContact, peerRows?: ClientContact[]) {
    clientName.value = contact.name ?? ''
    const rows = peerRows && peerRows.length ? peerRows : [contact]
    clientContactOptions.value = rows
    const idx = rows.findIndex(
      (r) => r === contact || (r.address === contact.address && r.facility === contact.facility),
    )
    selectedContactIndex.value = idx >= 0 ? idx : 0
    applyContact(contact)
  }

  /**
   * Clear the contact selection entirely (when the user blanks the picker).
   */
  function clearContactSelection() {
    clientName.value = ''
    clientContactOptions.value = []
    selectedContactIndex.value = -1
    clearContactFields()
  }

  function onDestinationSelected(dest: MPDestination) {
    projectLocation.value = dest.final_destination
    address.value = dest.physical_address
    lookupCity.value = dest.city ?? ''
    lookupState.value = dest.state ?? ''
  }

  // Tax rate received from a tax-rate lookup query
  function onTaxRateLoaded(rate: number) {
    // Sticky-override: only auto-apply when user hasn't manually edited
    if (taxable.value && !taxRateEdited.value) {
      taxRate.value = rate
    }
  }

  function onTaxRateUserEdit(v: number) {
    taxRate.value = v
    taxRateEdited.value = true
  }

  function onTaxableToggle(v: boolean) {
    taxable.value = v
    taxRateEdited.value = false
    if (!v) taxRate.value = 0
    // When toggled on, the parent calls the lookup; onTaxRateLoaded handles it.
  }

  // ── Validation (spec §4.8) ────────────────────────────────────────────────────

  const errors = ref<Record<string, string>>({})

  // A row is "non-empty" if the user touched anything in it. Used to decide
  // whether to drop it silently vs. flag a missing description.
  function isStandardRowTouched(i: StandardLineItem): boolean {
    return !!(i.description.trim() || i.job_code || i.qty !== null || i.rate !== 0)
  }
  function isMPRowTouched(i: MPLineItem): boolean {
    return !!(i.services.trim() || i.hourly_rate !== null || i.hours_estimated !== 0)
  }

  function validate(): boolean {
    const e: Record<string, string> = {}

    if (!date.value) e.date = 'Date is required'
    if (!number.value.trim()) e.number = 'Proposal # is required'

    if (type.value === 'Standard') {
      if (!clientName.value.trim()) e.clientName = 'Client Name is required'
      if (!address.value.trim()) e.address = 'Address is required'
      const touched = standardItems.value.filter(isStandardRowTouched)
      if (!touched.length) {
        e.lineItems = 'Add at least one line item'
      } else if (touched.some((i) => !i.description.trim())) {
        e.lineItems = 'Every line item needs a description'
      }
      if (email.value && !isValidEmail(email.value)) e.email = 'Invalid email'
    } else {
      const touched = mpItems.value.filter(isMPRowTouched)
      if (!touched.length) {
        e.lineItems = 'Add at least one line item'
      } else if (touched.some((i) => !i.services.trim())) {
        e.lineItems = 'Every line item needs a services description'
      }
    }

    if (taxRate.value < 0) e.taxRate = 'Tax Rate must be ≥ 0'

    errors.value = e
    return Object.keys(e).length === 0
  }

  function isValidEmail(s: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
  }

  // ── Payload builder ───────────────────────────────────────────────────────────

  function buildPayload(): ProposalPayload {
    const base = {
      number: number.value,
      type: type.value,
      status: status.value,
      date: date.value,
      taxable: taxable.value,
      tax_rate: taxable.value ? taxRate.value : 0,
      notes: notes.value || undefined,
    }

    if (type.value === 'Standard') {
      // Drop only fully-empty rows. Validation ensures touched rows have a description.
      const items = standardItems.value
        .filter(isStandardRowTouched)
        .map(({ id: _id, amount: _a, ...rest }) => rest)
      return {
        ...base,
        client_name: clientName.value || undefined,
        address: address.value || undefined,
        title: title.value || undefined,
        business_name: businessName.value || undefined,
        department: department.value || undefined,
        phone: phone.value || undefined,
        email: email.value || undefined,
        project_no: projectNo.value || undefined,
        project_name: projectName.value || undefined,
        agreement_no: agreementNo.value || undefined,
        proposal_valid_till: proposalValidTill.value || undefined,
        line_items: items,
      }
    }

    const items = mpItems.value
      .filter(isMPRowTouched)
      .map(({ id: _id, estimated_fee: _e, ...rest }) => rest)
    return {
      ...base,
      reference: reference.value || undefined,
      project_location: projectLocation.value || undefined,
      address: address.value || undefined,
      project_type: projectType.value || undefined,
      project_name: projectName.value || undefined,
      services_provided: servicesProvided.value || undefined,
      line_items: items,
    }
  }

  // ── Load existing proposal into the form ─────────────────────────────────────

  function loadProposal(p: {
    number: string
    type: ProposalType
    status: ProposalStatus
    date: string
    client_name?: string
    address?: string
    title?: string
    business_name?: string
    department?: string
    phone?: string
    email?: string
    project_no?: string
    project_name?: string
    agreement_no?: string
    proposal_valid_till?: string
    reference?: string
    project_location?: string
    project_type?: string
    taxable: boolean
    tax_rate: number
    line_items: StandardLineItem[] | MPLineItem[]
    notes?: string
    services_provided?: string
  }) {
    type.value = p.type
    typeLocked.value = true
    status.value = p.status
    date.value = p.date
    number.value = p.number
    taxable.value = p.taxable
    taxRate.value = p.tax_rate
    taxRateEdited.value = false
    notes.value = p.notes ?? ''
    servicesProvided.value = p.services_provided ?? ''

    if (p.type === 'Standard') {
      clientName.value = p.client_name ?? ''
      address.value = p.address ?? ''
      title.value = p.title ?? ''
      businessName.value = p.business_name ?? ''
      department.value = p.department ?? ''
      phone.value = p.phone ?? ''
      email.value = p.email ?? ''
      projectNo.value = p.project_no ?? ''
      projectName.value = p.project_name ?? ''
      agreementNo.value = p.agreement_no ?? ''
      proposalValidTill.value = p.proposal_valid_till ?? ''
      standardItems.value = (p.line_items as StandardLineItem[]).map((i) => ({ ...i }))
      if (!standardItems.value.length) standardItems.value = [newStandardItem()]
    } else {
      reference.value = p.reference ?? ''
      projectLocation.value = p.project_location ?? ''
      address.value = p.address ?? ''
      projectType.value = p.project_type ?? ''
      projectName.value = p.project_name ?? ''
      mpItems.value = (p.line_items as MPLineItem[]).map((i) => ({ ...i }))
      if (!mpItems.value.length) mpItems.value = [newMPItem()]
    }

    // Reset dirty after load — wait for pending reactive effects to settle
    void nextTick(() => { isDirty.value = false })
  }

  // Mark dirty on any data change. Skip changes that originate from
  // programmatic resets (loadProposal, auto-filled proposal number, etc.) by
  // letting callers set isDirty=false in nextTick — those resets fire the watcher
  // synchronously, but the nextTick clears the flag before the user sees it.
  function markFromNumberAutofill() {
    void nextTick(() => { isDirty.value = false })
  }

  watch(
    [type, status, date, number,
      clientName, address, title, businessName, department, phone, email,
      projectNo, projectName, agreementNo, proposalValidTill,
      reference, projectLocation, projectType,
      taxable, taxRate,
      notes, servicesProvided,
      standardItems, mpItems],
    () => { isDirty.value = true },
    { deep: true },
  )

  return {
    // Core
    type, typeLocked, status, date, number,
    // Standard
    clientName, address, title, businessName, department, phone, email,
    projectNo, projectName, agreementNo, proposalValidTill,
    // MP
    reference, projectLocation, projectType,
    // Lookup
    clientContactOptions, selectedContactIndex, lookupCity, lookupState,
    // Tax
    taxable, taxRate, taxRateEdited,
    // Line items
    standardItems, mpItems,
    computedStandardItems, computedMPItems,
    // Totals
    subtotal, salesTax, total,
    // Rich text
    notes, servicesProvided,
    // State
    isDirty, errors,
    // Actions
    addStandardItem, removeStandardItem,
    addMPItem, removeMPItem,
    onClientContactsLoaded, onContactSelected, onAddressSelected,
    onContactRowSelected, clearContactSelection,
    onDestinationSelected,
    onTaxRateLoaded, onTaxRateUserEdit, onTaxableToggle,
    validate, buildPayload, loadProposal,
    markFromNumberAutofill,
  }
}
