const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const path = require('path');

module.exports = {
  mode: 'development',
  devServer: {
    contentBase: path.join(process.cwd(), 'test'),
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
  plugins: [new MonacoWebpackPlugin({languages: ['javascript', 'typescript']})],
};
