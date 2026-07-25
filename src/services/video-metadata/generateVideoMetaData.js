const fs = require('fs');
const os = require('os');
const path = require('path');
const { run, runStoppable, createKillHandle } = require('../service-utils/process');
const { getModelPath } = require('../ai-models/models');
const { MAX_DESCRIPTION_LENGTH } = require('../../configs/appConfig');
const { VIDEO_CATEGORIES } = require('../../configs/categories');

const NO_VIDEO_STREAM_ERROR = 'NO_VIDEO_STREAM';
const { probeVideoFile } = require('../service-utils/probeVideoFile');

const { getAudioTranscript } = require('./generateTranscript');
const { generateEmbedding } = require('../service-utils/generateEmbedding');
const { getFfmpegPath, getLlamaCompletionBinaryPath, getLlamaMtmdBinaryPath } = require('../service-utils/binaryPaths');
const { logLibraryError } = require('../logs/logService');

const runningJobs = new Map();

const getFrameInterval = (totalDurationSec = 0) => {
    if (!Number.isFinite(totalDurationSec) || totalDurationSec <= 0) {
        return 3;
    }

    if (totalDurationSec < 10) {
        return Math.max(1, Math.round(totalDurationSec / 2));
    }

    if (totalDurationSec < 30) {
        return 5;
    }

    if (totalDurationSec <= 60) {
        return 10;
    }

    const targetFrames = 8;
    const interval = Math.ceil(totalDurationSec / targetFrames);

    return Math.max(10, Math.min(120, interval));
};

/**
 * sceneThreshold is kept at 0.3 this is moderate to check scene change score.
 * Do't go beyond ~0.5/0.6 which will have big cuts
 * and only few frames selected - we may loose important information.
 *
 * Max frames to limit frames to max 24 which runs perfectly fine for videos till 30mins.
 * For lenghier videos, we will see in to add some more dynamic value
 * - but more the frames, more time it would take to analyse.
 * @param {``} videoPath
 * @param {*} opts
 * @returns
 */
const extractSceneFrames = async (videoPath, opts = {}) => {
    const { hasVideo, durationSec: probedDuration } = await probeVideoFile(videoPath);
    if (!hasVideo) {
        const err = new Error(`No video stream found in: ${videoPath}`);
        err.code = NO_VIDEO_STREAM_ERROR;
        throw err;
    }

    const defaultOptions = {
        sceneThreshold: 0.18,
        maxFrames: 24,
        maxImageWidth: 640,
        minSceneFrames: 2,
    };

    const sceneThreshold = Number(opts.sceneThreshold ?? defaultOptions.sceneThreshold);
    const maxFrames = Number(opts.maxFrames ?? defaultOptions.maxFrames);
    const maxImageWidth = Number(opts.maxImageWidth ?? defaultOptions.maxImageWidth);
    const minSceneFrames = Number(opts.minSceneFrames ?? defaultOptions.minSceneFrames);

    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-frames-'));
    const framesPattern = path.join(tmpDir, 'keyframe_%04d.jpg');

    const listFrames = async () => {
        return (await fs.promises.readdir(tmpDir))
            .filter((f) => /^keyframe_\d+\.jpg$/.test(f))
            .sort()
            .map((f) => path.join(tmpDir, f));
    };

    const cleanupTmpDir = async () => {
        try {
            await fs.promises.rm(tmpDir, { recursive: true, force: true });
        } catch (_) {
            logLibraryError(`Error cleaning up tmp directory: ${tmpDir}`);
        }
    };
    const ffmpegPath = getFfmpegPath();

    try {
        // Pass 1: scene change based keyframes
        try {
            await run(ffmpegPath, [
                '-y',
                '-i',
                videoPath,
                '-vf',
                `blackframe=amount=98:threshold=32,select='gt(scene,${sceneThreshold})*lt(lavfi.blackframe.pblack,98)',scale=${maxImageWidth}:-1`,
                '-fps_mode',
                'vfr',
                '-q:v',
                '2',
                framesPattern,
            ]);
        } catch (e) {
            // now we don't have any frames to work with, so we need to fall back to time-based sampling.
        }

        let allFrames = await listFrames();

        // If scene detection produced zero frames OR too few frames, fallback to time-based sampling.
        if (allFrames.length < minSceneFrames) {
            //  optimize fps based on video duration
            const intervalSec = getFrameInterval(probedDuration);

            // Pass 2: time-based sampling
            await run(ffmpegPath, [
                '-y',
                '-i',
                videoPath,
                '-vf',
                `fps=1/${intervalSec},scale=${maxImageWidth}:-1`,
                '-frames:v',
                String(maxFrames),
                '-q:v',
                '2',
                framesPattern,
            ]);

            allFrames = await listFrames();
        }

        if (allFrames.length === 0) {
            await cleanupTmpDir();
            throw new Error(
                `No frames extracted (sceneThreshold=${sceneThreshold}). Try lowering VIDEO_SCENE_THRESHOLD (e.g. 0.2 or 0.15), or ensure the video decodes correctly.`,
            );
        }

        const step = Math.max(1, Math.ceil(allFrames.length / maxFrames));
        const frames = allFrames.filter((_, idx) => idx % step === 0).slice(0, maxFrames);

        return { tmpDir, frames, allFramesCount: allFrames.length };
    } catch (e) {
        await cleanupTmpDir();
        throw e;
    }
};

