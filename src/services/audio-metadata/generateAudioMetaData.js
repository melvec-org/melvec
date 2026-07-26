const fs = require('fs');

const { getModelPath } = require('../ai-models/models');
const { getLlamaCompletionBinaryPath } = require('../service-utils/binaryPaths');
const { generateEmbedding } = require('../service-utils/generateEmbedding');
const { runStoppable, createKillHandle } = require('../service-utils/process');
const { getWhisperCliPath } = require('../service-utils/binaryPaths');
const { MAX_TRANSCRIPT_LENGTH } = require('../../configs/appConfig');

const runningJobs = new Map();

const sanitizeTranscript = (transcript) => {
    const normalizedTranscript = String(transcript || '').trim();
    const voidTranscripts = ['[BALNK_AUDIO]', '[SILENCE]', '[MUSIC]'];

    if (voidTranscripts.includes(normalizedTranscript)) return '';
    return normalizedTranscript;
};

const getAudioTranscript = async (audioId, audioPath) => {
    if (!audioPath) return '';

    if (!fs.existsSync(audioPath)) throw new Error('Audio file not found');

    const modelPath = getModelPath('whisper');
    const outBase = audioPath.replace(/\.[^.]+$/i, '') + '_whisper';
    const outTxt = `${outBase}.txt`;
    const whisperCliPath = getWhisperCliPath();

    try {
        await runStoppable(whisperCliPath, ['-m', modelPath, '-f', audioPath, '-otxt', '-of', outBase], {
            stdin: '',
            onSpawn: (child) => {
                if (!audioId) return;
                runningJobs.set(audioId, createKillHandle(child));
            },
        });
    } finally {
        if (audioId) runningJobs.delete(audioId);
    }

    if (!fs.existsSync(outTxt)) throw new Error(`Whisper finished but output missing: ${outTxt}`);

    let transcript = fs.readFileSync(outTxt, 'utf8');
    transcript = sanitizeTranscript(transcript);
    if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
        transcript = transcript.slice(0, MAX_TRANSCRIPT_LENGTH);
    }

    return transcript;
};

const generateAudioDescription = async (audioId, transcript) => {
    try {
        const llamaCompletionBinaryPath = getLlamaCompletionBinaryPath();
        const modelPath = getModelPath('slmModel');

        const normalizedTranscript = typeof transcript === 'string' ? transcript.trim() : '';

        const prompt = [
            'Write a concise, searchable description of the audio from the transcript.',
            'Do NOT repeat the same fact.',
            'Focus on speakers, dialogue topics, sounds, events, and setting only when explicitly supported by the transcript.',
            "If you are uncertain, say 'unclear' rather than guessing.",
            'Output ONLY the summary paragraph (no labels, no bullets, no quotes).',
            'Do not invent visual details.',
            'Return one natural paragraph under 1000 characters.',
            '',
            `Transcript: ${normalizedTranscript}`,
        ].join('\n');

        const args = [
            '-m',
            modelPath,
            '-c',
            '8192',
            '--temp',
            '0.2',
            '--top-p',
            '0.9',
            '--repeat-penalty',
            '1.2',
            '-n',
            '4000',
            '-p',
            prompt,
            '--no-display-prompt',
        ];

        let stdout = '';
        try {
            ({ stdout } = await runStoppable(llamaCompletionBinaryPath, args, {
                stdin: '',
                onSpawn: (child) => {
                    if (!audioId) return;
                    runningJobs.set(audioId, createKillHandle(child));
                },
            }));
        } finally {
            if (audioId) runningJobs.delete(audioId);
        }

        return stdout.replace(/\n?>\s*EOF by user\s*$/i, '').trim();
    } catch (error) {
        throw new Error(`Failed to generate description: ${error.message}`);
    }
};

const generateAudioTitle = async (audioId, description) => {
    const llamaCompletionBinaryPath = getLlamaCompletionBinaryPath();
    const modelPath = getModelPath('slmModel');
    const nomalizedDescription = typeof description === 'string' ? description.trim() : '';
    const prompt = [
        'Create one short, specific, natural audio title from the input summary.',
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
            if (!audioId) return;
            runningJobs.set(audioId, createKillHandle(child));
        },
    });

    if (audioId) runningJobs.delete(audioId);

    return stdout.replace(/\n?>\s*EOF by user\s*$/i, '').trim();
};

const generateNormizlizedDescription = async (audioId, description) => {
    const llamaCompletionBinaryPath = getLlamaCompletionBinaryPath();
    const modelPath = getModelPath('slmModel');

    const prompt = [
        'Create one short normalized summary for embedding and retrieval from the input audio description.',
        'This is a literal normalization task, not a creative writing task.',
        'Return ONLY the normalized summary text.',
        '',
        'Internal extraction rules:',
        '- First identify these categories from the input: entities, setting, activities, attributes.',
        '- entities = speakers, sounds, objects referenced, named things, or notable things explicitly mentioned.',
        '- setting = place, environment, context, or scene explicitly mentioned.',
        '- activities = spoken actions, events, interactions, or audio events explicitly mentioned.',
        '- attributes = tone, genre, mood, sound qualities, and concrete descriptors explicitly mentioned.',
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
            if (!audioId) return;
            runningJobs.set(audioId, createKillHandle(child));
        },
    });

    if (audioId) runningJobs.delete(audioId);

    return stdout.replace(/\n?>\s*EOF by user\s*$/i, '').trim();
};

const getEmbedding = async (audioId, description) => {
    const normalizedDesc = await generateNormizlizedDescription(audioId, description);

    const embedding = await generateEmbedding(normalizedDesc, { jobKey: audioId, runningJobs });
    return embedding;
};

const generateAudioMetaData = async (audioId, audioPath, shouldGenerateTitle) => {
    const transcript = await getAudioTranscript(audioId, audioPath);
    const description = await generateAudioDescription(audioId, transcript);
    let title = '';
    if (shouldGenerateTitle) {
        title = await generateAudioTitle(audioId, description);
    }

    const embedding = await getEmbedding(audioId, description);

    return {
        title,
        transcript,
        description,
        embedding,
    };
};

const stopGeneratingAudioMetadata = async (audioId) => {
    const job = runningJobs.get(audioId);

    if (!job) return true;

    try {
        await job.kill();
    } finally {
        runningJobs.delete(audioId);
    }

    return true;
};

module.exports = {
    stopGeneratingAudioMetadata,
    getEmbedding,
    generateAudioMetaData,
    getAudioTranscript,
};
