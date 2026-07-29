// Port of Core/Sources/SwingComparison/SwingComparator.swift.

function makeDelta(name, referenceValue, candidateValue) {
  const difference = candidateValue - referenceValue;
  const percentDifference = referenceValue !== 0 ? (difference / referenceValue) * 100 : null;
  return { name, referenceValue, candidateValue, difference, percentDifference };
}

export function compareSwings(candidate, reference) {
  const deltas = [makeDelta("peakHandSpeed", reference.peakHandSpeed, candidate.peakHandSpeed)];

  if (reference.launchToContactDuration != null && candidate.launchToContactDuration != null) {
    deltas.push(makeDelta("launchToContactDuration", reference.launchToContactDuration, candidate.launchToContactDuration));
  }

  const refHold = reference.separationTiming?.topHoldDuration;
  const candHold = candidate.separationTiming?.topHoldDuration;
  if (refHold != null && candHold != null) {
    deltas.push(makeDelta("topHoldDuration", refHold, candHold));
  }

  const refDist = reference.separationTiming?.topToFrontFootDistance;
  const candDist = candidate.separationTiming?.topToFrontFootDistance;
  if (refDist != null && candDist != null) {
    deltas.push(makeDelta("topToFrontFootDistance", refDist, candDist));
  }

  return { deltas };
}
