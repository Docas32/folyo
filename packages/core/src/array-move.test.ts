import { describe, expect, it } from 'vitest';
import { arrayMove } from './array-move';

describe('arrayMove', () => {
  it('moves item forward', () => {
    const arr = [0, 1, 2, 3];
    expect(arrayMove(arr, 0, 2)).toEqual([1, 2, 0, 3]);
  });

  it('moves item backward', () => {
    const arr = [0, 1, 2, 3];
    expect(arrayMove(arr, 2, 0)).toEqual([2, 0, 1, 3]);
  });

  it('handles edge indices', () => {
    const arr = [0, 1, 2];
    expect(arrayMove(arr, 0, -1)).toEqual([0, 1, 2]); // stays at edge
    expect(arrayMove(arr, 2, 5)).toEqual([0, 1, 2]); // stays at edge
  });

  it('handles moving within bounds', () => {
    const arr = [0, 1, 2, 3];
    expect(arrayMove(arr, 1, 3)).toEqual([0, 2, 3, 1]);
  });
});

  it('moves forward and backward with edge indices', () => {
    const arr = ['a', 'b', 'c', 'd'];
    expect(arrayMove(arr, 0, 1)).toEqual(['b', 'a', 'c', 'd']); // move forward
    expect(arrayMove(arr, 1, 0)).toEqual(['b', 'a', 'c', 'd']); // move backward
    expect(arrayMove(['x', 'y'], 0, -5)).toEqual(['x', 'y']); // edge
    expect(arrayMove(['x', 'y'], 1, 10)).toEqual(['x', 'y']); // edge
  });
