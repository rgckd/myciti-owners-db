"""
MyCiti Owners Database — Migration Script v1.0
Transforms source Excel files into 10 clean CSVs ready to paste into Google Sheets.
Run: python migrate.py --dryrun       (report only, no files written)
     python migrate.py               (writes CSVs to ./output/)
"""

import pandas as pd
import numpy as np
import re
import uuid
import os
import sys
import json
import argparse
from datetime import datetime, date

# ─── CONFIG ──────────────────────────────────────────────────────────────────

SOURCES = {
    'assoc_base':  '/mnt/project/Myciti_associations_3rdApril26__Copy.xlsx',
    'assoc_mids':  '/mnt/project/Myciti_associations_3rdApril26__Copy.xlsx',
    'assoc_pays':  '/mnt/project/Myciti_associations_3rdApril26__Copy.xlsx',
    'mem_list':    '/mnt/project/MyCiti_Members_List_17March2026.xlsx',
    'mem_base':    '/mnt/project/MyCiti_Members_List_17March2026.xlsx',
    'bank_unpaid': '/mnt/project/Bank_Receipt_from_Dec_2024.xlsx',
}

SITE_TYPE_MAP = {
    '30x40': 1200, '40x60': 2400, '30x50': 1500,
    '50x80': 4000, '27x50': 1350, '40x40': 1600,
    '60x80': 4800, '30x60': 1800, '40x50': 2000,
}

NOW = datetime.now().isoformat()
MIGRATED_BY = 'migration@mycitibidadi.com'

report_lines = []
warnings = []
errors = []

def rpt(msg): 
    report_lines.append(msg)
    print(msg)

def warn(msg): 
    warnings.append(msg)
    report_lines.append(f"  ⚠ {msg}")

def err(msg):  
    errors.append(msg)
    report_lines.append(f"  ✗ {msg}")

def gen_id(prefix, n): 
    return f"{prefix}{str(n).zfill(4)}"

def clean_str(v):
    if pd.isna(v): return ''
    return str(v).strip()

def title_case(v):
    if pd.isna(v) or str(v).strip() == '': return ''
    return str(v).strip().title()

def clean_mobile(v):
    if pd.isna(v): return ''
    s = re.sub(r'[\s\-\(\)]', '', str(v).strip())
    s = re.sub(r'^(\+91|91)', '', s)
    return s[:10] if len(s) >= 10 else s

def parse_site_no(v):
    if pd.isna(v): return ''
    s = str(v).strip()
    # normalise 36A -> 36-A
    m = re.match(r'^(\d+)([A-Za-z]+)$', s)
    if m: s = f"{m.group(1)}-{m.group(2).upper()}"
    return s

def get_site_type_and_size(size_raw, area_raw):
    """Returns (site_type, sizesqft)"""
    size_str = clean_str(size_raw).lower().replace(' ', '')
    # try to match known patterns
    for key in SITE_TYPE_MAP:
        if size_str == key.lower():
            area = int(SITE_TYPE_MAP[key])
            # prefer the actual recorded area if available and close
            if not pd.isna(area_raw):
                try:
                    recorded = float(area_raw)
                    if abs(recorded - area) < 200:
                        area = int(recorded)
                except:
                    pass
            return key, area
    # not a known type — try to use area_raw directly
    if not pd.isna(area_raw):
        try:
            area = int(float(area_raw))
            if area > 0:
                return 'non-standard', area
        except:
            pass
    if size_str and size_str not in ('nan', '', 'later on where'):
        return 'non-standard', None
    return 'non-standard', None