const dynamicAnalysisParams = {
    basic: {
        '-n': '4000',
        '-c': '4096',
    },
    standard: {
        '-n': '6000',
        '-c': '8192',
    },
    advanced: {
        '-n': '6000',
        '-c': '8192',
    },
};

const analyseVideo = async (videoId, videoPath, modelTier) => {
    let tmpDir = '';
    let frames = [];

    try {
        ({ tmpDir, frames } = await extractSceneFrames(videoPath));

        const llamaMtmdBinaryPath = getLlamaMtmdBinaryPath();
        const modelPath = getModelPath('slmModel');
        const projPath = getModelPath('slmProjector');

        const prompt = [
            'Write a concise, searchable description of the video based on these sampled frames.',
            'Do NOT repeat the same fact.',
            'Focus on visible subjects, actions, setting, and important objects or text.',
            "If you are uncertain, say 'unclear' rather than guessing.",
            'Output ONLY the summary paragraph (no labels, no bullets, no quotes).',
            'Do not mention camera work, editing, or what is not shown.',
            `Return one natural paragraph under ${MAX_DESCRIPTION_LENGTH} characters.`,
        ].join('\n');

        const paramsByTier = dynamicAnalysisParams[modelTier];

        const args = [
            '-m',
            modelPath,
            '--mmproj',
            projPath,
            '--image',
            frames.join(','),
            '-p',
            prompt,
            '--temp',
            '0.2',
            '--top-p',
            '0.9',
            '--repeat-penalty',
            '1.2',
            '-n',
            paramsByTier['-n'],
            '-c',
            paramsByTier['-c'],
        ];
        let stdout = '';
        try {
            ({ stdout } = await runStoppable(llamaMtmdBinaryPath, args, {
                stdin: '',
                onSpawn: (child) => {
                    if (!videoId) return;
                    runningJobs.set(videoId, createKillHandle(child));
                },
            }));
        } finally {
            if (videoId) runningJobs.delete(videoId);
        }

        return stdout.replace(/\n?>\s*EOF by user\s*$/i, '').trim();
    } finally {
        if (tmpDir) {
            try {
                await fs.promises.rm(tmpDir, { recursive: true, force: true });
            } catch (e) {
                logLibraryError(`Failed to clean up temporary directory: ${tmpDir}`);
            }
        }
    }
};

