const timeout = require('./timeout');

describe('timeout', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    test('resolves after the requested delay', async () => {
        jest.useFakeTimers();

        const callback = jest.fn();
        const promise = timeout(100).then(callback);

        jest.advanceTimersByTime(99);
        await Promise.resolve();
        expect(callback).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        await promise;
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('resolves for a zero delay once timers are flushed', async () => {
        jest.useFakeTimers();

        const callback = jest.fn();
        const promise = timeout(0).then(callback);

        jest.runAllTimers();
        await promise;

        expect(callback).toHaveBeenCalledTimes(1);
    });
});
