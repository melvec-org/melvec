// create and function that can sort an array of objects based on a given property and sorting order as asc or desc
function sortBy(arr, property, order = 'asc') {
    // sort the array based on the given property
    const sortedArr = arr.sort((a, b) => {
        if (a[property] < b[property]) {
            return order === 'asc' ? -1 : 1;
        }
        if (a[property] > b[property]) {
            return order === 'asc' ? 1 : -1;
        }
        return 0;
    });

    return sortedArr;
}

export default sortBy;
