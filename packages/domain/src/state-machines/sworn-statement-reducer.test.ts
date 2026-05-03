import { describe, expect, it } from 'vitest';
import {
  archiveSwornStatement,
  architectApproveSwornStatement,
  generateSwornStatement,
  markNotarizedSwornStatement,
  ownerApproveSwornStatement,
  sendSwornStatementToArchitect,
  sendSwornStatementToOwner,
  uploadSignedSwornStatement,
} from './sworn-statement-reducer';

const fixedNow = new Date('2026-05-01T12:00:00.000Z');

describe('generateSwornStatement', () => {
  it('produces generated state with timestamp', () => {
    const r = generateSwornStatement(fixedNow);
    expect(r).toEqual({
      ok: true,
      nextState: { kind: 'generated', at: fixedNow },
    });
  });
});

describe('uploadSignedSwornStatement', () => {
  it('transitions generated → signed', () => {
    expect(uploadSignedSwornStatement('generated', fixedNow)).toEqual({
      ok: true,
      nextState: { kind: 'signed', at: fixedNow },
    });
  });

  it('rejects from non-generated', () => {
    expect(uploadSignedSwornStatement('signed', fixedNow).ok).toBe(false);
    expect(uploadSignedSwornStatement('notarized', fixedNow).ok).toBe(false);
  });
});

describe('markNotarizedSwornStatement', () => {
  it('transitions signed → notarized', () => {
    expect(markNotarizedSwornStatement('signed', fixedNow)).toEqual({
      ok: true,
      nextState: { kind: 'notarized', at: fixedNow },
    });
  });

  it('rejects from non-signed', () => {
    expect(markNotarizedSwornStatement('generated', fixedNow).ok).toBe(false);
    expect(markNotarizedSwornStatement('notarized', fixedNow).ok).toBe(false);
  });
});

describe('sendSwornStatementToArchitect', () => {
  it('transitions notarized → sent_to_architect with magicLinkId', () => {
    expect(sendSwornStatementToArchitect('notarized', 'ml_x', fixedNow)).toEqual({
      ok: true,
      nextState: { kind: 'sent_to_architect', magicLinkId: 'ml_x', at: fixedNow },
    });
  });

  it('rejects from non-notarized', () => {
    expect(sendSwornStatementToArchitect('signed', 'ml_x', fixedNow).ok).toBe(false);
  });
});

describe('architectApproveSwornStatement', () => {
  it('transitions sent_to_architect → architect_approved', () => {
    expect(architectApproveSwornStatement('sent_to_architect', fixedNow)).toEqual({
      ok: true,
      nextState: { kind: 'architect_approved', at: fixedNow },
    });
  });

  it('rejects from other states', () => {
    expect(architectApproveSwornStatement('notarized', fixedNow).ok).toBe(false);
  });
});

describe('sendSwornStatementToOwner', () => {
  it('transitions architect_approved → sent_to_owner', () => {
    expect(sendSwornStatementToOwner('architect_approved', 'ml_y', fixedNow)).toEqual({
      ok: true,
      nextState: { kind: 'sent_to_owner', magicLinkId: 'ml_y', at: fixedNow },
    });
  });
});

describe('ownerApproveSwornStatement', () => {
  it('transitions sent_to_owner → owner_approved', () => {
    expect(ownerApproveSwornStatement('sent_to_owner', fixedNow)).toEqual({
      ok: true,
      nextState: { kind: 'owner_approved', at: fixedNow },
    });
  });
});

describe('archiveSwornStatement', () => {
  it('transitions owner_approved → archived', () => {
    expect(archiveSwornStatement('owner_approved', fixedNow)).toEqual({
      ok: true,
      nextState: { kind: 'archived', at: fixedNow },
    });
  });

  it('rejects from non-owner_approved', () => {
    expect(archiveSwornStatement('generated', fixedNow).ok).toBe(false);
  });
});
