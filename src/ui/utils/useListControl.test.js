// Modified unit test code
import { getPreviousSelectionId } from './useListControl';
it('should cycle backward in a list', () => {
    const list = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' },
    ];
    const selectedItem = list[1];

    const previousSelection = getPreviousSelectionId(list, selectedItem);

    expect(previousSelection).toEqual(list[0]);
});

test('Should return the second item when the selected item is the third item in the list', () => {
    const list = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const selectedItem = { id: 3 };

    const expectedResult = { id: 2 };

    expect(getPreviousSelectionId(list, selectedItem)).toEqual(expectedResult);
});