const fuseSummaries = async (videoId, audioSummary, visualSummary) => {
    const normalizedAudioSummary = typeof audioSummary === 'string' ? audioSummary.trim() : '';
    const normalizedVisualSummary = typeof visualSummary === 'string' ? visualSummary.trim() : '';

    if (!normalizedAudioSummary) {
        return normalizedVisualSummary;
    }

    if (!normalizedVisualSummary) {
        return normalizedAudioSummary;
    }

    const llamaCompletionBinaryPath = getLlamaCompletionBinaryPath();
    const modelPath = getModelPath('slmModel');
    const prompt = [
        'You are an expert summarizer that combines audio transcript and visual summary extracted from a video.',
        'Hard rules:',
        '- Prefer the AUDIO summary for dialogue, intent, tone, and conversational details (who said what, questions/answers, decisions).',
        '- Prefer the VISUAL summary for actions, setting, objects, on-screen text, and who is present.',
        "- Do NOT drop conversational keywords or speech acts (e.g., 'asks', 'replies', 'agrees', 'argues', 'apologizes', 'jokes', 'explains', 'warns').",
        '- If there is a conflict between audio and visuals, do not mention it.',

        'Soft rules:',
        '- Use a mix of both summaries, but focus on the most relevant parts.',
        '- Prefer the combined summary to any single summary.',
        '- If there are multiple conflicting parts, combine them into a coherent sentence or phrase.',
        '- If there is no visual summary, just use the audio summary.',

        '',
        'Output format:',
        'Include only the most relevant parts from both the audio and visual summaries.',
        'Ensure the summary is concise, specific, free of errors, and no repetition.',
        'Do not use labels, bullet points, or quotes.',
        'If you are uncertain, say "unclear" rather than guessing.',
        'Max 1500 characters. concise, specific, free of errors, no repetition.',
        '',
        `Audio summary: ${normalizedAudioSummary}`,
        '',
        `Visual summary: ${normalizedVisualSummary}`,
        '',
        'Combined summary:',
    ];

    const args = [
        '-m',
        modelPath,
        '-c',
        '4096',
        '--temp',
        '0.2',
        '--top-p',
        '0.9',
        '--repeat-penalty',
        '1.2',
        '-n',
        '8000',
        '-p',
        prompt,
        '--no-display-prompt',
    ];
    const { stdout } = await runStoppable(llamaCompletionBinaryPath, args, {
        stdin: '',
        onSpawn: (child) => {
            if (!videoId) return;
            runningJobs.set(videoId, createKillHandle(child));
        },
    });

    if (videoId) runningJobs.delete(videoId);

    return stdout.replace(/\n?>\s*EOF by user\s*$/i, '').trim();
};

const normalizeDescriptionSummary = async (videoId, summaryText) => {
    const llamaCompletionBinaryPath = getLlamaCompletionBinaryPath();
    const modelPath = getModelPath('slmModel');
    const prompt = [
        'Create one short normalized summary for embedding and retrieval from the input video summary.',
        'This is a literal normalization task, not a creative writing task.',
        'Return ONLY the normalized summary text.',
        '',
        'Internal extraction rules:',
        '- First identify these categories from the input: entities, scene, activities, attributes.',
        '- entities = visible people, objects, animals, text, or notable things explicitly mentioned.',
        '- scene = place, environment, setting, background, or visible context explicitly mentioned.',
        '- activities = visible actions, events, or interactions explicitly mentioned.',
        '- attributes = colors, clothing, lighting, appearance, and concrete descriptors explicitly mentioned.',
        '',
        'Summary construction rules:',
        '- Build the normalized summary only from details found in those categories.',
        '- Prefer explicit, searchable nouns and verbs.',
        '- Keep specific details when present.',
        '- Keep wording literal and concise.',
        '- Do not invent, infer, embellish, or generalize.',
        '- Do not introduce details not supported by the input.',
        '- Do not use labels, bullet points, quotes, markdown, or JSON.',
        '- Do not repeat facts.',
        '- If uncertain, omit rather than guess.',
        '- Maximum 30 words.',
        '',
        `Input summary: ${summaryText.trim()}`,
        '',
        'Normalized summary:',
    ].join('\n');

    const args = [
        '-m',
        modelPath,
        '-c',
        '4096',
        '--temp',
        '0.0',
        '--top-p',
        '0.8',
        '--repeat-penalty',
        '1.05',
        '-n',
        '1000',
        '-p',
        prompt,
        '--no-display-prompt',
    ];

    const { stdout } = await runStoppable(llamaCompletionBinaryPath, args, {
        stdin: '',
        onSpawn: (child) => {
            if (!videoId) return;
            runningJobs.set(videoId, createKillHandle(child));
        },
    });

    if (videoId) runningJobs.delete(videoId);

    return stdout.replace(/\n?>\s*EOF by user\s*$/i, '').trim();
};

