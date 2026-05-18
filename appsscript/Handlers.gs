  // Handlers.gs — All domain operation handlers

  const NOW_ISO = () => new Date().toISOString();

  // ─── SITES ───────────────────────────────────────────────────────────────────

  function getSites(params) {
    let sites = sheetToObjects(CONFIG.TABS.SITES);
    if (params.phase)    sites = sites.filter(s => String(s.Phase) === String(params.phase));
    if (params.siteType) sites = sites.filter(s => s.SiteType === params.siteType);
    if (params.flagged === 'true') sites = sites.filter(s => s.FlaggedForAttention === 'TRUE');

    // Skip enrichment if caller just needs raw site data
    if (params.raw === 'true') return sites;

    // Enrich with current owner info and payment status
    const owners   = sheetToObjects(CONFIG.TABS.OWNERS);
    const people   = sheetToObjects(CONFIG.TABS.PEOPLE);
    const payments = sheetToObjects(CONFIG.TABS.PAYMENTS);
    const heads    = sheetToObjects(CONFIG.TABS.PAYMENT_HEADS).filter(h => h.IsActive === 'TRUE');
    const callLog  = sheetToObjects(CONFIG.TABS.CALL_LOG);
    const openFollowUpSites = new Set();
    callLog.forEach(l => {
      if (l.FollowUpDone !== 'TRUE' && l.FollowUpAction && String(l.FollowUpAction).trim() !== '') {
        openFollowUpSites.add(l.SiteID);
      }
    });
    const peopleMap = Object.fromEntries(people.map(p => [p.PersonID, p]));

    // Build a payment lookup: siteId -> { headId -> totalPaid }
    const payMap = {};
    payments.forEach(p => {
      if (!payMap[p.SiteID]) payMap[p.SiteID] = {};
      if (!payMap[p.SiteID][p.HeadID]) payMap[p.SiteID][p.HeadID] = 0;
      payMap[p.SiteID][p.HeadID] += parseFloat(p.Amount) || 0;
    });

    sites = sites.map(site => {
      const currentOwners = owners.filter(o =>
        o.SiteID === site.SiteID && (o.IsCurrent === 'TRUE' || o.IsCurrent === true)
      );
      const firstOwner = currentOwners[0];
      const person = firstOwner ? peopleMap[firstOwner.PersonID] : null;

      // Derive payment status
      let payStatus;
      if (!person || (!person.Mobile1 && !person.Mobile2 && !person.Email)) {
        payStatus = 'nocontact';
      } else if (firstOwner && firstOwner.Status === 'Disputed') {
        payStatus = 'disputed';
      } else if (heads.length > 0) {
        const sitePay = payMap[site.SiteID] || {};
        let allPaid = true, anyPartial = false;
        for (const head of heads) {
          const paid = sitePay[head.HeadID] || 0;
          let expected = 0;
          if (head.AmountType === 'Flat') {
            expected = parseFloat(head.ExpectedAmountFlat) || 0;
          } else if (site.Sizesqft) {
            expected = (parseFloat(head.ExpectedAmountPerSqft) || 0) * parseFloat(site.Sizesqft);
          }
          if (expected > 0) {
            if (paid < expected) allPaid = false;
            if (paid > 0 && paid < expected) anyPartial = true;
          }
        }
        payStatus = allPaid ? 'paid' : anyPartial ? 'partial' : 'unpaid';
      } else {
        payStatus = 'unpaid';
      }

      return {
        ...site,
        ownerName:    person ? person.FullName : null,
        membershipNo: firstOwner ? firstOwner.MembershipNo : null,
        mobile:       person ? (person.Mobile1 || person.Mobile2 || null) : null,
        ownerStatus:  firstOwner ? firstOwner.Status : null,
        hasOpenFollowUp: openFollowUpSites.has(site.SiteID),
        payStatus,
      };
    });

    return sites;
  }

  function getArchivedSites() {
    const sites = sheetToObjectsAll(CONFIG.TABS.SITES)
      .filter(s => s.IsDeleted === 'TRUE');
    const owners = sheetToObjects(CONFIG.TABS.OWNERS);
    const people = sheetToObjects(CONFIG.TABS.PEOPLE);
    const peopleMap = Object.fromEntries(people.map(p => [p.PersonID, p]));

    return sites.map(site => {
      const currentOwners = owners.filter(o =>
        o.SiteID === site.SiteID && (o.IsCurrent === 'TRUE' || o.IsCurrent === true)
      );
      const firstOwner = currentOwners[0];
      const person = firstOwner ? peopleMap[firstOwner.PersonID] : null;
      return {
        ...site,
        ownerName: person ? person.FullName : null,
        membershipNo: firstOwner ? firstOwner.MembershipNo : null,
        mobile: person ? (person.Mobile1 || person.Mobile2 || null) : null,
      };
    });
  }

  function getSite(siteId) {
    const sites = sheetToObjects(CONFIG.TABS.SITES);
    const site = sites.find(s => s.SiteID === siteId);
    if (!site) throw new Error('Site not found: ' + siteId);
    const owners = sheetToObjects(CONFIG.TABS.OWNERS).filter(o => o.SiteID === siteId);
    const people = sheetToObjects(CONFIG.TABS.PEOPLE);
    const peopleMap = Object.fromEntries(people.map(p => [p.PersonID, p]));
    const currentOwners = owners
      .filter(o => o.IsCurrent === 'TRUE' || o.IsCurrent === true)
      .map(o => ({ ...o, person: peopleMap[o.PersonID] || null }));
    const pastOwners = owners
      .filter(o => o.IsCurrent !== 'TRUE' && o.IsCurrent !== true)
      .map(o => ({ ...o, person: peopleMap[o.PersonID] || null }));
    return { site, currentOwners, pastOwners };
  }

  function createSite(params, caller) {
    const id = nextId('S', CONFIG.TABS.SITES, 'SiteID');
    const obj = {
      SiteID: id, SiteNo: params.siteNo, Phase: params.phase,
      Released: params.released || 'FALSE', SiteType: params.siteType,
      Sizesqft: params.sizesqft || '', RegDate: params.regDate || '',
      AttachmentURLs: '', FlaggedForAttention: 'FALSE',
      FlagComment: '', FlaggedBy: '', FlaggedAt: ''
    };
    appendRow(CONFIG.TABS.SITES, obj, caller);
    writeAuditCreate(caller, 'Sites', id, obj);
    return { siteId: id };
  }

  function archiveSite(params, caller) {
    if (!params.siteId) throw new Error('siteId is required');
    return softDelete(CONFIG.TABS.SITES, 'SiteID', params.siteId, caller);
  }

  function unarchiveSite(params, caller) {
    if (!params.siteId) throw new Error('siteId is required');
    return restoreDeleted(CONFIG.TABS.SITES, 'SiteID', params.siteId, caller);
  }

  function updateSite(params, caller) {
    if (!params.siteId) throw new Error('siteId is required');

    const sitesAll = sheetToObjectsAll(CONFIG.TABS.SITES);
    const currentSite = sitesAll.find(s => s.SiteID === params.siteId);
    if (!currentSite) throw new Error('Site not found: ' + params.siteId);

    if (params.SiteNo !== undefined) {
      const requestedSiteNo = String(params.SiteNo || '').trim();
      if (!requestedSiteNo) throw new Error('Site number cannot be empty');

      const existingSiteNo = String(currentSite.SiteNo || '').trim();
      const isRename = requestedSiteNo !== existingSiteNo;
      if (isRename && caller.role !== 'Admin') {
        throw new Error('Only Admin can rename a site');
      }

      const duplicate = sitesAll.some(s =>
        s.SiteID !== params.siteId &&
        String(s.SiteNo || '').trim().toLowerCase() === requestedSiteNo.toLowerCase()
      );
      if (duplicate) throw new Error('Site number already exists');

      params.SiteNo = requestedSiteNo;
    }

    const allowed = ['SiteNo','Phase','Released','SiteType','Sizesqft','RegDate','AttachmentURLs'];
    const fields = {};
    allowed.forEach(f => { if (params[f] !== undefined) fields[f] = params[f]; });
    const changes = updateRowFields(CONFIG.TABS.SITES, 'SiteID', params.siteId, fields, caller);
    writeAuditChanges(caller, 'Sites', params.siteId, changes);
    return { updated: true };
  }

  function flagSite(params, caller) {
    const flagging = params.flag === 'true' || params.flag === true;
    const comment = String(params.comment || '').trim();
    const fields = {
      FlaggedForAttention: flagging ? 'TRUE' : 'FALSE',
      // Keep metadata even when clearing so resolution details are not lost.
      FlagComment: comment,
      FlaggedBy: caller.email,
      FlaggedAt: NOW_ISO()
    };
    const changes = updateRowFields(CONFIG.TABS.SITES, 'SiteID', params.siteId, fields, caller);
    writeAuditChanges(caller, 'Sites', params.siteId, changes);
    return { flagged: flagging };
  }

  // ─── PEOPLE ──────────────────────────────────────────────────────────────────

  function getPeople(params) {
    let people = sheetToObjects(CONFIG.TABS.PEOPLE);
    if (params.q) {
      const q = params.q.toLowerCase();
      people = people.filter(p =>
        (p.FullName && p.FullName.toLowerCase().includes(q)) ||
        (p.Mobile1 && p.Mobile1.includes(q)) ||
        (p.Mobile2 && p.Mobile2.includes(q)) ||
        (p.Email && p.Email.toLowerCase().includes(q))
      );
    }
    return people;
  }

  function getPerson(personId) {
    const person = sheetToObjects(CONFIG.TABS.PEOPLE).find(p => p.PersonID === personId);
    if (!person) throw new Error('Person not found: ' + personId);
    const ownerships = sheetToObjects(CONFIG.TABS.OWNERS)
      .filter(o => o.PersonID === personId)
      .map(o => {
        const site = sheetToObjects(CONFIG.TABS.SITES).find(s => s.SiteID === o.SiteID);
        return { ...o, site: site || null };
      });
    return { person, ownerships };
  }

  function createPerson(params, caller) {
    const id = nextId('P', CONFIG.TABS.PEOPLE, 'PersonID');
    const obj = {
      PersonID: id, FullName: params.fullName, Mobile1: params.mobile1 || '',
      Mobile2: params.mobile2 || '', Email: params.email || '',
      Address: params.address || '', CommAddress: params.commAddress || '',
      PhotoURL: '', IDProofURLs: '', Notes: params.notes || ''
    };
    appendRow(CONFIG.TABS.PEOPLE, obj, caller);
    writeAuditCreate(caller, 'People', id, obj);
    return { personId: id };
  }

  function updatePerson(params, caller) {
    const allowed = ['FullName','Mobile1','Mobile2','Email','Address','CommAddress','PhotoURL','IDProofURLs','Notes'];
    const fields = {};
    allowed.forEach(f => { if (params[f] !== undefined) fields[f] = params[f]; });
    const changes = updateRowFields(CONFIG.TABS.PEOPLE, 'PersonID', params.personId, fields, caller);
    writeAuditChanges(caller, 'People', params.personId, changes);
    return { updated: true };
  }

  // ─── OWNERS ──────────────────────────────────────────────────────────────────

  function getOwners(params) {
    let owners = sheetToObjects(CONFIG.TABS.OWNERS);
    if (params.siteId) owners = owners.filter(o => o.SiteID === params.siteId);
    if (params.personId) owners = owners.filter(o => o.PersonID === params.personId);
    if (params.isCurrent === 'true') owners = owners.filter(o => o.IsCurrent === 'TRUE');
    return owners;
  }

  function createOwner(params, caller) {
    const id = nextId('O', CONFIG.TABS.OWNERS, 'OwnerID');
    const obj = {
      OwnerID: id, SiteID: params.siteId, PersonID: params.personId,
      MembershipNo: params.membershipNo || '',
      MemberSince: params.memberSince || '',
      IsCurrent: 'TRUE',
      OwnershipStartDate: params.ownershipStartDate || '',
      OwnershipEndDate: '',
      NominatedContact: params.nominatedContact || '',
      IsCouncilMember: params.isCouncilMember || 'FALSE',
      AgentID: params.agentId || '',
      Status: params.status || 'Active',
      FlaggedForAttention: 'FALSE', FlagComment: '', FlaggedBy: '', FlaggedAt: '',
      Notes: params.notes || ''
    };
    appendRow(CONFIG.TABS.OWNERS, obj, caller);
    writeAuditCreate(caller, 'Owners', id, obj);
    return { ownerId: id };
  }

  function updateOwner(params, caller) {
    if (params.MembershipNo !== undefined) {
      params.MembershipNo = String(params.MembershipNo || '').trim();
      if (!params.MembershipNo && params.MemberSince === undefined) {
        params.MemberSince = '';
      }
    }
    const allowed = ['MembershipNo','MemberSince','NominatedContact','IsCouncilMember',
      'AgentID','Status','Notes','OwnershipStartDate','OwnershipEndDate'];
    const fields = {};
    allowed.forEach(f => { if (params[f] !== undefined) fields[f] = params[f]; });
    const changes = updateRowFields(CONFIG.TABS.OWNERS, 'OwnerID', params.ownerId, fields, caller);
    writeAuditChanges(caller, 'Owners', params.ownerId, changes);
    return { updated: true };
  }

  function removeOwnerFromSite(params, caller) {
    if (!params.ownerId) throw new Error('ownerId required');
    if (!params.personId) throw new Error('personId required');

    const today = NOW_ISO().split('T')[0];

    // Mark this owner row as no longer current
    const ownerChanges = updateRowFields(CONFIG.TABS.OWNERS, 'OwnerID', params.ownerId, {
      IsCurrent: 'FALSE',
      OwnershipEndDate: today
    }, caller);
    writeAuditChanges(caller, 'Owners', params.ownerId, ownerChanges);

    // Check if the person is an active owner on any other site
    const allOwners = sheetToObjects(CONFIG.TABS.OWNERS);
    const stillActive = allOwners.some(o =>
      o.PersonID === params.personId &&
      o.OwnerID !== params.ownerId &&
      (o.IsCurrent === 'TRUE' || o.IsCurrent === true) &&
      o.IsDeleted !== 'TRUE'
    );

    let personSoftDeleted = false;
    if (!stillActive) {
      softDelete(CONFIG.TABS.PEOPLE, 'PersonID', params.personId, caller);
      personSoftDeleted = true;
    }

    return { removed: true, personSoftDeleted };
  }

  function flagOwner(params, caller) {
    throw new Error('Owner-level flagging is disabled. Use Site-level flagging only.');
  }

  function addOwnersToSite(params, caller) {
    if (!params.siteId) throw new Error('siteId is required');

    const ownershipStartDate = params.ownershipStartDate || NOW_ISO().split('T')[0];
    const newPersons = Array.isArray(params.newPersons)
      ? params.newPersons
      : (params.newPerson ? [params.newPerson] : []);

    if (newPersons.length === 0 && !params.personId) {
      throw new Error('newPersons (or newPerson/personId) is required');
    }

    const incoming = [];
    if (params.personId) {
      incoming.push({
        personId: params.personId,
        membershipNo: params.membershipNo || '',
        nominatedContact: params.nominatedContact || ''
      });
    }
    newPersons.forEach(p => {
      incoming.push(p || {});
    });

    const createdOwners = incoming.map((personLike, idx) => {
      let personId = personLike.personId || '';
      if (!personId) {
        if (!personLike.fullName || !personLike.mobile1) {
          throw new Error(`Incoming owner ${idx + 1} must include fullName and mobile1`);
        }
        const pResult = createPerson(personLike, caller);
        personId = pResult.personId;
      }

      const membershipNo =
        personLike.membershipNo ||
        (idx === 0 ? (params.membershipNo || '') : '') ||
        nextMembershipNo();

      const ownerResult = createOwner({
        siteId: params.siteId,
        personId,
        membershipNo,
        memberSince: personLike.memberSince || ownershipStartDate,
        ownershipStartDate,
        nominatedContact: personLike.nominatedContact || params.nominatedContact || '',
        status: 'Active'
      }, caller);

      return { ownerId: ownerResult.ownerId, personId, membershipNo };
    });

    return {
      ownerId: createdOwners[0] ? createdOwners[0].ownerId : '',
      ownerIds: createdOwners.map(o => o.ownerId),
      membershipNo: createdOwners[0] ? createdOwners[0].membershipNo : '',
      membershipNos: createdOwners.map(o => o.membershipNo),
      personId: createdOwners[0] ? createdOwners[0].personId : '',
      personIds: createdOwners.map(o => o.personId)
    };
  }

  function transferOwnership(params, caller) {
    const transferDate = params.transferDate || NOW_ISO().split('T')[0];

    const fromOwnerIds = Array.isArray(params.fromOwnerIds)
      ? params.fromOwnerIds
      : (params.fromOwnerId ? [params.fromOwnerId] : []);
    const cleanFromOwnerIds = fromOwnerIds
      .map(id => String(id || '').trim())
      .filter(Boolean);

    const newPersons = Array.isArray(params.newPersons)
      ? params.newPersons
      : (params.newPerson ? [params.newPerson] : []);
    if (newPersons.length === 0 && !params.personId) {
      throw new Error('newPersons (or newPerson/personId) is required');
    }

    // 1. Flip outgoing owners to IsCurrent = FALSE when this is a transfer.
    // If there are no outgoing owners, treat this as first-owner assignment.
    cleanFromOwnerIds.forEach(ownerId => {
      const outChanges = updateRowFields(CONFIG.TABS.OWNERS, 'OwnerID', ownerId, {
        IsCurrent: 'FALSE',
        OwnershipEndDate: transferDate
      }, caller);
      writeAuditChanges(caller, 'Owners', ownerId, outChanges);
    });

    // 2. Create incoming owners (supports one or many)
    const incoming = [];
    if (params.personId) {
      incoming.push({
        personId: params.personId,
        membershipNo: params.membershipNo || '',
        nominatedContact: params.nominatedContact || ''
      });
    }
    newPersons.forEach(p => {
      incoming.push(p || {});
    });

    const createdOwners = incoming.map((personLike, idx) => {
      let personId = personLike.personId || '';
      if (!personId) {
        if (!personLike.fullName || !personLike.mobile1) {
          throw new Error(`Incoming owner ${idx + 1} must include fullName and mobile1`);
        }
        const pResult = createPerson(personLike, caller);
        personId = pResult.personId;
      }

      // Legacy single-transfer payload may pass one membershipNo for the first incoming owner.
      const membershipNo =
        personLike.membershipNo ||
        (idx === 0 ? (params.membershipNo || '') : '') ||
        nextMembershipNo();

      const newOwnerResult = createOwner({
        siteId: params.siteId,
        personId,
        membershipNo,
        memberSince: personLike.memberSince || transferDate,
        ownershipStartDate: transferDate,
        nominatedContact: personLike.nominatedContact || params.nominatedContact || '',
        status: 'Active'
      }, caller);

      return { ownerId: newOwnerResult.ownerId, personId, membershipNo };
    });

    // 3. Write transfer record(s). For multi-owner transfers, keep all outgoing owner IDs in FromOwnerID.
    const fromOwnerRef = cleanFromOwnerIds.join(',');
    const transferIds = createdOwners.map(created => {
      const transferId = nextId('T', CONFIG.TABS.TRANSFERS, 'TransferID');
      const tObj = {
        TransferID: transferId,
        SiteID: params.siteId,
        FromOwnerID: fromOwnerRef,
        ToOwnerID: created.ownerId,
        TransferDate: transferDate,
        SalePrice: params.salePrice || '',
        DocRef: params.docRef || '',
        RecordedBy: caller.email,
        RecordedAt: NOW_ISO()
      };
      appendRow(CONFIG.TABS.TRANSFERS, tObj, caller);
      writeAuditCreate(caller, 'Transfers', transferId, tObj);
      return transferId;
    });

    // 6. Mirror transfer document in site attachments for easy access in UI
    const docUrl = String(params.docRef || '').trim();
    if (docUrl) {
      const sites = sheetToObjects(CONFIG.TABS.SITES);
      const site = sites.find(s => s.SiteID === params.siteId);
      if (site) {
        let attachments = [];
        try {
          const parsed = JSON.parse(site.AttachmentURLs || '[]');
          if (Array.isArray(parsed)) attachments = parsed;
        } catch (_) {
          attachments = [];
        }

        const alreadyExists = attachments.some(a => String((a && a.url) || '').trim() === docUrl);
        if (!alreadyExists) {
          attachments.push({
            label: 'Site Ownership Transfer Document',
            url: docUrl,
            type: 'pdf',
            uploadedAt: transferDate,
          });
          const siteChanges = updateRowFields(
            CONFIG.TABS.SITES,
            'SiteID',
            params.siteId,
            { AttachmentURLs: JSON.stringify(attachments) },
            caller
          );
          writeAuditChanges(caller, 'Sites', params.siteId, siteChanges);
        }
      }
    }

    return {
      transferId: transferIds[0] || '',
      transferIds,
      fromOwnerIds: cleanFromOwnerIds,
      newOwnerId: createdOwners[0] ? createdOwners[0].ownerId : '',
      newOwnerIds: createdOwners.map(o => o.ownerId),
      membershipNo: createdOwners[0] ? createdOwners[0].membershipNo : '',
      membershipNos: createdOwners.map(o => o.membershipNo),
      personId: createdOwners[0] ? createdOwners[0].personId : '',
      personIds: createdOwners.map(o => o.personId)
    };
  }

  // ─── AGENTS ──────────────────────────────────────────────────────────────────

  function getAgents() { return sheetToObjects(CONFIG.TABS.AGENTS); }

  function createAgent(params, caller) {
    const id = nextId('A', CONFIG.TABS.AGENTS, 'AgentID');
    const obj = {
      AgentID: id, Name: params.name, Mobile: params.mobile || '',
      Email: params.email || '', PhotoURL: '', IDProofURLs: '', Notes: params.notes || ''
    };
    appendRow(CONFIG.TABS.AGENTS, obj, caller);
    writeAuditCreate(caller, 'Agents', id, obj);
    return { agentId: id };
  }

  function updateAgent(params, caller) {
    // Accept both camelCase API payload keys and sheet-column style keys.
    const fieldMap = {
      Name: params.Name !== undefined ? params.Name : params.name,
      Mobile: params.Mobile !== undefined ? params.Mobile : params.mobile,
      Email: params.Email !== undefined ? params.Email : params.email,
      PhotoURL: params.PhotoURL !== undefined ? params.PhotoURL : params.photoUrl,
      IDProofURLs: params.IDProofURLs !== undefined ? params.IDProofURLs : params.idProofUrls,
      Notes: params.Notes !== undefined ? params.Notes : params.notes
    };
    const fields = {};
    Object.keys(fieldMap).forEach(function(k) {
      if (fieldMap[k] !== undefined) fields[k] = fieldMap[k];
    });
    const changes = updateRowFields(CONFIG.TABS.AGENTS, 'AgentID', params.agentId, fields, caller);
    writeAuditChanges(caller, 'Agents', params.agentId, changes);
    return { updated: true };
  }

  // ─── PAYMENTS ────────────────────────────────────────────────────────────────

  function getPayments(params) {
    let pays = sheetToObjects(CONFIG.TABS.PAYMENTS);
    if (params.siteId) pays = pays.filter(p => p.SiteID === params.siteId);
    if (params.headId) pays = pays.filter(p => p.HeadID === params.headId);

    // When fetching all payments, enrich with site + owner info
    if (!params.siteId) {
      const sites    = sheetToObjects(CONFIG.TABS.SITES);
      const owners   = sheetToObjects(CONFIG.TABS.OWNERS);
      const people   = sheetToObjects(CONFIG.TABS.PEOPLE);
      const siteMap  = Object.fromEntries(sites.map(s => [s.SiteID, s]));
      const peopleMap= Object.fromEntries(people.map(p => [p.PersonID, p]));
      pays = pays.map(p => {
        const site = siteMap[p.SiteID] || {};
        const owner= owners.find(o => o.SiteID === p.SiteID && (o.IsCurrent === 'TRUE' || o.IsCurrent === true));
        const person = owner ? peopleMap[owner.PersonID] : null;
        return { ...p, SiteNo: site.SiteNo || '', Phase: site.Phase || '', OwnerName: person ? person.FullName : '' };
      });
    }

    return pays;
  }

  function createPayment(params, caller) {
    const id = nextId('PAY', CONFIG.TABS.PAYMENTS, 'PaymentID');
    const obj = {
      PaymentID: id, SiteID: params.siteId, OwnerID: params.ownerId,
      HeadID: params.headId, Amount: params.amount, Mode: params.mode,
      PaymentDate: params.paymentDate, ReceiptNo: params.receiptNo || '',
      BankRef: params.bankRef || '', ProofURL: params.proofUrl || '',
      FlaggedForAttention: 'FALSE', FlagComment: '', FlaggedBy: '', FlaggedAt: '',
      RecordedBy: caller.email, RecordedAt: NOW_ISO()
    };
    appendRow(CONFIG.TABS.PAYMENTS, obj, caller);
    writeAuditCreate(caller, 'Payments', id, obj);
    return { paymentId: id };
  }

  function updatePayment(params, caller, role) {
    const allowed = ['SiteID','HeadID','Amount','Mode','PaymentDate','ReceiptNo','BankRef','ProofURL','FlaggedForAttention','FlagComment','FlaggedBy','FlaggedAt'];
    const fields = {};
    allowed.forEach(f => { if (params[f] !== undefined) fields[f] = params[f]; });

    if (params.FlaggedForAttention !== undefined) {
      const flagging =
        params.FlaggedForAttention === true ||
        String(params.FlaggedForAttention).toUpperCase() === 'TRUE' ||
        String(params.FlaggedForAttention).toLowerCase() === 'true';
      fields.FlaggedForAttention = flagging ? 'TRUE' : 'FALSE';
      fields.FlaggedBy = caller.email;
      fields.FlaggedAt = NOW_ISO();
      if (!flagging && params.FlagComment === undefined) {
        fields.FlagComment = '';
      }
    }

    const changes = updateRowFields(CONFIG.TABS.PAYMENTS, 'PaymentID', params.paymentId, fields, caller);
    writeAuditChanges(caller, 'Payments', params.paymentId, changes);
    return { updated: true };
  }

  function getPaymentHeads() { return sheetToObjects(CONFIG.TABS.PAYMENT_HEADS); }

  function createPaymentHead(params, caller) {
    const id = nextId('H', CONFIG.TABS.PAYMENT_HEADS, 'HeadID');
    const obj = {
      HeadID: id, HeadName: params.headName, AmountType: params.amountType,
      ExpectedAmountFlat: params.amountType === 'Flat' ? params.expectedAmount : '',
      ExpectedAmountPerSqft: params.amountType === 'PerSqft' ? params.expectedAmount : '',
      DueDate: params.dueDate || '', IsActive: 'TRUE', Notes: params.notes || ''
    };
    appendRow(CONFIG.TABS.PAYMENT_HEADS, obj, caller);
    writeAuditCreate(caller, 'PaymentHeads', id, obj);
    return { headId: id };
  }

  function updatePaymentHead(params, caller) {
    // Don't allow AmountType change if payments exist
    if (params.amountType) {
      const existingPays = sheetToObjects(CONFIG.TABS.PAYMENTS).filter(p => p.HeadID === params.headId);
      if (existingPays.length > 0) throw new Error('Cannot change AmountType after payments have been recorded');
    }
    // Frontend sends camelCase payload keys; map them to sheet column names.
    const fieldMap = {
      HeadName: params.HeadName !== undefined ? params.HeadName : params.headName,
      ExpectedAmountFlat: params.ExpectedAmountFlat !== undefined ? params.ExpectedAmountFlat : params.expectedAmountFlat,
      ExpectedAmountPerSqft: params.ExpectedAmountPerSqft !== undefined ? params.ExpectedAmountPerSqft : params.expectedAmountPerSqft,
      DueDate: params.DueDate !== undefined ? params.DueDate : params.dueDate,
      IsActive: params.IsActive !== undefined ? params.IsActive : params.isActive,
      Notes: params.Notes !== undefined ? params.Notes : params.notes
    };
    const fields = {};
    Object.keys(fieldMap).forEach(function(k) {
      if (fieldMap[k] !== undefined) fields[k] = fieldMap[k];
    });
    const changes = updateRowFields(CONFIG.TABS.PAYMENT_HEADS, 'HeadID', params.headId, fields, caller);
    writeAuditChanges(caller, 'PaymentHeads', params.headId, changes);
    return { updated: true };
  }

  // ─── CALL LOG ────────────────────────────────────────────────────────────────

  function getCallLog(params) {
    let logs = sheetToObjects(CONFIG.TABS.CALL_LOG);
    if (params.siteId) logs = logs.filter(l => l.SiteID === params.siteId);

    const sites   = sheetToObjects(CONFIG.TABS.SITES);
    const owners  = sheetToObjects(CONFIG.TABS.OWNERS);
    const people  = sheetToObjects(CONFIG.TABS.PEOPLE);
    const siteMap   = Object.fromEntries(sites.map(s => [s.SiteID, s]));
    const peopleMap = Object.fromEntries(people.map(p => [p.PersonID, p]));

    logs = logs.map(l => {
      const site = siteMap[l.SiteID];
      const currentOwner = owners.find(o =>
        o.SiteID === l.SiteID && (o.IsCurrent === 'TRUE' || o.IsCurrent === true)
      );
      const person = currentOwner ? peopleMap[currentOwner.PersonID] : null;
      return {
        ...l,
        SiteNo:    site   ? site.SiteNo     : null,
        Phase:     site   ? site.Phase      : null,
        OwnerName: person ? person.FullName : null,
      };
    });

    logs.sort((a, b) => (b.LogDate > a.LogDate ? 1 : -1));
    return logs;
  }

  function createCallLog(params, caller) {
    const id = nextId('L', CONFIG.TABS.CALL_LOG, 'LogID');
    const obj = {
      LogID: id, SiteID: params.siteId, OwnerID: params.ownerId || '',
      LogDate: params.logDate || NOW_ISO().split('T')[0],
      CalledBy: caller.displayName,
      Summary: params.summary,
      FollowUpAction: params.followUpAction || '',
      AssignedTo: params.assignedTo || '',
      AssignedToName: params.assignedToName || '',
      FollowUpDone: 'FALSE', DoneBy: '', DoneAt: '', LoggedAt: NOW_ISO()
    };
    appendRow(CONFIG.TABS.CALL_LOG, obj, caller);
    // No audit log for call log entries per spec
    return { logId: id };
  }

  function updateCallLog(params, caller, role) {
    // Time-window: 24hrs for own entries, unlimited for Edit role
    if (role !== CONFIG.ROLES.EDIT && role !== 'Admin') {
      const found = findRow(CONFIG.TABS.CALL_LOG, 'LogID', params.logId);
      if (found) {
        const headers = found.headers;
        const calledByIdx = headers.indexOf('CalledBy');
        const loggedAtIdx = headers.indexOf('LoggedAt');
        const calledBy = found.row[calledByIdx];
        const loggedAt = new Date(found.row[loggedAtIdx]);
        const hoursAgo = (Date.now() - loggedAt.getTime()) / 3600000;
        if (calledBy !== caller.displayName) throw new Error('Can only edit your own call log entries');
        if (hoursAgo > 24) throw new Error('Call log entries can only be edited within 24 hours');
      }
    }
    const allowed = ['Summary','FollowUpAction','AssignedTo','AssignedToName'];
    const fields = {};
    allowed.forEach(f => { if (params[f] !== undefined) fields[f] = params[f]; });
    updateRowFields(CONFIG.TABS.CALL_LOG, 'LogID', params.logId, fields, caller);
    return { updated: true };
  }

  function markFollowUpDone(params, caller) {
    const fields = {
      FollowUpDone: 'TRUE', DoneBy: caller.email, DoneAt: NOW_ISO()
    };

    const resolutionComment = String(params.resolutionComment || '').trim();
    if (resolutionComment) {
      const found = findRow(CONFIG.TABS.CALL_LOG, 'LogID', params.logId);
      if (found) {
        const followUpIdx = found.headers.indexOf('FollowUpAction');
        const existingFollowUp = followUpIdx >= 0 ? String(found.row[followUpIdx] || '').trim() : '';
        fields.FollowUpAction = `${existingFollowUp}${existingFollowUp ? ' ' : ''}//Resolution: ${resolutionComment}`;
      }
    }

    updateRowFields(CONFIG.TABS.CALL_LOG, 'LogID', params.logId, fields, caller);
    return { done: true };
  }

  function reopenFollowUp(params, caller) {
    updateRowFields(CONFIG.TABS.CALL_LOG, 'LogID', params.logId, {
      FollowUpDone: 'FALSE', DoneBy: '', DoneAt: ''
    }, caller);
    return { reopened: true };
  }

  function getFollowUps(params) {
    let logs = sheetToObjects(CONFIG.TABS.CALL_LOG).filter(l =>
      l.FollowUpDone !== 'TRUE' && l.FollowUpAction && String(l.FollowUpAction).trim() !== ''
    );
    if (params.assignedTo) logs = logs.filter(l => l.AssignedTo === params.assignedTo);
    logs.sort((a, b) => a.LogDate > b.LogDate ? 1 : -1);
    return logs;
  }

  // ─── DASHBOARD ───────────────────────────────────────────────────────────────

  function getStats() {
    const sites = sheetToObjects(CONFIG.TABS.SITES);
    const owners = sheetToObjects(CONFIG.TABS.OWNERS);
    const payments = sheetToObjects(CONFIG.TABS.PAYMENTS);
    const heads = sheetToObjects(CONFIG.TABS.PAYMENT_HEADS).filter(h => h.IsActive === 'TRUE');

    const totalSites = sites.length;
    const totalMembers = owners.filter(o => o.MembershipNo && (o.IsCurrent === 'TRUE' || o.IsCurrent === true)).length;
    const flaggedSites = sites.filter(s => s.FlaggedForAttention === 'TRUE').length;
    const flaggedOwners = owners.filter(o => o.FlaggedForAttention === 'TRUE').length;

    // Payment status per active head
    const headStats = heads.map(h => {
      const headPayments = payments.filter(p => p.HeadID === h.HeadID);
      const paidSiteIds = new Set(headPayments.map(p => p.SiteID));
      return {
        headId: h.HeadID, headName: h.HeadName,
        paid: paidSiteIds.size, total: totalSites
      };
    });

    return { totalSites, totalMembers, flaggedSites, flaggedOwners, headStats };
  }

  function getDefaulters(params) {
    const sites = sheetToObjects(CONFIG.TABS.SITES);
    const owners = sheetToObjects(CONFIG.TABS.OWNERS);
    const people = sheetToObjects(CONFIG.TABS.PEOPLE);
    const payments = sheetToObjects(CONFIG.TABS.PAYMENTS);
    const heads = sheetToObjects(CONFIG.TABS.PAYMENT_HEADS).filter(h => h.IsActive === 'TRUE');
    const callLogs = sheetToObjects(CONFIG.TABS.CALL_LOG);

    const peopleMap = Object.fromEntries(people.map(p => [p.PersonID, p]));
    const ownersMap = {};
    owners.filter(o => o.IsCurrent === 'TRUE').forEach(o => { ownersMap[o.SiteID] = o; });

    const defaulters = [];

    sites.forEach(site => {
      const owner = ownersMap[site.SiteID];
      const person = owner ? peopleMap[owner.PersonID] : null;

      heads.forEach(head => {
        let expected;
        if (head.AmountType === 'Flat') {
          expected = parseFloat(head.ExpectedAmountFlat) || 0;
        } else {
          if (!site.Sizesqft || site.Sizesqft === '') {
            defaulters.push({
              siteId: site.SiteID, siteNo: site.SiteNo, phase: site.Phase,
              siteType: site.SiteType, sizesqft: null,
              ownerName: person ? person.FullName : '—',
              mobile: person ? person.Mobile1 : '—',
              headId: head.HeadID, headName: head.HeadName,
              amountType: head.AmountType, expected: null, paid: 0, outstanding: null,
              status: 'size_missing'
            });
            return;
          }
          expected = (parseFloat(head.ExpectedAmountPerSqft) || 0) * (parseFloat(site.Sizesqft) || 0);
        }

        const sitePays = payments.filter(p => p.SiteID === site.SiteID && p.HeadID === head.HeadID);
        const paid = sitePays.reduce((sum, p) => sum + (parseFloat(p.Amount) || 0), 0);
        const outstanding = expected - paid;

        if (outstanding > 0) {
          // Last call log
          const lastLog = callLogs.filter(l => l.SiteID === site.SiteID)
            .sort((a, b) => b.LogDate > a.LogDate ? 1 : -1)[0];
          defaulters.push({
            siteId: site.SiteID, siteNo: site.SiteNo, phase: site.Phase,
            siteType: site.SiteType, sizesqft: site.Sizesqft,
            ownerName: person ? person.FullName : '—',
            mobile: person ? person.Mobile1 : '—',
            headId: head.HeadID, headName: head.HeadName,
            amountType: head.AmountType, expected, paid, outstanding,
            status: paid > 0 ? 'partial' : 'unpaid',
            lastCallDate: lastLog ? lastLog.LogDate : null,
            lastCallSummary: lastLog ? lastLog.Summary : null,
          });
        }
      });
    });

    // Filter
    let result = defaulters;
    if (params.headId) result = result.filter(d => d.headId === params.headId);
    if (params.phase) result = result.filter(d => String(d.phase) === String(params.phase));
    if (params.siteType) result = result.filter(d => d.siteType === params.siteType);

    // Sort
    const sortField = params.sortBy || 'outstanding';
    result.sort((a, b) => {
      if (sortField === 'outstanding') return (b.outstanding || 0) - (a.outstanding || 0);
      if (sortField === 'lastCallDate') return (a.lastCallDate || '') < (b.lastCallDate || '') ? -1 : 1;
      return 0;
    });

    return result;
  }

  // ─── USER MANAGEMENT ────────────────────────────────────────────────────────

  function getAssignableUsers() {
    const users = sheetToObjects(CONFIG.TABS.ROLES)
      .filter(u => u.UserEmail && u.IsDeleted !== 'TRUE')
      .map(u => ({
        email: String(u.UserEmail || '').trim(),
        displayName: String(u.DisplayName || u.UserEmail || '').trim(),
        role: String(u.Role || '').trim(),
      }))
      .filter(u => u.email && u.role);

    users.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return users;
  }

  function getUsers() { return sheetToObjects(CONFIG.TABS.ROLES); }

  function addUser(params, caller) {
    const access = checkSheetAccess(params.email);
    if (!access.hasAccess) throw new Error('Account has no Sheet access. Share the workbook first.');
    const id = params.email;
    const obj = {
      UserEmail: id, DisplayName: params.displayName || params.email,
      Role: params.role, AddedBy: caller.email, AddedAt: NOW_ISO()
    };
    appendRow(CONFIG.TABS.ROLES, obj, caller);
    writeAuditCreate(caller, 'Roles', id, obj);
    return { added: true };
  }

  function updateUser(params, caller) {
    const changes = updateRowFields(CONFIG.TABS.ROLES, 'UserEmail', params.email,
      { Role: params.role }, caller);
    writeAuditChanges(caller, 'Roles', params.email, changes);
    return { updated: true };
  }

  function removeUser(params, caller) {
    const changes = updateRowFields(CONFIG.TABS.ROLES, 'UserEmail', params.email,
      { IsDeleted: 'TRUE' }, caller);
    writeAuditChanges(caller, 'Roles', params.email, changes);
    return { removed: true };
  }

  // ─── VERIFY (public) ─────────────────────────────────────────────────────────

  function verifyMember(membershipId) {
    if (!membershipId) return { found: false, message: 'No membership ID provided' };
    const owners = sheetToObjects(CONFIG.TABS.OWNERS);
    const owner = owners.find(o =>
      o.MembershipNo && o.MembershipNo.toUpperCase() === membershipId.toUpperCase()
    );
    if (!owner) return {
      found: false,
      message: 'No active membership found for this ID. For queries, contact MyCiti Owners Association at adminapp.mycitibidadi.com.'
    };
    if (owner.IsCurrent !== 'TRUE') return {
      found: false,
      message: 'No active membership found for this ID. For queries, contact MyCiti Owners Association at adminapp.mycitibidadi.com.'
    };
    const people = sheetToObjects(CONFIG.TABS.PEOPLE);
    const person = people.find(p => p.PersonID === owner.PersonID);
    const site = sheetToObjects(CONFIG.TABS.SITES).find(s => s.SiteID === owner.SiteID);

    if (owner.Status === 'Disputed') {
      return {
        found: true, status: 'disputed',
        membershipId: owner.MembershipNo,
        fullName: person ? person.FullName : '—',
        message: 'Membership under review — contact the association.'
      };
    }

    return {
      found: true, status: 'active',
      membershipId: owner.MembershipNo,
      fullName: person ? person.FullName : '—',
      memberSince: owner.MemberSince || '',
      siteNo: site ? site.SiteNo : '—',
      phase: site ? site.Phase : '—',
      photoUrl: person ? (person.PhotoURL || '') : '',
    };
  }

  // ─── DRIVE UPLOAD FOLDER ────────────────────────────────────────────────────

  function getUploadFolder(params) {
    const root = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_ID);
    const subfolderName = params.type; // Sites, People, Agents, Payments
    const entityId = params.entityId;

    let subfolder;
    const subFolders = root.getFoldersByName(subfolderName);
    subfolder = subFolders.hasNext() ? subFolders.next() :
      root.createFolder(subfolderName);

    let entityFolder;
    const entityFolders = subfolder.getFoldersByName(entityId);
    entityFolder = entityFolders.hasNext() ? entityFolders.next() :
      subfolder.createFolder(entityId);

    return { folderId: entityFolder.getId(), folderUrl: entityFolder.getUrl() };
  }

  function uploadAttachment(params) {
    const folderType = String(params.folderType || '').trim();
    const entityId = String(params.entityId || '').trim();
    const fileName = String(params.fileName || '').trim();
    const mimeType = String(params.mimeType || 'application/octet-stream').trim();
    const contentBase64 = String(params.contentBase64 || '').trim();

    if (!folderType) throw new Error('folderType is required');
    if (!entityId) throw new Error('entityId is required');
    if (!fileName) throw new Error('fileName is required');
    if (!contentBase64) throw new Error('contentBase64 is required');

    const bytes = Utilities.base64Decode(contentBase64);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const { folderId } = getUploadFolder({ type: folderType, entityId });
    const file = DriveApp.getFolderById(folderId).createFile(blob);

    let shareWarning = '';
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      // Some Workspace policies block public sharing; keep upload successful.
      shareWarning = e && e.message ? String(e.message) : 'Could not set anyone-with-link sharing';
    }

    return {
      fileId: file.getId(),
      fileName: file.getName(),
      url: file.getUrl(),
      shareWarning,
    };
  }
