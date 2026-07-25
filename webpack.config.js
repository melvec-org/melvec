const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

//const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = (env, argv) => {
    const isProd = argv.mode === 'production';

    return {
        cache: true,
        target: 'electron-renderer',
        mode: isProd ? 'production' : 'development',
        entry: './src/ui/app.js',
        devtool: isProd ? false : 'source-map',
        output: {
            path: path.join(__dirname, '/dist'),
            filename: 'app.js',
            publicPath: '',
        },

        watch: !isProd,
        resolve: {
            alias: {
                __components: path.resolve(__dirname, 'src/ui/components/'),
                __events: path.resolve(__dirname, 'src/events/'),
                __contexts: path.resolve(__dirname, 'src/ui/contexts/'),
                __configs: path.resolve(__dirname, 'src/configs/'),
                __styles: path.resolve(__dirname, 'src/ui/styles/'),
                __utils: path.resolve(__dirname, 'src/ui/utils/'),
                __actions: path.resolve(__dirname, 'src/ui/actions/'),
                __constants: path.resolve(__dirname, 'src/constants/'),
            },
        },
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                    },
                },
                {
                    test: /\.css$/i,
                    use: [
                        isProd ? MiniCssExtractPlugin.loader : 'style-loader',
                        {
                            loader: 'css-loader',
                            options: {
                                importLoaders: 1,
                                modules: {
                                    localIdentName: isProd ? '[hash:base64:8]' : '[local]_[hash:base64:4]',
                                },
                            },
                        },
                    ],
                },
            ],
        },
        plugins: [
            new HtmlWebpackPlugin({ template: './index.html', filename: 'index.html', publicPath: '' }),
            ...(isProd ? [new MiniCssExtractPlugin()] : []),
            // new BundleAnalyzerPlugin()
        ],
    };
};
