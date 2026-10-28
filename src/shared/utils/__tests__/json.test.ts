import { parseJsonArray } from '../json';

describe('parseJsonArray', () => {
  it.each([null, '', '{', '{}', '1', '"x"', 'null', 'true'])('returns [] for %p', (value) => {
    expect(parseJsonArray(value)).toEqual([]);
  });

  it('returns arrays as they are', () => {
    expect(parseJsonArray('[]')).toEqual([]);
    expect(parseJsonArray('["a",1,null,{"b":2}]')).toEqual(['a', 1, null, { b: 2 }]);
  });
});
