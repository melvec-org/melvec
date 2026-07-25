const debounce = require('./debounce');

describe('debounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('delays execution until the configured timeout has elapsed', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced('first');

        expect(fn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(99);
        expect(fn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('first');
    });

    test('only invokes the latest call after repeated rapid invocations', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced('first');
        debounced('second');
        debounced('third');

        jest.runAllTimers();

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('third');
    });

    test('preserves the calling context', () => {
        const obj = {
            value: 42,
            fn: jest.fn(function (suffix) {
                return `${this.value}-${suffix}`;
            }),
        };

        obj.debounced = debounce(obj.fn, 50);
        obj.debounced('done');

        jest.runAllTimers();

        expect(obj.fn.mock.instances[0]).toBe(obj);
        expect(obj.fn).toHaveBeenCalledWith('done');
    });
});
