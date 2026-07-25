const validateFileName = require('./validateFileName');

test('should trim down the file name', () => {
    // 196 chars
    expect(validateFileName('Jest can be used')).toBe('Jest can be used');

    // 256 chars
    expect(
        validateFileName(
            "Jest can be used in projects that use parcel-bundler to manage assets, styles, and compilation similar to webpacke Parcel requires zero configurationr Refer to the official docs to get started module for the version of Jest you're usinge This will help provide full typing when writing your tests with.jpg"
        )
    ).toBe(
        "Jest can be used in projects that use parcel-bundler to manage assets, styles, and compilation similar to webpacke Parcel requires zero configurationr Refer to the official docs to get started module for the version of Jest you're usinge This will help pro.jpg"
    );
});
