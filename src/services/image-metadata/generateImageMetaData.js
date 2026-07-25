const { getModelPath, getModelTier } = require('../ai-models/models');
const { getLlamaMtmdBinaryPath, getLlamaCompletionBinaryPath } = require('../service-utils/binaryPaths');
const { generateEmbedding } = require('../service-utils/generateEmbedding');
const { runStoppable, createKillHandle } = require('../service-utils/process');

const runningJobs = new Map();

const dynamicAnalysisParams = {
    basic: {
        '-n': '4000',
        '-c': '4096',
    },
    standard: {
        '-n': '5000',
        '-c': '8192',
    },
    advanced: {
        '-n': '6000',
        '-c': '8192',
    },
};

const generateImageDescription = async (imageId, imagePath) => {
    try {
        const llamaMtmdBinaryPath = getLlamaMtmdBinaryPath();
        const modelPath = getModelPath('slmModel');
        const projPath = getModelPath('slmProjector');
        const modelTier = getModelTier();

        const prompt = [
            'Write a concise, searchable description of the image.',
            'Do NOT repeat the same fact.',
            'Focus on visible subjects, actions, setting, and important objects or text.',
            "If you are uncertain, say 'unclear' rather than guessing.",
            'Output ONLY the summary paragraph (no labels, no bullets, no quotes).',
            'Do not mention camera work or what is not shown.',
            'Return one natural paragraph under 1000 characters.',
        ].join('\n');

        const paramsByTier = dynamicAnalysisParams[modelTier];

        const args = [
            '-m',
            modelPath,
            '--mmproj',
            projPath,
            '--image',
            imagePath,
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
                    if (!imageId) return;
                    runningJobs.set(imageId, createKillHandle(child));
                },
            }));
        } finally {
            if (imageId) runningJobs.delete(imageId);
        }

        return stdout.replace(/\n?>\s*EOF by user\s*$/i, '').trim();
    } catch (error) {
        throw new Error(`Failed to generate description: ${error.message}`);
    }
};

const generateImageTitle = async (imageId, description) => {
    const llamaCompletionBinaryPath = getLlamaCompletionBinaryPath();
    const modelPath = getModelPath('slmModel');
    const nomalizedDescription = typeof description === 'string' ? description.trim() : '';
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
        `Input summary: ${nomalizedDescription}`,
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
            if (!imageId) return;
            runningJobs.set(imageId, createKillHandle(child));
        },
    });

    if (imageId) runningJobs.delete(imageId);

    return stdout.replace(/\n?>\s*EOF by user\s*$/i, '').trim();
};

const generateNormizlizedDescription = async (imageId, description) => {
    const llamaCompletionBinaryPath = getLlamaCompletionBinaryPath();
    const modelPath = getModelPath('slmModel');

    const prompt = [
        'Create one short normalized summary for embedding and retrieval from the input image description.',
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
        `Input summary: ${description.trim()}`,
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
            if (!imageId) return;
            runningJobs.set(imageId, createKillHandle(child));
        },
    });

    if (imageId) runningJobs.delete(imageId);

    return stdout.replace(/\n?>\s*EOF by user\s*$/i, '').trim();
};

const getEmbedding = async (imageId, description) => {
    const normalizedDesc = await generateNormizlizedDescription(imageId, description);
    const embedding = await generateEmbedding(normalizedDesc, { jobKey: imageId, runningJobs });
    return embedding;
};

const generateImageMetaData = async (imageId, imagePath, modelTier, shouldGenerateTitle) => {
    const description = await generateImageDescription(imageId, imagePath, modelTier);
    let title = '';
    if (shouldGenerateTitle) {
        title = await generateImageTitle(imageId, description);
    }

    const embedding = await getEmbedding(imageId, description);

    return {
        title: title,
        description: description,
        embedding: embedding,
    };
};

const stopGeneratingImageMetadata = async (imageId) => {
    const job = runningJobs.get(imageId);

    if (!job) return true;

    try {
        await job.kill();
    } finally {
        runningJobs.delete(imageId);
    }

    return true;
};

module.exports = {
    stopGeneratingImageMetadata,
    getEmbedding,
    generateImageMetaData,
};
