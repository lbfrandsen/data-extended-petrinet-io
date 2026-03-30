// webpack.lib.config.js
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',

  entry: './lib/index.js',  // this exports PetriNetIO

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'petrinet-io.umd.js',
    library: {
      name: 'PetriNetIO',
      type: 'umd'
    },
    globalObject: 'this'
  },

  externals: {
    '@fortawesome/fontawesome-free/css/all.min.css': '@fortawesome/fontawesome-free/css/all.min.css',
    'bpmn-font/dist/css/bpmn-embedded.css': 'bpmn-font/dist/css/bpmn-embedded.css'
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'node_modules/sql.js/dist/sql-wasm.wasm',
          to: 'sql-wasm.wasm'
        }
      ]
    })
  ],

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  }
};
