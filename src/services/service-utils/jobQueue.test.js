const { createJobQueue } = require('./jobQueue');

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('createJobQueue', () => {
    test('should throw when processJob is not provided', () => {
        expect(() => {
            createJobQueue({
                progressHandler: () => {},
            });
        }).toThrow('JobQueue requires a processJob function.');
    });

    test('should throw when progressHandler is not provided', () => {
        expect(() => {
            createJobQueue({
                processJob: async () => {},
            });
        }).toThrow('JobQueue requires a progressHandler function.');
    });

    test('should start the first job immediately', async () => {
        const processJob = jest.fn().mockResolvedValue({ ok: true });
        const progressHandler = jest.fn();

        const queue = createJobQueue({ processJob, progressHandler });

        const response = queue.enqueue('job-1', { value: 1 });

        expect(response).toEqual({
            accepted: true,
            jobId: 'job-1',
            status: 'processing',
            queuePosition: null,
        });

        expect(queue.getStatus('job-1')).toEqual({
            jobId: 'job-1',
            status: 'processing',
            config: { value: 1 },
            result: null,
            error: null,
            queuePosition: null,
        });

        await flushPromises();

        expect(processJob).toHaveBeenCalledWith({ value: 1 }, 'job-1');
        expect(queue.getStatus('job-1')).toEqual({
            jobId: 'job-1',
            status: 'completed',
            config: { value: 1 },
            result: { ok: true },
            error: null,
            queuePosition: null,
        });
    });

    test('should queue the second job and process in FIFO order', async () => {
        let releaseFirstJob;
        const firstJobPromise = new Promise((resolve) => {
            releaseFirstJob = resolve;
        });

        const processJob = jest
            .fn()
            .mockImplementationOnce(() => firstJobPromise)
            .mockResolvedValueOnce({ ok: 'second' });

        const progressHandler = jest.fn();

        const queue = createJobQueue({ processJob, progressHandler });

        const firstResponse = queue.enqueue('job-1', { value: 1 });
        const secondResponse = queue.enqueue('job-2', { value: 2 });

        expect(firstResponse.status).toBe('processing');
        expect(secondResponse).toEqual({
            accepted: true,
            jobId: 'job-2',
            status: 'inQueue',
            queuePosition: 1,
        });

        expect(queue.getStatus('job-2')).toEqual({
            jobId: 'job-2',
            status: 'inQueue',
            config: { value: 2 },
            result: null,
            error: null,
            queuePosition: 1,
        });

        releaseFirstJob({ ok: 'first' });
        await flushPromises();
        await flushPromises();

        expect(processJob.mock.calls[0]).toEqual([{ value: 1 }, 'job-1']);
        expect(processJob.mock.calls[1]).toEqual([{ value: 2 }, 'job-2']);

        expect(queue.getStatus('job-1')).toEqual({
            jobId: 'job-1',
            status: 'completed',
            config: { value: 1 },
            result: { ok: 'first' },
            error: null,
            queuePosition: null,
        });

        expect(queue.getStatus('job-2')).toEqual({
            jobId: 'job-2',
            status: 'completed',
            config: { value: 2 },
            result: { ok: 'second' },
            error: null,
            queuePosition: null,
        });
    });

    test('should return processing for duplicate active job', () => {
        const processJob = jest.fn(() => new Promise(() => {}));
        const progressHandler = jest.fn();

        const queue = createJobQueue({ processJob, progressHandler });

        queue.enqueue('job-1', { value: 1 });
        const response = queue.enqueue('job-1', { value: 1 });

        expect(response).toEqual({
            accepted: false,
            jobId: 'job-1',
            status: 'processing',
            queuePosition: null,
        });
    });

    test('should return inQueue for duplicate queued job', () => {
        const processJob = jest.fn(() => new Promise(() => {}));
        const progressHandler = jest.fn();

        const queue = createJobQueue({ processJob, progressHandler });

        queue.enqueue('job-1', { value: 1 });
        queue.enqueue('job-2', { value: 2 });

        const response = queue.enqueue('job-2', { value: 2 });

        expect(response).toEqual({
            accepted: false,
            jobId: 'job-2',
            status: 'inQueue',
            queuePosition: 1,
        });
    });

    test('should mark failed job when processJob throws', async () => {
        const processJob = jest.fn().mockRejectedValue(new Error('boom'));
        const progressHandler = jest.fn();

        const queue = createJobQueue({ processJob, progressHandler });

        queue.enqueue('job-1', { value: 1 });

        await flushPromises();

        expect(queue.getStatus('job-1')).toEqual({
            jobId: 'job-1',
            status: 'failed',
            config: { value: 1 },
            result: null,
            error: 'boom',
            queuePosition: null,
        });
    });

    test('should remove a queued job when cancelled', async () => {
        const processJob = jest.fn(() => new Promise(() => {}));
        const progressHandler = jest.fn();

        const queue = createJobQueue({ processJob, progressHandler });

        queue.enqueue('job-1', { value: 1 });
        queue.enqueue('job-2', { value: 2 });

        const response = await queue.cancel('job-2');

        expect(response).toEqual({
            jobId: 'job-2',
            status: 'cancelled',
            cancelled: true,
        });

        expect(queue.getStatus('job-2')).toBeNull();
    });

    test('should not cancel an active job when stopJob is not provided', async () => {
        const processJob = jest.fn(() => new Promise(() => {}));
        const progressHandler = jest.fn();

        const queue = createJobQueue({ processJob, progressHandler });

        queue.enqueue('job-1', { value: 1 });

        const response = await queue.cancel('job-1');

        expect(response).toEqual({
            jobId: 'job-1',
            status: 'processing',
            cancelled: false,
        });
    });

    test('should remove an active job when cancelled with stopJob', async () => {
        let releaseJob;
        const processJob = jest.fn(
            () =>
                new Promise((resolve) => {
                    releaseJob = resolve;
                }),
        );
        const stopJob = jest.fn().mockResolvedValue(undefined);
        const progressHandler = jest.fn();

        const queue = createJobQueue({ processJob, stopJob, progressHandler });

        queue.enqueue('job-1', { value: 1 });

        await flushPromises();

        const response = await queue.cancel('job-1');

        expect(response).toEqual({
            jobId: 'job-1',
            status: 'cancelled',
            cancelled: true,
        });

        expect(stopJob).toHaveBeenCalledWith({ value: 1 }, 'job-1');
        expect(queue.getStatus('job-1')).toBeNull();

        releaseJob({ done: true });
        await flushPromises();
        await flushPromises();

        expect(queue.getStatus('job-1')).toBeNull();
    });

    test('should emit lifecycle events in order', async () => {
        const processJob = jest.fn().mockResolvedValue({ done: true });
        const progressHandler = jest.fn();

        const queue = createJobQueue({ processJob, progressHandler });

        queue.enqueue('job-1', { value: 1 });

        await flushPromises();

        expect(progressHandler).toHaveBeenNthCalledWith(1, {
            jobId: 'job-1',
            status: 'inQueue',
            config: { value: 1 },
            result: null,
            error: null,
            queuePosition: 1,
        });

        expect(progressHandler).toHaveBeenNthCalledWith(2, {
            jobId: 'job-1',
            status: 'processing',
            config: { value: 1 },
            result: null,
            error: null,
            queuePosition: null,
        });

        expect(progressHandler).toHaveBeenNthCalledWith(3, {
            jobId: 'job-1',
            status: 'completed',
            config: { value: 1 },
            result: { done: true },
            error: null,
            queuePosition: null,
        });
    });

    test('should return all tracked jobs', async () => {
        let releaseFirstJob;
        const firstJobPromise = new Promise((resolve) => {
            releaseFirstJob = resolve;
        });

        const processJob = jest
            .fn()
            .mockImplementationOnce(() => firstJobPromise)
            .mockResolvedValueOnce({ ok: true });

        const progressHandler = jest.fn();

        const queue = createJobQueue({ processJob, progressHandler });

        queue.enqueue('job-1', { value: 1 });
        queue.enqueue('job-2', { value: 2 });

        const jobsWhileRunning = queue.getAllJobs();

        expect(jobsWhileRunning).toEqual([
            {
                jobId: 'job-1',
                status: 'processing',
                config: { value: 1 },
                result: null,
                error: null,
                queuePosition: null,
            },
            {
                jobId: 'job-2',
                status: 'inQueue',
                config: { value: 2 },
                result: null,
                error: null,
                queuePosition: 1,
            },
        ]);

        releaseFirstJob({ ok: 'first' });
        await flushPromises();
        await flushPromises();

        const jobsAfterCompletion = queue.getAllJobs();

        expect(jobsAfterCompletion).toEqual([
            {
                jobId: 'job-1',
                status: 'completed',
                config: { value: 1 },
                result: { ok: 'first' },
                error: null,
                queuePosition: null,
            },
            {
                jobId: 'job-2',
                status: 'completed',
                config: { value: 2 },
                result: { ok: true },
                error: null,
                queuePosition: null,
            },
        ]);
    });

    test('should return null for unknown job status', () => {
        const processJob = jest.fn().mockResolvedValue({ ok: true });
        const progressHandler = jest.fn();

        const queue = createJobQueue({ processJob, progressHandler });

        expect(queue.getStatus('missing-job')).toBeNull();
    });

    test('should return cancelled false when cancelling an unknown job', async () => {
        const processJob = jest.fn().mockResolvedValue({ ok: true });
        const progressHandler = jest.fn();

        const queue = createJobQueue({ processJob, progressHandler });

        await expect(queue.cancel('missing-job')).resolves.toEqual({
            jobId: 'missing-job',
            cancelled: false,
        });
    });
});