const jobQueueStatus = Object.freeze({
    IN_QUEUE: 'inQueue',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
});

/**
 * Create a single-worker FIFO job queue.
 *
 * The queue guarantees:
 * - only one job executes at a time
 * - jobs execute in FIFO order
 * - duplicate jobIds are not re-enqueued
 * - lifecycle updates are emitted through progressHandler
 *
 * Job lifecycle statuses:
 * - inQueue
 * - processing
 * - completed
 * - failed
 * - cancelled
 *
 * @param {Object} params
 * @param {Function} params.processJob
 * Async function that performs the work for a job.
 * Signature: async (config, jobId) => result
 *
 * @param {Function} [params.stopJob]
 * Optional function used to stop an actively processing job.
 * Signature: async (config, jobId) => void
 *
 * @param {Function} params.progressHandler
 * Function called whenever a job changes status.
 * Signature: ({ jobId, status, config, result, error, queuePosition }) => void
 *
 * @returns {Object}
 * Queue API:
 * - enqueue(jobId, config)
 * - getStatus(jobId)
 * - cancel(jobId)
 * - getAllJobs()
 */
const createJobQueue = ({ processJob, stopJob, progressHandler }) => {
    if (typeof processJob !== 'function') {
        throw new Error('JobQueue requires a processJob function.');
    }

    if (stopJob != null && typeof stopJob !== 'function') {
        throw new Error('JobQueue stopJob must be a function when provided.');
    }

    if (typeof progressHandler !== 'function') {
        throw new Error('JobQueue requires a progressHandler function.');
    }

    const queuedJobs = [];
    const queuedJobIds = new Set();
    const jobStates = new Map();

    let activeJob = null;

    const emit = (payload) => {
        progressHandler({
            jobId: payload.jobId,
            status: payload.status,
            config: payload.config ?? null,
            result: payload.result ?? null,
            error: payload.error ?? null,
            queuePosition: payload.queuePosition ?? null,
        });
    };

    const getQueuePosition = (jobId) => {
        const index = queuedJobs.findIndex((job) => job.jobId === jobId);
        return index === -1 ? null : index + 1;
    };

    const processNext = () => {
        if (activeJob || queuedJobs.length === 0) {
            return;
        }

        const nextJob = queuedJobs.shift();

        if (!nextJob) {
            return;
        }

        queuedJobIds.delete(nextJob.jobId);
        activeJob = nextJob;

        jobStates.set(nextJob.jobId, {
            status: jobQueueStatus.PROCESSING,
            config: nextJob.config,
            result: null,
            error: null,
        });

        emit({
            jobId: nextJob.jobId,
            status: jobQueueStatus.PROCESSING,
            config: nextJob.config,
        });

        // Snapshot the job reference so all promise callbacks refer to
        // this specific job run, regardless of what activeJob becomes later
        const jobSnapshot = nextJob;

        Promise.resolve()
            .then(() => processJob(jobSnapshot.config, jobSnapshot.jobId))
            .then((result) => {
                if (activeJob?.jobId !== jobSnapshot.jobId) {
                    return;
                }

                jobStates.set(jobSnapshot.jobId, {
                    status: jobQueueStatus.COMPLETED,
                    config: jobSnapshot.config,
                    result,
                    error: null,
                });

                emit({
                    jobId: jobSnapshot.jobId,
                    status: jobQueueStatus.COMPLETED,
                    config: jobSnapshot.config,
                    result,
                });
            })
            .catch((error) => {
                if (activeJob?.jobId !== jobSnapshot.jobId) {
                    return;
                }

                const message = error?.message || String(error);

                jobStates.set(jobSnapshot.jobId, {
                    status: jobQueueStatus.FAILED,
                    config: jobSnapshot.config,
                    result: null,
                    error: message,
                });

                emit({
                    jobId: jobSnapshot.jobId,
                    status: jobQueueStatus.FAILED,
                    config: jobSnapshot.config,
                    error: message,
                });
            })
            .finally(() => {
                // Only clear activeJob if it's still this job —
                // cancel() may have already cleared it for a cancelled job
                if (activeJob && activeJob.jobId === jobSnapshot.jobId) {
                    activeJob = null;
                }

                processNext();
            });
    };

    const enqueue = (jobId, config = {}) => {
        if (!jobId) {
            throw new Error('jobId is required.');
        }

        if (activeJob && activeJob.jobId === jobId) {
            return {
                accepted: false,
                jobId,
                status: jobQueueStatus.PROCESSING,
                queuePosition: null,
            };
        }

        if (queuedJobIds.has(jobId)) {
            return {
                accepted: false,
                jobId,
                status: jobQueueStatus.IN_QUEUE,
                queuePosition: getQueuePosition(jobId),
            };
        }

        const job = { jobId, config };

        queuedJobs.push(job);
        queuedJobIds.add(jobId);

        jobStates.set(jobId, {
            status: jobQueueStatus.IN_QUEUE,
            config,
            result: null,
            error: null,
        });

        emit({
            jobId,
            status: jobQueueStatus.IN_QUEUE,
            config,
            queuePosition: getQueuePosition(jobId),
        });

        processNext();

        const isNowActive = activeJob && activeJob.jobId === jobId;

        return {
            accepted: true,
            jobId,
            status: isNowActive ? jobQueueStatus.PROCESSING : jobQueueStatus.IN_QUEUE,
            queuePosition: isNowActive ? null : getQueuePosition(jobId),
        };
    };

    const getStatus = (jobId) => {
        const state = jobStates.get(jobId);

        if (!state) {
            return null;
        }

        return {
            jobId,
            status: state.status,
            config: state.config,
            result: state.result ?? null,
            error: state.error ?? null,
            queuePosition: state.status === jobQueueStatus.IN_QUEUE ? getQueuePosition(jobId) : null,
        };
    };

    const cancel = async (jobId) => {
        if (activeJob && activeJob.jobId === jobId) {
            if (typeof stopJob !== 'function') {
                return {
                    jobId,
                    status: jobQueueStatus.PROCESSING,
                    cancelled: false,
                };
            }

            const currentActiveJob = activeJob;

            await Promise.resolve(stopJob(currentActiveJob.config, currentActiveJob.jobId));

            // Only clear state after stopJob succeeds
            activeJob = null;
            jobStates.delete(jobId);

            emit({
                jobId,
                status: jobQueueStatus.CANCELLED,
                config: currentActiveJob.config,
            });

            // Advance the queue immediately rather than waiting for
            // the stalled processJob promise to eventually settle
            processNext();

            return {
                jobId,
                status: jobQueueStatus.CANCELLED,
                cancelled: true,
            };
        }

        if (queuedJobIds.has(jobId)) {
            const index = queuedJobs.findIndex((job) => job.jobId === jobId);

            if (index !== -1) {
                const [removedJob] = queuedJobs.splice(index, 1);

                queuedJobIds.delete(jobId);
                jobStates.delete(jobId);

                emit({
                    jobId,
                    status: jobQueueStatus.CANCELLED,
                    config: removedJob.config,
                });

                return {
                    jobId,
                    status: jobQueueStatus.CANCELLED,
                    cancelled: true,
                };
            }
        }

        return {
            jobId,
            cancelled: false,
        };
    };

    const getAllJobs = () => {
        return Array.from(jobStates.entries()).map(([jobId, state]) => ({
            jobId,
            status: state.status,
            config: state.config,
            result: state.result ?? null,
            error: state.error ?? null,
            queuePosition: state.status === jobQueueStatus.IN_QUEUE ? getQueuePosition(jobId) : null,
        }));
    };

    return {
        enqueue,
        getStatus,
        cancel,
        getAllJobs,
    };
};

module.exports = {
    createJobQueue,
    jobQueueStatus,
};
