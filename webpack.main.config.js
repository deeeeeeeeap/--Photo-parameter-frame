module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main.js',
  // Put your normal webpack config below here
  module: {
    rules: require('./webpack.rules'),
  },
  // 将原生模块和依赖设为外部依赖，不打包进 bundle
  externals: {
    'sharp': 'commonjs sharp',
    'exifr': 'commonjs exifr',
  },
};
