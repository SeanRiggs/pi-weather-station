const path = require('node:path');
const webpack = require('webpack');
const HtmlPlugin = require('html-webpack-plugin');
module.exports = (_env, argv = {}) => ({
  mode: argv.mode || 'production',
  entry: './src/index.js',
  output: { path: path.resolve(__dirname, 'dist'), filename: 'bundle.[contenthash].js', clean: true, publicPath: '/' },
  module: { rules: [
    { test: /\.jsx?$/, exclude: /node_modules/, use: 'babel-loader' },
    { test: /\.css$/, oneOf: [
      { include: [path.resolve(__dirname, 'src/components')], exclude: /(overrides|animations)\.css$/, use: ['style-loader', { loader: 'css-loader', options: { modules: { namedExport: false, exportLocalsConvention: 'camel-case' } } }, 'postcss-loader'] },
      { use: ['style-loader', 'css-loader', 'postcss-loader'] }
    ] },
    { test: /\.(png|svg|jpe?g|gif|woff2?|eot|ttf|otf)$/, type: 'asset/resource' }
  ] },
  resolve: { extensions: ['.js', '.jsx'], alias: { '~': path.resolve(__dirname, 'src') } },
  plugins: [new HtmlPlugin({ template: './src/index.html' }), new webpack.DefinePlugin({ __PRODUCTION__: JSON.stringify(argv.mode !== 'development') })],
  performance: { hints: false }
});
