export function arrayMove<T>(array: readonly T[], fromIndex: number, toIndex: number): T[] {
  const result = array.slice();
  const [removed] = result.splice(fromIndex, 1);
  if (removed === undefined) {
    return result;
  }
  const targetIndex = toIndex < 0 ? 0 : toIndex > result.length ? result.length : toIndex;
  result.splice(targetIndex, 0, removed);
  return result;
}
