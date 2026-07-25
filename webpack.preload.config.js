const path = require('path');

module.exports = (env, argv) => {
    const isProd = argv.mode === 'production';
    return {
        target: 'electron-preload',
        mode: isProd ? 'production' : 'development',
        entry: './src/main/preload.js',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'preload.bundle.js',
            clean: true,
        },
        externals: { electron: 'commonjs electron' },
        node: {
            __dirname: false,
            __filename: false,
        },
        devtool: isProd ? false : 'source-map',
        experiments: {
            outputModule: false,
        },
        module: {
            rules: [
                {
                    test: /\.m?js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env'],
                        },
                    },
                },
            ],
        },
    };
};
