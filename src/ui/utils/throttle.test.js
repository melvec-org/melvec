import throttle from './throttle';

describe('throttle', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('calls the wrapped function immediately on the first call', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled('first');

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('first');
    });

    test('suppresses additional calls before the limit expires', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled('first');
        throttled('second');
        throttled('third');

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('first');
    });

    test('runs one trailing call with the latest suppressed arguments after the limit expires', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled('first');
        throttled('second');
        throttled('third');

        jest.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenNthCalledWith(1, 'first');
        expect(fn).toHaveBeenNthCalledWith(2, 'third');
    });

    test('does not run a trailing call when there were no suppressed calls', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled('first');
        jest.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('allows a new immediate call after the throttle window completes', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled('first');
        jest.advanceTimersByTime(100);
        throttled('second');

        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenNthCalledWith(1, 'first');
        expect(fn).toHaveBeenNthCalledWith(2, 'second');
    });

    test('uses a default limit of 50ms', () => {
        const fn = jest.fn();
        const throttled = throttle(fn);

        throttled('first');
        throttled('second');

        jest.advanceTimersByTime(49);
        expect(fn).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenNthCalledWith(2, 'second');
    });

    test('preserves the calling context for the immediate call', () => {
        const context = {
            value: 42,
            fn: jest.fn(function () {
                return this.value;
            }),
        };
        context.throttled = throttle(context.fn, 100);

        context.throttled();

        expect(context.fn.mock.instances[0]).toBe(context);
    });
});
