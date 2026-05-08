//@ts-check

'use strict';

const path = require('path');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node',
	mode: 'none',

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log",
  },
};

/** Inspector webview bundle (runs in browser context inside VS Code webview). */
/** @type WebpackConfig */
const inspectorWebviewConfig = {
  target: 'web',
  mode: 'none',
  entry: './src/inspector/inspectorMain.ts',
  output: {
    path: path.resolve(__dirname, 'media', 'inspector'),
    filename: 'inspector.js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [{ loader: 'ts-loader' }],
      },
    ],
  },
  devtool: false,
  infrastructureLogging: {
    level: 'log',
  },
};

/** PDC editor webview (Cytoscape.js). */
/** @type WebpackConfig */
const pdcEditorWebviewConfig = {
  target: 'web',
  mode: 'none',
  entry: './src/pdc/pdcEditorMain.ts',
  output: {
    path: path.resolve(__dirname, 'media', 'pdc-editor'),
    filename: 'pdc-editor.js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [{ loader: 'ts-loader' }],
      },
    ],
  },
  devtool: false,
  infrastructureLogging: {
    level: 'log',
  },
};

module.exports = [extensionConfig, inspectorWebviewConfig, pdcEditorWebviewConfig];