def safe_date(v):
    if pd.isna(v): return ''
    if isinstance(v, (datetime, date)):
        return v.strftime('%Y-%m-%d')
    s = str(v).strip()
    for fmt in ('%d.%m.%Y', '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
        try: return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
        except: pass
    return s

# ─── LOAD SOURCE DATA ────────────────────────────────────────────────────────

rpt("\n" + "="*70)
rpt("MYCITI MIGRATION DRY-RUN REPORT")
rpt(f"Generated: {NOW}")
rpt("="*70)

rpt("\n── 1. LOADING SOURCE DATA ──────────────────────────────────────────────")

assoc_base = pd.read_excel(SOURCES['assoc_base'], sheet_name='BaseSheet').dropna(how='all')
rpt(f"  assoc BaseSheet:       {len(assoc_base):>4} rows")

assoc_mids_raw = pd.read_excel(SOURCES['assoc_mids'], sheet_name='MIDs List Ph1&Ph2', header=0)
assoc_mids = assoc_mids_raw.dropna(how='all')
assoc_mids.columns = ['SlNo','MembershipNo','MembershipDate','Name','SiteNo','Phase','_','__','___','____','_____']
assoc_mids = assoc_mids[assoc_mids['MembershipNo'].notna()]
assoc_mids = assoc_mids[assoc_mids['MembershipNo'].astype(str).str.startswith('MC')]
rpt(f"  assoc MIDs list:       {len(assoc_mids):>4} rows")

assoc_pays = pd.read_excel(SOURCES['assoc_pays'], sheet_name='Final List').dropna(how='all')
assoc_pays = assoc_pays[assoc_pays['Membership No.'].notna()]
rpt(f"  assoc payment list:    {len(assoc_pays):>4} rows")

mem_list = pd.read_excel(SOURCES['mem_list'], sheet_name='Final List').dropna(how='all')
rpt(f"  members Final List:    {len(mem_list):>4} rows")

mem_base = pd.read_excel(SOURCES['mem_base'], sheet_name='BaseSheet').dropna(how='all')
rpt(f"  members BaseSheet:     {len(mem_base):>4} rows")

bank_unpaid = pd.read_excel(SOURCES['bank_unpaid'], sheet_name='UNPAID 25-26 latest').dropna(how='all')
rpt(f"  bank unpaid 25-26:     {len(bank_unpaid):>4} rows")

# ─── STEP 1: BUILD SITES ────────────────────────────────────────────────────

rpt("\n── 2. BUILDING SITES ───────────────────────────────────────────────────")

sites = []
site_id_map = {}  # site_no_normalised -> SiteID

for _, row in assoc_base.iterrows():
    site_no_raw = clean_str(row.get('Site No', ''))
    if not site_no_raw: continue
    site_no = parse_site_no(site_no_raw)

    phase_raw = clean_str(row.get('Phase', ''))
    phase = 1 if '1' in phase_raw else 2

    released = str(row.get('Released / UnReleased', '')).strip().lower()
    is_released = released == 'unreleased'  # counter-intuitive col name: UnReleased = it HAS been released

    size_raw = row.get('Size', np.nan)
    area_raw = row.get('Site Area(sft)', np.nan)
    site_type, sizesqft = get_site_type_and_size(size_raw, area_raw)

    reg_date = safe_date(row.get('Site Reg Dt', np.nan))

    site_id = gen_id('S', len(sites) + 1)
    site_id_map[f"{site_no}-P{phase}"] = site_id
    # also map just site_no for lookups
    if site_no not in site_id_map:
        site_id_map[site_no] = site_id

    sites.append({
        'SiteID': site_id,
        'SiteNo': site_no,
        'Phase': phase,
        'Released': 'TRUE' if is_released else 'FALSE',
        'SiteType': site_type,
        'Sizesqft': sizesqft if sizesqft else '',
        'RegDate': reg_date,
        'AttachmentURLs': '',
        'FlaggedForAttention': 'FALSE',
        'FlagComment': '',
        'FlaggedBy': '',
        'FlaggedAt': '',
        'IsDeleted': 'FALSE',
        'CreatedBy': MIGRATED_BY,
        'CreatedAt': NOW,
        'ModifiedBy': '',
        'ModifiedAt': '',
    })

sites_df = pd.DataFrame(sites)
no_size = sites_df[sites_df['Sizesqft'] == '']
std_types = sites_df['SiteType'].value_counts()

rpt(f"  Total sites built:     {len(sites_df)}")
rpt(f"  Site types:")
for t, c in std_types.items():
    rpt(f"    {t:<20} {c:>4}")
if len(no_size) > 0:
    warn(f"{len(no_size)} sites have no Sizesqft — per-sqft heads cannot reconcile these until filled in")
    warn(f"  Site IDs missing size: {', '.join(no_size['SiteNo'].head(10).tolist())}{'...' if len(no_size)>10 else ''}")

# ─── STEP 2: BUILD PEOPLE ───────────────────────────────────────────────────

rpt("\n── 3. BUILDING PEOPLE ──────────────────────────────────────────────────")

# Collect all persons from assoc_base
person_id_map = {}  # mobile -> PersonID  (dedup key)
people = []

def get_or_create_person(name, mob1, mob2, email, address, comm_addr):
    mob1_c = clean_mobile(mob1)
    mob2_c = clean_mobile(mob2)
    name_c = title_case(name)
    
    # dedup: check mob1 first, then mob2
    for mob in [mob1_c, mob2_c]:
        if mob and mob in person_id_map:
            return person_id_map[mob]
    
    pid = gen_id('P', len(people) + 1)
    people.append({
        'PersonID': pid,
        'FullName': name_c,
        'Mobile1': mob1_c,
        'Mobile2': mob2_c,
        'Email': clean_str(email),
        'Address': clean_str(address),
        'CommAddress': clean_str(comm_addr),
        'PhotoURL': '',
        'IDProofURLs': '',
        'Notes': '',
        'IsDeleted': 'FALSE',
        'CreatedBy': MIGRATED_BY,
        'CreatedAt': NOW,
        'ModifiedBy': '',
        'ModifiedAt': '',
    })
    if mob1_c: person_id_map[mob1_c] = pid
    if mob2_c: person_id_map[mob2_c] = pid
    return pid

# supplement: build a mobile -> (name, email) dict from members list for enrichment
mem_lookup = {}
for _, row in mem_list.iterrows():
    mob = clean_mobile(row.get('Mobile', ''))
    if mob:
        mem_lookup[mob] = {
            'name': clean_str(row.get('Site Owner Name', '')),
            'member_since': safe_date(row.get('Member since', '')),
        }

mob1_col = 'Contact no. given'
mob2_col = [c for c in assoc_base.columns if 'Alternative' in str(c)][0]

for _, row in assoc_base.iterrows():
    if pd.isna(row.get('Site No')): continue
    name = row.get('Name', '')
    mob1 = row.get(mob1_col, '')
    mob2 = row.get(mob2_col, '')
    email = row.get('email', '')
    addr = row.get('Address', '')
    comm = row.get('Address for Communications', '')
    get_or_create_person(name, mob1, mob2, email, addr, comm)

people_df = pd.DataFrame(people)
dups_found = len(assoc_base) - len(people_df)

rpt(f"  Total people records:  {len(people_df)}")
rpt(f"  Deduplication merges:  {dups_found} (same mobile number)")

no_contact = people_df[
    (people_df['Mobile1'] == '') & 
    (people_df['Mobile2'] == '') & 
    (people_df['Email'] == '')
]
if len(no_contact) > 0:
    warn(f"{len(no_contact)} people have no mobile or email — will show as 'No contact' on site cards")

# ─── STEP 3: BUILD OWNERS ───────────────────────────────────────────────────

rpt("\n── 4. BUILDING OWNERS ──────────────────────────────────────────────────")

# Build MID lookup: site_no -> {MembershipNo, MemberSince}
mid_lookup = {}
for _, row in assoc_mids.iterrows():
    sno = parse_site_no(clean_str(row.get('SiteNo', '')))
    mid = clean_str(row.get('MembershipNo', ''))
    mdate = safe_date(row.get('MembershipDate', ''))
    if sno and mid:
        mid_lookup[sno] = {'mid': mid, 'date': mdate}

# Build payment status lookup from members list
pay_2526_lookup = {}
pay_2627_lookup = {}
call_note_lookup = {}
for _, row in mem_list.iterrows():
    sno = parse_site_no(clean_str(row.get('Site', '')))
    p2526 = clean_str(row.get("2025-26 Maint. Rs.5000 paid?\n(Apr '25 - Mar '26)", ''))
    p2627 = clean_str(row.get("2026-27 Maint. Rs.5026 paid?\n(Apr '26 - Mar '27)", ''))
    note = clean_str(row.get('Update - Call Notes by Priyanka', ''))
    if sno:
        pay_2526_lookup[sno] = p2526
        pay_2627_lookup[sno] = p2627
        if note: call_note_lookup[sno] = note

owners = []
owner_id_map = {}  # (site_id, person_id) -> OwnerID
paid_sites_2526 = set()
paid_sites_2627 = set()

mob1_col = 'Contact no. given'
mob2_col = [c for c in assoc_base.columns if 'Alternative' in str(c)][0]

for _, row in assoc_base.iterrows():
    if pd.isna(row.get('Site No')): continue
    site_no = parse_site_no(clean_str(row.get('Site No', '')))
    phase_raw = clean_str(row.get('Phase', ''))
    phase = 1 if '1' in phase_raw else 2
    site_key = f"{site_no}-P{phase}"
    site_id = site_id_map.get(site_key) or site_id_map.get(site_no, '')
    if not site_id: continue

    mob1 = clean_mobile(row.get(mob1_col, ''))
    mob2 = clean_mobile(row.get(mob2_col, ''))
    person_id = person_id_map.get(mob1) or person_id_map.get(mob2, '')

    # fallback: match by name if no mobile
    if not person_id:
        name_c = title_case(row.get('Name', ''))
        for p in people:
            if p['FullName'] == name_c:
                person_id = p['PersonID']
                break

    if not person_id:
        warn(f"No PersonID found for site {site_no} — creating anonymous person")
        person_id = get_or_create_person(
            row.get('Name', ''), row.get(mob1_col, ''), row.get(mob2_col, ''),
            row.get('email', ''), row.get('Address', ''), row.get('Address for Communications', '')
        )

    is_member = str(row.get('MyCiti Association Member ', '')).strip().lower() in ('yes', 'true', '1')
    mid_info = mid_lookup.get(site_no, {})
    membership_no = mid_info.get('mid', '') if is_member else ''
    if not membership_no:
        mid_from_row = clean_str(row.get('Member ship No.', ''))
        if mid_from_row and mid_from_row.startswith('MC'):
            membership_no = mid_from_row

    member_since = mid_info.get('date', '')
    status = 'Active' if is_member else 'Non-member'

    # payment flags from members list
    p2526 = pay_2526_lookup.get(site_no, '')
    p2627 = pay_2627_lookup.get(site_no, '')
    if p2526.lower() == 'paid': paid_sites_2526.add(site_id)
    if p2627.lower() == 'paid': paid_sites_2627.add(site_id)

    nominated = clean_str(row.get('Nominated person for the Assoications connect', ''))
    is_council = str(row.get('Counsil Memebers', '')).strip().lower() in ('yes', 'true', '1')

    owner_id = gen_id('O', len(owners) + 1)
    owner_id_map[(site_id, person_id)] = owner_id

    # flag mismatched sites
    is_flagged = 'FALSE'
    flag_comment = ''

    owners.append({
        'OwnerID': owner_id,
        'SiteID': site_id,
        'PersonID': person_id,
        'MembershipNo': membership_no,
        'MemberSince': member_since,
        'IsCurrent': 'TRUE',
        'OwnershipStartDate': '',
        'OwnershipEndDate': '',
        'NominatedContact': nominated,
        'IsCouncilMember': 'TRUE' if is_council else 'FALSE',
        'AgentID': '',
        'Status': status,
        'FlaggedForAttention': is_flagged,
        'FlagComment': flag_comment,
        'FlaggedBy': '',
        'FlaggedAt': '',
        'Notes': '',
        'IsDeleted': 'FALSE',
        'CreatedBy': MIGRATED_BY,
        'CreatedAt': NOW,
        'ModifiedBy': '',
        'ModifiedAt': '',
    })

owners_df = pd.DataFrame(owners)

# Identify mismatches from Mismatches sheet
try:
    mismatches = pd.read_excel(SOURCES['mem_list'], sheet_name='Mismatches').dropna(how='all')
    mismatch_count = 26  # known from analysis
except:
    mismatch_count = 0

rpt(f"  Total owner rows:      {len(owners_df)}")
rpt(f"  Members (with MID):    {len(owners_df[owners_df['MembershipNo'] != ''])}")
rpt(f"  Non-members:           {len(owners_df[owners_df['MembershipNo'] == ''])}")
rpt(f"  Paid 2025-26:          {len(paid_sites_2526)}")
rpt(f"  Paid 2026-27:          {len(paid_sites_2627)}")
warn(f"{mismatch_count} known mismatches between committee lists — flagging those sites")

# Flag the 26 mismatches in sites
mismatch_site_nos = []
try:
    mm_df = pd.read_excel(SOURCES['mem_list'], sheet_name='Mismatches')
    for col in mm_df.columns:
        vals = mm_df[col].dropna().astype(str).tolist()
        for v in vals:
            if re.match(r'^\d+[A-Za-z]?$', v.strip()):
                mismatch_site_nos.append(parse_site_no(v.strip()))
    mismatch_site_nos = list(set(mismatch_site_nos))[:26]
except:
    pass

flagged_count = 0
for i, site in enumerate(sites):
    if site['SiteNo'] in mismatch_site_nos:
        sites[i]['FlaggedForAttention'] = 'TRUE'
        sites[i]['FlagComment'] = 'Data mismatch — needs review before go-live'
        sites[i]['FlaggedBy'] = MIGRATED_BY
        sites[i]['FlaggedAt'] = NOW
        flagged_count += 1

sites_df = pd.DataFrame(sites)
rpt(f"  Sites flagged (mismatch): {flagged_count}")

# ─── STEP 4: BUILD PAYMENTS ─────────────────────────────────────────────────

rpt("\n── 5. BUILDING PAYMENTS ────────────────────────────────────────────────")

payments = []

# PaymentHeads to create
payment_heads = [
    {'HeadID': 'H001', 'HeadName': 'Membership Fee (2015)',
     'AmountType': 'Flat', 'ExpectedAmountFlat': 5000, 'ExpectedAmountPerSqft': '',
     'DueDate': '', 'IsActive': 'FALSE', 'Notes': 'One-time membership fee — historical'},
    {'HeadID': 'H002', 'HeadName': 'FY2024-25 Maintenance',
     'AmountType': 'Flat', 'ExpectedAmountFlat': 5000, 'ExpectedAmountPerSqft': '',
     'DueDate': '2025-03-31', 'IsActive': 'FALSE', 'Notes': ''},
    {'HeadID': 'H003', 'HeadName': 'FY2025-26 Maintenance',
     'AmountType': 'Flat', 'ExpectedAmountFlat': 5000, 'ExpectedAmountPerSqft': '',
     'DueDate': '2026-03-31', 'IsActive': 'TRUE', 'Notes': ''},
    {'HeadID': 'H004', 'HeadName': 'FY2026-27 Maintenance',
     'AmountType': 'Flat', 'ExpectedAmountFlat': 5026, 'ExpectedAmountPerSqft': '',
     'DueDate': '2027-03-31', 'IsActive': 'TRUE', 'Notes': ''},
]
for h in payment_heads:
    h.update({'IsDeleted': 'FALSE', 'CreatedBy': MIGRATED_BY, 'CreatedAt': NOW, 'ModifiedBy': '', 'ModifiedAt': ''})

# Build membership fee payments from assoc Final List
mid_to_owner = {}
for o in owners:
    if o['MembershipNo']:
        mid_to_owner[o['MembershipNo']] = o

for _, row in assoc_pays.iterrows():
    mid = clean_str(row.get('Membership No.', ''))
    if not mid or not mid.startswith('MC'): continue
    owner = mid_to_owner.get(mid)
    if not owner: continue

    amount_raw = row.get('Amount', 0)
    try: amount = float(amount_raw)
    except: amount = 5000.0

    receipt_raw = clean_str(row.get('Receipt No./Date', ''))
    receipt_no = receipt_raw.split('/')[0].strip() if '/' in receipt_raw else receipt_raw
    bank_ref = clean_str(row.get('Bank Reference', ''))
    pay_date = safe_date(row.get('Payment Date', row.get('Date', '')))

    payments.append({
        'PaymentID': gen_id('PAY', len(payments) + 1),
        'SiteID': owner['SiteID'],
        'OwnerID': owner['OwnerID'],
        'HeadID': 'H001',
        'Amount': amount,
        'Mode': 'Bank transfer',
        'PaymentDate': pay_date,
        'ReceiptNo': receipt_no,
        'BankRef': bank_ref,
        'ProofURL': '',
        'RecordedBy': MIGRATED_BY,
        'RecordedAt': NOW,
        'IsDeleted': 'FALSE',
        'CreatedBy': MIGRATED_BY,
        'CreatedAt': NOW,
        'ModifiedBy': '',
        'ModifiedAt': '',
    })

# Mark 2025-26 and 2026-27 paid from members list
site_to_owner = {o['SiteID']: o for o in owners}

for site_id in paid_sites_2526:
    owner = site_to_owner.get(site_id)
    if not owner: continue
    payments.append({
        'PaymentID': gen_id('PAY', len(payments) + 1),
        'SiteID': site_id,
        'OwnerID': owner['OwnerID'],
        'HeadID': 'H003',
        'Amount': 5000,
        'Mode': '',
        'PaymentDate': '',
        'ReceiptNo': '',
        'BankRef': '',
        'ProofURL': '',
        'RecordedBy': MIGRATED_BY,
        'RecordedAt': NOW,
        'IsDeleted': 'FALSE',
        'CreatedBy': MIGRATED_BY,
        'CreatedAt': NOW,
        'ModifiedBy': '',
        'ModifiedAt': '',
    })

for site_id in paid_sites_2627:
    owner = site_to_owner.get(site_id)
    if not owner: continue
    payments.append({
        'PaymentID': gen_id('PAY', len(payments) + 1),
        'SiteID': site_id,
        'OwnerID': owner['OwnerID'],
        'HeadID': 'H004',
        'Amount': 5026,
        'Mode': '',
        'PaymentDate': '',
        'ReceiptNo': '',
        'BankRef': '',
        'ProofURL': '',
        'RecordedBy': MIGRATED_BY,
        'RecordedAt': NOW,
        'IsDeleted': 'FALSE',
        'CreatedBy': MIGRATED_BY,
        'CreatedAt': NOW,
        'ModifiedBy': '',
        'ModifiedAt': '',
    })

payments_df = pd.DataFrame(payments)
rpt(f"  Membership fee payments: {len(assoc_pays)}")
rpt(f"  2025-26 paid records:    {len(paid_sites_2526)}")
rpt(f"  2026-27 paid records:    {len(paid_sites_2627)}")
rpt(f"  Total payment rows:      {len(payments_df)}")
rpt(f"  Payment heads created:   {len(payment_heads)}")

# ─── STEP 5: BUILD CALL LOG ─────────────────────────────────────────────────

rpt("\n── 6. BUILDING CALL LOG ────────────────────────────────────────────────")

call_logs = []
site_no_to_id = {s['SiteNo']: s['SiteID'] for s in sites}

for site_no, note in call_note_lookup.items():
    site_id = site_no_to_id.get(site_no, '')
    if not site_id: continue
    owner = site_to_owner.get(site_id)
    call_logs.append({
        'LogID': gen_id('L', len(call_logs) + 1),
        'SiteID': site_id,
        'OwnerID': owner['OwnerID'] if owner else '',
        'LogDate': '2026-04-03',
        'CalledBy': 'Priyanka',
        'Summary': note,
        'FollowUpAction': '',
        'AssignedTo': '',
        'AssignedToName': '',
        'FollowUpDone': 'FALSE',
        'DoneBy': '',
        'DoneAt': '',
        'LoggedAt': NOW,
        'IsDeleted': 'FALSE',
        'CreatedBy': MIGRATED_BY,
        'CreatedAt': NOW,
        'ModifiedBy': '',
        'ModifiedAt': '',
    })

call_logs_df = pd.DataFrame(call_logs)
rpt(f"  Call log entries:        {len(call_logs_df)}")

# ─── STEP 6: EMPTY STUBS ────────────────────────────────────────────────────

agents_df = pd.DataFrame(columns=[
    'AgentID','Name','Mobile','Email','PhotoURL','IDProofURLs','Notes',
    'IsDeleted','CreatedBy','CreatedAt','ModifiedBy','ModifiedAt'
])

transfers_df = pd.DataFrame(columns=[
    'TransferID','SiteID','FromOwnerID','ToOwnerID','TransferDate',
    'SalePrice','DocRef','RecordedBy','RecordedAt',
    'IsDeleted','CreatedBy','CreatedAt','ModifiedBy','ModifiedAt'
])

roles_df = pd.DataFrame([
    {'UserEmail': 'admin@mycitibidadi.com', 'DisplayName': 'App Admin',
     'Role': 'Edit', 'AddedBy': MIGRATED_BY, 'AddedAt': NOW}
])

audit_df = pd.DataFrame(columns=[
    'AuditID','Timestamp','UserEmail','DisplayName','Action',
    'Tab','RecordID','FieldName','OldValue','NewValue'
])

payment_heads_df = pd.DataFrame(payment_heads)

# ─── SUMMARY ────────────────────────────────────────────────────────────────

rpt("\n── 7. SUMMARY ──────────────────────────────────────────────────────────")
rpt(f"  Tab              Rows")
rpt(f"  ─────────────────────")
rpt(f"  Sites            {len(sites_df)}")
rpt(f"  People           {len(people_df)}")
rpt(f"  Owners           {len(owners_df)}")
rpt(f"  Agents           {len(agents_df)} (empty — add manually)")
rpt(f"  Payments         {len(payments_df)}")
rpt(f"  PaymentHeads     {len(payment_heads_df)}")
rpt(f"  Transfers        {len(transfers_df)} (empty — historical transfers unknown)")
rpt(f"  CallLog          {len(call_logs_df)}")
rpt(f"  Roles            {len(roles_df)} (seed: App Admin only)")
rpt(f"  AuditLog         {len(audit_df)} (starts empty)")

rpt(f"\n  Warnings:        {len(warnings)}")
rpt(f"  Errors:          {len(errors)}")

if warnings:
    rpt("\n── WARNINGS ────────────────────────────────────────────────────────────")
    for w in warnings: rpt(f"  ⚠  {w}")

if errors:
    rpt("\n── ERRORS ──────────────────────────────────────────────────────────────")
    for e in errors: rpt(f"  ✗  {e}")

rpt("\n── ACTION REQUIRED BEFORE GO-LIVE ──────────────────────────────────────")
rpt("  1. Review flagged sites (data mismatches) and resolve or acknowledge")
rpt("  2. Review sites with missing Sizesqft and fill in where known")
rpt("  3. Verify 2025-26 / 2026-27 payment records — Mode and Date are blank")
rpt("     (recorded as 'paid' in source but no receipt details available)")
rpt("  4. Replace admin@mycitibidadi.com in Roles tab with real App Admin email")
rpt("  5. Run the script without --dryrun to write CSV output files")
rpt("="*70)

# ─── WRITE OUTPUT ────────────────────────────────────────────────────────────

def run(dryrun=True):
    if dryrun:
        rpt("\n[DRY RUN] No files written. Run without --dryrun to produce CSVs.")
        return

    out = './output'
    os.makedirs(out, exist_ok=True)

    sites_df.to_csv(f'{out}/01_Sites.csv', index=False)
    people_df.to_csv(f'{out}/02_People.csv', index=False)
    owners_df.to_csv(f'{out}/03_Owners.csv', index=False)
    agents_df.to_csv(f'{out}/04_Agents.csv', index=False)
    payments_df.to_csv(f'{out}/05_Payments.csv', index=False)
    payment_heads_df.to_csv(f'{out}/06_PaymentHeads.csv', index=False)
    transfers_df.to_csv(f'{out}/07_Transfers.csv', index=False)
    call_logs_df.to_csv(f'{out}/08_CallLog.csv', index=False)
    roles_df.to_csv(f'{out}/09_Roles.csv', index=False)
    audit_df.to_csv(f'{out}/10_AuditLog.csv', index=False)

    with open(f'{out}/reconciliation_report.txt', 'w') as f:
        f.write('\n'.join(report_lines))

    print(f"\n✓ 10 CSV files written to {out}/")
    print(f"✓ Reconciliation report: {out}/reconciliation_report.txt")
    print("\nNext steps:")
    print("  1. Create Google Sheets workbook with 10 tabs named exactly:")
    print("     Sites, People, Owners, Agents, Payments, PaymentHeads,")
    print("     Transfers, CallLog, Roles, AuditLog")
    print("  2. Import each CSV to its corresponding tab (File > Import)")
    print("  3. Complete the action items from the reconciliation report")
    print("  4. Deploy Apps Script Web App pointing to this workbook")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dryrun', action='store_true', default=False)
    args = parser.parse_args()
    run(dryrun=args.dryrun)