const generateFallbackTitle = async (videoId, summaryText) => {
    const llamaCompletionBinaryPath = getLlamaCompletionBinaryPath();
    const modelPath = getModelPath('slmModel');
    const normalizedSummaryText = typeof summaryText === 'string' ? summaryText.trim() : '';
    const prompt = [
        'Create one short, specific, natural video title from the input summary.',
        'This is a literal title generation task, not a creative writing task.',
        'Return ONLY the title text.',
        '',
        'Rules:',
        '- Use only details explicitly supported by the input summary.',
        '- Keep it concise, clear, and searchable.',
        '- Prefer concrete nouns and actions.',
        '- Capitalize only the first word and any true proper nouns.',
        '- Do not invent names, places, or events.',
        '- Do not use clickbait, hashtags, emojis, quotes, labels, or punctuation decoration.',
        '- Do not output multiple options.',
        '- Maximum 12 words.',
        '',
        `Input summary: ${normalizedSummaryText}`,
        '',
        'Title:',
    ].join('\n');

    const args = [
        '-m',
        modelPath,
        '-c',
        '4096',
        '--temp',
        '0.1',
        '--top-p',
        '0.8',
        '--repeat-penalty',
        '1.05',
        '-n',
        '200',
        '-p',
        prompt,
        '--no-display-prompt',
    ];

    const { stdout } = await runStoppable(llamaCompletionBinaryPath, args, {
        stdin: '',
        onSpawn: (child) => {
            if (!videoId) return;
            runningJobs.set(videoId, createKillHandle(child));
        },
    });

    if (videoId) runningJobs.delete(videoId);

    return stdout.replace(/\n?>\s*EOF by user\s*$/i, '').trim();
};

const generateEmbeddingsFromDescription = async (videoId, description) => {
    const normalizedDescription = await normalizeDescriptionSummary(videoId, description);
    const embedding = await generateEmbedding(normalizedDescription, { jobKey: videoId, runningJobs });

    return {
        normalizedDescription: normalizedDescription,
        embedding: embedding,
    };
};

/**
 * Predicts the category of a video from its description using a local SLM.
 * Only returns a result when the match confidence meets or exceeds 90%.
 *
 * Confidence is derived from match quality rather than a model-reported score,
 * because small models are unreliable at self-reporting calibrated probabilities:
 *   - Exact match (case-insensitive) → confidence 1.0
 *   - Fuzzy match (category label found anywhere in the output) → confidence 0.9
 *   - No recognisable category found → returns null
 *
 * @param {string}   videoId         - Active job ID used to register a kill handle for cancellation.
 * @param {string}   description     - The video description to classify.
 * @param {string[]} videoCategories - The allowed category labels to classify into.
 * @returns {Promise<{ category: string, confidence: number } | null>}
 */
const getCategoryFromDescription = async (videoId, description, videoCategories) => {
    // Step 1: Resolve the paths for the llama.cpp completion binary and the SLM model.
    const llamaCompletionBinaryPath = getLlamaCompletionBinaryPath();
    const modelPath = getModelPath('slmModel');

    // Step 2: Build the classification prompt.
    // The allowed category list is injected inline so the model can only pick from it.
    // Instructing the model to fall back to "Others" when uncertain steers output
    // to a known label and avoids free-form responses that fail to match.
    const prompt = [
        'You are an advanced media organization bot. Analyse the following video description and map it to exactly ONE of these categories.',
        `${videoCategories.join(', ')}`,
        `Video description: ${description}`,
        'Hard rules:',
        '- Respond with only the exact category string from the allowed list.',
        '- Do not include punctuation, markdown formatting, or any introductory phrases.',
        '- If you are not sure, respond with: Others',
    ].join('\n');

    // Step 3: Configure llama.cpp inference arguments.
    // Low temperature (0.1) and top-p (0.1) make the output near-deterministic.
    // repeat-penalty (1.2) discourages the model from echoing the prompt back.
    // -n 12 is sufficient for the longest label ("Shows & Series" ≈ 5 tokens) with headroom.
    const args = [
        '-m',
        modelPath,
        '-c',
        '4096',
        '--temp',
        '0.1',
        '--top-p',
        '0.1',
        '--repeat-penalty',
        '1.2',
        '-n',
        '12',
        '-p',
        prompt,
        '--no-display-prompt',
    ];

    // Step 4: Run the model as a child process.
    // The kill handle is registered against videoId so the job can be cancelled
    // externally via stopGeneratingVideoMetadata. The finally block ensures the
    // handle is always cleaned up even if runStoppable throws.
    let stdout = '';
    try {
        ({ stdout } = await runStoppable(llamaCompletionBinaryPath, args, {
            stdin: '',
            onSpawn: (child) => {
                if (!videoId) return;
                runningJobs.set(videoId, createKillHandle(child));
            },
        }));
    } finally {
        if (videoId) runningJobs.delete(videoId);
    }

    // Step 5: Strip llama.cpp boilerplate from stdout and normalise whitespace.
    const raw = stdout.replace(/\n?>?\s*EOF by user\s*$/i, '').trim();

    // Step 6: Exact match — the model returned the category label verbatim.
    // This is the expected happy path; assign confidence 1.0.
    const exactMatch = videoCategories.find((cat) => cat.toLowerCase() === raw.toLowerCase());
    if (exactMatch) {
        return { category: exactMatch, confidence: 1.0 };
    }

    // Step 7: Fuzzy fallback — the model may have wrapped the label in extra words
    // (e.g. "Category: Sports & Games"). Search for the longest known label that
    // appears verbatim anywhere inside the output. Sorting longest-first prevents
    // a shorter label (e.g. "Sports") shadowing the correct "Sports & Games".
    const rawLower = raw.toLowerCase();
    const fuzzyMatch = videoCategories.filter((cat) => rawLower.includes(cat.toLowerCase())).sort((a, b) => b.length - a.length)[0];

    if (fuzzyMatch) {
        // Treat a fuzzy match as 0.9 confidence — meets the 90% threshold but
        // signals the model deviated from the expected output format.
        return { category: fuzzyMatch, confidence: 0.9 };
    }

    // Step 8: No recognisable category in the output — return null so the caller
    // stores an empty category rather than a hallucinated one.
    return null;
};

