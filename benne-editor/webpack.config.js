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
  // The bundled TypeScript (ScriptModel) loads optional modules with a computed require; harmless here.
  ignoreWarnings: [{ module: /node_modules[\\/]typescript[\\/]lib[\\/]typescript\.js$/ }],
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/, /[\\/]scaffold[\\/]/],
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
        exclude: [/node_modules/, /[\\/]scaffold[\\/]/],
        use: [{ loader: 'ts-loader' }],
      },
    ],
  },
  devtool: false,
  infrastructureLogging: {
    level: 'log',
  },
};

/** State view webview (flags and vars tables). */
/** @type WebpackConfig */
const stateWebviewConfig = {
  ...inspectorWebviewConfig,
  entry: './src/state/stateMain.ts',
  output: {
    path: path.resolve(__dirname, 'media', 'state'),
    filename: 'state.js',
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
        exclude: [/node_modules/, /[\\/]scaffold[\\/]/],
        use: [{ loader: 'ts-loader' }],
      },
    ],
  },
  devtool: false,
  infrastructureLogging: {
    level: 'log',
  },
};

/** TypeScript server plugin (loaded by tsserver, not the extension host). */
/** @type WebpackConfig */
const roomScriptIdTsPluginConfig = {
  target: 'node',
  mode: 'none',
  entry: './src/roomScriptIdTsPlugin.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'room-script-id-ts-plugin.js',
    libraryTarget: 'commonjs2',
  },
  externalsPresets: { node: true },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/, /[\\/]scaffold[\\/]/],
        use: [{ loader: 'ts-loader' }],
      },
    ],
  },
  devtool: false,
  infrastructureLogging: {
    level: 'log',
  },
};

module.exports = [extensionConfig, inspectorWebviewConfig, stateWebviewConfig, pdcEditorWebviewConfig, roomScriptIdTsPluginConfig];
