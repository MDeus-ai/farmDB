import { roundAmount } from './analytics';
import type {
  AnimalOwnership,
  OwnershipCategory,
  OwnershipStatus,
} from './types';

export interface OwnershipSummary {
  totalRecords: number;
  activeRecords: number;
  farmOwnedCount: number;
  externalBoardedCount: number;
  soldRetainedCount: number;
  breedingLoanCount: number;
  careQuarantineCount: number;
  coOwnedCount: number;
  activeNonFarmOwnedCount: number;
  activeBoardingFeeTotal: number;
  distinctOwnerCount: number;
}

export function formatOwnershipCategoryLabel(
  category: OwnershipCategory
): string {
  switch (category) {
    case 'farm_owned':
      return 'Farm Owned';
    case 'external_boarded':
      return 'External Owner (Boarded)';
    case 'sold_retained':
      return 'Sold · Retained on Farm';
    case 'breeding_loan_in':
      return 'Breeding Loan / Stud In';
    case 'care_quarantine':
      return 'Temporary Care / Treatment';
    case 'co_owned':
      return 'Co-Owned / Shared Custody';
  }
}

export function formatOwnershipStatusLabel(status: OwnershipStatus): string {
  switch (status) {
    case 'active':
      return 'On Farm (Active)';
    case 'returned':
      return 'Returned to Owner';
    case 'picked_up':
      return 'Picked Up / Collected';
    case 'transferred':
      return 'Ownership Transferred';
  }
}

export function computeOwnershipSummary(
  ownerships: readonly AnimalOwnership[]
): OwnershipSummary {
  let activeRecords = 0;
  let farmOwnedCount = 0;
  let externalBoardedCount = 0;
  let soldRetainedCount = 0;
  let breedingLoanCount = 0;
  let careQuarantineCount = 0;
  let coOwnedCount = 0;
  let activeNonFarmOwnedCount = 0;
  let activeBoardingFeeTotal = 0;
  const ownerNames = new Set<string>();

  for (const item of ownerships) {
    ownerNames.add(item.ownerName.trim().toLowerCase());
    const isActive = item.status === 'active';
    if (!isActive) continue;

    activeRecords += 1;
    activeBoardingFeeTotal = roundAmount(
      activeBoardingFeeTotal + (item.boardingFee || 0)
    );

    if (item.ownershipCategory !== 'farm_owned') {
      activeNonFarmOwnedCount += 1;
    }

    switch (item.ownershipCategory) {
      case 'farm_owned':
        farmOwnedCount += 1;
        break;
      case 'external_boarded':
        externalBoardedCount += 1;
        break;
      case 'sold_retained':
        soldRetainedCount += 1;
        break;
      case 'breeding_loan_in':
        breedingLoanCount += 1;
        break;
      case 'care_quarantine':
        careQuarantineCount += 1;
        break;
      case 'co_owned':
        coOwnedCount += 1;
        break;
    }
  }

  return {
    totalRecords: ownerships.length,
    activeRecords,
    farmOwnedCount,
    externalBoardedCount,
    soldRetainedCount,
    breedingLoanCount,
    careQuarantineCount,
    coOwnedCount,
    activeNonFarmOwnedCount,
    activeBoardingFeeTotal,
    distinctOwnerCount: ownerNames.size,
  };
}

/**
 * Returns the highest-priority active ownership record per livestock ID so
 * Herd Registry cards and tables can badge non-farm-owned animals clearly.
 */
export function getPrimaryOwnershipByLivestockMap(
  ownerships: readonly AnimalOwnership[]
): Map<string, AnimalOwnership> {
  const result = new Map<string, AnimalOwnership>();
  const sorted = [...ownerships].sort((a, b) => {
    const aActive = a.status === 'active' ? 1 : 0;
    const bActive = b.status === 'active' ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;

    const aExternal = a.ownershipCategory !== 'farm_owned' ? 1 : 0;
    const bExternal = b.ownershipCategory !== 'farm_owned' ? 1 : 0;
    if (aExternal !== bExternal) return bExternal - aExternal;

    return b.updatedAt - a.updatedAt;
  });

  for (const row of sorted) {
    if (!result.has(row.livestockId)) {
      result.set(row.livestockId, row);
    }
  }

  return result;
}
