import records from './mock-mno-records.json';

export interface MNORecord {
  firstName: string;
  lastName: string;
  dob: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  email: string;
}

export type MatchSummaryScore = 'high' | 'medium' | 'no_match';

export interface MatchResult {
  summaryScore: MatchSummaryScore;
  record: MNORecord | null;
}

/**
 * Checks a phone number + partial name against the mock MNO fixture.
 *
 * Scoring:
 *   - Phone not found                          → no_match
 *   - lastName AND firstNameInitial both match → high
 *   - Only one of the two matches              → medium
 *   - Neither matches                          → no_match
 *
 * Match is case-insensitive for both lastName and firstNameInitial.
 * The full MNORecord is returned for high/medium; null for no_match.
 */
export function matchIdentity(
  phoneNumber: string,
  lastName: string,
  firstNameInitial: string
): MatchResult {
  const record = (records as Record<string, MNORecord>)[phoneNumber];

  if (!record) {
    return { summaryScore: 'no_match', record: null };
  }

  const lastNameMatch =
    record.lastName.toLowerCase() === lastName.toLowerCase();
  const initialMatch =
    record.firstName[0].toLowerCase() === firstNameInitial[0].toLowerCase();

  if (lastNameMatch && initialMatch) {
    return { summaryScore: 'high', record };
  }

  if (lastNameMatch || initialMatch) {
    return { summaryScore: 'medium', record };
  }

  return { summaryScore: 'no_match', record: null };
}
