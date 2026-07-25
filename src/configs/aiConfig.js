const aiConfig = {
    models: {
        // English only
        basic: {
            approxSize: '3.35GB',
            developmentBasePath: 'models/basic/',
            whisper: {
                fileName: 'ggml-base-q8_0.bin',
                downloadURL: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q8_0.bin?download=true',
                cachedDownloadURL: '',
            },
            slmModel: {
                fileName: 'Qwen2.5-VL-3B-Instruct-abliterated.Q4_K_M.gguf',
                downloadURL:
                    'https://huggingface.co/mradermacher/Qwen2.5-VL-3B-Instruct-abliterated-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-abliterated.Q4_K_M.gguf?download=true',
                cachedDownloadURL: '',
            },
            slmProjector: {
                fileName: 'Qwen2.5-VL-3B-Instruct.mmproj-fp16.gguf',
                downloadURL:
                    'https://huggingface.co/mradermacher/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct.mmproj-fp16.gguf?download=true',
                cachedDownloadURL: '',
            },
            embeddingModel: {
                fileName: 'Qwen3-Embedding-0.6B-Q8_0.gguf',
                downloadURL: 'https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF/resolve/main/Qwen3-Embedding-0.6B-Q8_0.gguf',
                cachedDownloadURL: '',
            },
        },
        // multilingual and more accuracy
        standard: {
            approxSize: '~6.7GB',
            developmentBasePath: 'models/standard/',
            whisper: {
                fileName: 'ggml-large-v3-turbo-q5_0.bin',
                downloadURL: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin?download=true',
                cachedDownloadURL: '',
            },
            slmModel: {
                fileName: 'Qwen2.5-VL-7B-Instruct-abliterated.Q4_K_M.gguf',
                downloadURL:
                    'https://huggingface.co/mradermacher/Qwen2.5-VL-7B-Instruct-abliterated-GGUF/resolve/main/Qwen2.5-VL-7B-Instruct-abliterated.Q4_K_M.gguf?download=true',
                cachedDownloadURL: '',
            },
            slmProjector: {
                fileName: 'mmproj-Qwen_Qwen2.5-VL-7B-Instruct-bf16.gguf',
                downloadURL:
                    'https://huggingface.co/mradermacher/Qwen2.5-VL-7B-Instruct-abliterated-GGUF/resolve/main/Qwen2.5-VL-7B-Instruct-abliterated.mmproj-Q8_0.gguf?download=true',
                cachedDownloadURL: '',
            },
            embeddingModel: {
                fileName: 'Qwen3-Embedding-0.6B-Q8_0.gguf',
                downloadURL: 'https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF/resolve/main/Qwen3-Embedding-0.6B-Q8_0.gguf',
                cachedDownloadURL: '',
            },
        },

        // with low WER rate
        advanced: {
            approxSize: '~7.5GB',
            developmentBasePath: 'models/advanced/',
            whisper: {
                fileName: 'ggml-large-v3-q5_0.bin',
                downloadURL: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-q5_0.bin?download=true',
                cachedDownloadURL: '',
            },
            slmModel: {
                fileName: 'Huihui-Qwen3-VL-8B-Instruct-abliterated.Q4_K_M.gguf',
                downloadURL:
                    'https://huggingface.co/mradermacher/Huihui-Qwen3-VL-8B-Instruct-abliterated-GGUF/resolve/main/Huihui-Qwen3-VL-8B-Instruct-abliterated.Q4_K_M.gguf?download=true',
                cachedDownloadURL: '',
            },
            slmProjector: {
                fileName: 'Huihui-Qwen3-VL-8B-Instruct-abliterated.mmproj-Q8_0.gguf',
                downloadURL:
                    'https://huggingface.co/mradermacher/Huihui-Qwen3-VL-8B-Instruct-abliterated-GGUF/resolve/main/Huihui-Qwen3-VL-8B-Instruct-abliterated.mmproj-Q8_0.gguf?download=true',
                cachedDownloadURL: '',
            },
            embeddingModel: {
                fileName: 'Qwen3-Embedding-0.6B-Q8_0.gguf',
                downloadURL: 'https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF/resolve/main/Qwen3-Embedding-0.6B-Q8_0.gguf',
                cachedDownloadURL: '',
            },
        },
    },
};

module.exports = { aiConfig };
