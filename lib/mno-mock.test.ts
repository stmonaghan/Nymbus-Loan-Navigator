import { describe, it, expect } from 'vitest';
import { matchIdentity, type MNORecord } from './mno-mock';

// ---------------------------------------------------------------------------
// Fixture reference values (mirrors mock-mno-records.json)
// ---------------------------------------------------------------------------
const JOHN_SMITH: MNORecord = {
  firstName: 'John',
  lastName: 'Smith',
  dob: '1990-04-12',
  addressLine1: '123 Main St',
  city: 'Austin',
  state: 'TX',
  postalCode: '78701',
  email: 'john.smith@example.com',
};

const ALEX_JOHNSON: MNORecord = {
  firstName: 'Alex',
  lastName: 'Johnson',
  dob: '1988-03-14',
  addressLine1: '456 Oak Ave',
  city: 'Chicago',
  state: 'IL',
  postalCode: '60614',
  email: 'alex.johnson@example.com',
};

const PRIYA_PATEL: MNORecord = {
  firstName: 'Priya',
  lastName: 'Patel',
  dob: '1992-07-22',
  addressLine1: '789 Elm Blvd',
  city: 'Seattle',
  state: 'WA',
  postalCode: '98101',
  email: 'priya.patel@example.com',
};

// ---------------------------------------------------------------------------
// High-match cases (both lastName AND firstInitial match)
// ---------------------------------------------------------------------------
describe('matchIdentity — high match', () => {
  it('returns high + full record when phone, lastName, and initial all match', () => {
    const result = matchIdentity('+15555550123', 'Smith', 'J');
    expect(result.summaryScore).toBe('high');
    expect(result.record).toEqual(JOHN_SMITH);
  });

  it('is case-insensitive for lastName', () => {
    const result = matchIdentity('+15555550123', 'SMITH', 'J');
    expect(result.summaryScore).toBe('high');
    expect(result.record).toEqual(JOHN_SMITH);
  });

  it('is case-insensitive for firstNameInitial', () => {
    const result = matchIdentity('+15555550123', 'Smith', 'j');
    expect(result.summaryScore).toBe('high');
    expect(result.record).toEqual(JOHN_SMITH);
  });

  it('returns high for Alex Johnson record', () => {
    const result = matchIdentity('+15555550456', 'Johnson', 'A');
    expect(result.summaryScore).toBe('high');
    expect(result.record).toEqual(ALEX_JOHNSON);
  });

  it('returns high for Priya Patel record', () => {
    const result = matchIdentity('+15555550789', 'Patel', 'P');
    expect(result.summaryScore).toBe('high');
    expect(result.record).toEqual(PRIYA_PATEL);
  });
});

// ---------------------------------------------------------------------------
// Medium-match cases (exactly one of lastName / firstInitial matches)
// ---------------------------------------------------------------------------
describe('matchIdentity — medium match', () => {
  it('returns medium + record when lastName matches but initial does not', () => {
    // spec example: Smith + X → medium
    const result = matchIdentity('+15555550123', 'Smith', 'X');
    expect(result.summaryScore).toBe('medium');
    expect(result.record).toEqual(JOHN_SMITH);
  });

  it('returns medium + record when initial matches but lastName does not', () => {
    // "J" matches John's first initial; "Wrong" does not match "Smith"
    const result = matchIdentity('+15555550123', 'Wrong', 'J');
    expect(result.summaryScore).toBe('medium');
    expect(result.record).toEqual(JOHN_SMITH);
  });
});

// ---------------------------------------------------------------------------
// No-match cases
// ---------------------------------------------------------------------------
describe('matchIdentity — no_match', () => {
  it('returns no_match + null when neither lastName nor initial matches', () => {
    // spec example: Wrong + Z → no_match
    const result = matchIdentity('+15555550123', 'Wrong', 'Z');
    expect(result.summaryScore).toBe('no_match');
    expect(result.record).toBeNull();
  });

  it('returns no_match + null for an unlisted phone number', () => {
    const result = matchIdentity('+19999999999', 'Smith', 'J');
    expect(result.summaryScore).toBe('no_match');
    expect(result.record).toBeNull();
  });

  it('returns no_match for empty string phone', () => {
    const result = matchIdentity('', 'Smith', 'J');
    expect(result.summaryScore).toBe('no_match');
    expect(result.record).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Record completeness
// ---------------------------------------------------------------------------
describe('matchIdentity — returned record shape', () => {
  it('record contains all required MNORecord fields on a high match', () => {
    const { record } = matchIdentity('+15555550123', 'Smith', 'J');
    expect(record).not.toBeNull();
    const fields: (keyof MNORecord)[] = [
      'firstName',
      'lastName',
      'dob',
      'addressLine1',
      'city',
      'state',
      'postalCode',
      'email',
    ];
    for (const field of fields) {
      expect(record).toHaveProperty(field);
    }
  });
});
