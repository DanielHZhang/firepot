const path = require('path');
const webpack = require('webpack');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

require('dotenv').config();

module.exports = {
  mode: 'development',
  devServer: {
    hot: true,
    contentBase: path.join(process.cwd(), 'test'),
    stats: 'minimal',
  },
  devtool: 'source-map',
  entry: {
    lib: path.join(process.cwd(), 'src', 'index.ts'),
    app: path.join(process.cwd(), 'test', 'index.ts'),
  },
  output: {
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.(j|t)sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ttf$/,
        use: ['file-loader'],
      },
    ],
  },
  plugins: [
    new webpack.EnvironmentPlugin(['FIREBASE_API_KEY', 'FIREBASE_URL', 'FIREBASE_PROJECT_ID']),
    new MonacoWebpackPlugin({languages: ['javascript', 'typescript']}),
  ],
};
