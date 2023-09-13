import { deepClone } from '../src/deepClone.ts';

describe('Deep Clone', () => {
  it('should deep clone array of primitives', () => {
    const array = [1, 3, 5, 6];
    const newArray = deepClone(array);

    expect(newArray).not.toBe(array);
    newArray[2] = 20;
    expect(newArray[2]).not.toBe(array[2]);
  });

  it('should deep clone array with nested objects', () => {
    const array = [
      { id: '1', value: 10 },
      { id: '2', value: 20 },
      { id: '3', value: 30 }
    ];
    const newArray = deepClone(array);
    expect(newArray).not.toBe(array);
    expect(newArray[2].value).toBe(array[2].value);

    newArray[2].value = 200;
    expect(newArray[2].value).not.toBe(array[2].value);
  });

  it('should deep clone simple objects', () => {
    const obj = { id: '1', values: { item1: 10, item2: 20 } };
    const newObj = deepClone(obj);
    expect(newObj).not.toBe(obj);
    expect(newObj.values).not.toBe(obj.values);
    expect(newObj.values.item1).toBe(obj.values.item1);

    newObj.values.item1 = 200;
    expect(newObj.values.item1).not.toBe(obj.values.item1);
  });

  it('should not break on circular objects', () => {
    type CircularObj = {
      id: string;
      values: {
        item1: number;
        item2: number;
        circle: CircularObj | undefined;
      };
    };
    const obj: CircularObj = {
      id: '1',
      values: { item1: 10, item2: 20, circle: undefined }
    };
    obj.values.circle = obj;
    const newObj = deepClone(obj);
    expect(newObj).not.toBe(obj);
    expect(newObj.values).not.toBe(obj.values);
    expect(newObj.values.circle).not.toBe(obj.values.circle);
    expect(newObj.values.circle!.values.circle).not.toBe(
      obj.values.circle.values.circle
    );
    // Maintains circular reference in new clone
    expect(newObj.values.circle).toBe(newObj);
  });

  it('should not clone classes', () => {
    class SomeClass {
      public value = 5;
    }
    const obj = { id: '1', class: new SomeClass() };
    const newObj = deepClone(obj);
    expect(newObj).not.toBe(obj);
    expect(newObj.class).toBe(obj.class);
    expect(newObj.class.value).toBe(obj.class.value);

    newObj.class.value = 200;
    expect(newObj.class.value).toBe(obj.class.value);
  });
});