/**
 * This analyses the video, and then if audio transcript is given then
 * it would fuse the summary to make the visual summary meaningful
 */
const generateVideoMetadata = async (videoId, videoPath, modelTier, shouldGenerateTitle = false) => {
    const audioTranscriptRaw = await getAudioTranscript(videoId, videoPath);

    let visualSummaryRaw = '';
    try {
        visualSummaryRaw = await analyseVideo(videoId, videoPath, modelTier);
    } catch (e) {
        if (e.code !== NO_VIDEO_STREAM_ERROR) throw e;
        // audio-only MP4 — skip visual analysis, fall through to audio-only path
        if (!audioTranscriptRaw) return null; // nothing to work with, skip entirely
    }

    const audioTranscript = typeof audioTranscriptRaw === 'string' ? audioTranscriptRaw.trim() : '';
    const visualSummary = typeof visualSummaryRaw === 'string' ? visualSummaryRaw.trim() : '';
    const finalSummary = !audioTranscript ? visualSummary : await fuseSummaries(videoId, audioTranscript, visualSummary);

    const videoCategories = VIDEO_CATEGORIES.map((item) => item.label);
    const categoryResult = await getCategoryFromDescription(videoId, finalSummary, videoCategories);

    const generatedTitle = shouldGenerateTitle ? await generateFallbackTitle(videoId, finalSummary) : '';
    const normalizedDescription = await normalizeDescriptionSummary(videoId, finalSummary);
    const embedding = await generateEmbedding(normalizedDescription, { jobKey: videoId, runningJobs });

    // getCategoryFromDescription already returns null when confidence < 0.9,
    // so a non-null result always carries a confident match.
    const confirmedCategory = categoryResult ? categoryResult.category : null;

    const confirmedCategoryId = categoryResult ? VIDEO_CATEGORIES.find((item) => item.label === confirmedCategory).id : null;

    const finalMetaData = {
        generatedTitle: generatedTitle,
        description: finalSummary,
        normalizedDescription: normalizedDescription,
        embedding: embedding,
        audioTranscript: audioTranscript,
        categoryId: confirmedCategoryId,
    };

    return finalMetaData;
};

const stopGeneratingVideoMetadata = async (videoId) => {
    const job = runningJobs.get(videoId);

    if (!job) return true;

    try {
        await job.kill();
    } finally {
        runningJobs.delete(videoId);
    }

    return true;
};

module.exports = {
    extractSceneFrames,
    generateVideoMetadata,
    stopGeneratingVideoMetadata,
    generateEmbeddingsFromDescription,
};
