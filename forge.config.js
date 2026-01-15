const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');

module.exports = {
  packagerConfig: {
    // 禁用 asar
    asar: false,
    name: 'LensFrame',
    executableName: 'LensFrame',
    // 额外资源：复制 logo 目录到可执行文件旁边
    extraResource: [
      './logo'
    ],
    // 打包后复制 node_modules
    afterCopy: [(buildPath, electronVersion, platform, arch, callback) => {
      const srcNodeModules = path.join(__dirname, 'node_modules');
      const destNodeModules = path.join(buildPath, 'node_modules');

      // 需要复制的模块（包含 sharp 及其所有依赖）
      const modulesToCopy = ['sharp', '@img', 'exifr', 'detect-libc', 'color', 'color-string', 'color-name', 'color-convert', 'simple-swizzle', 'is-arrayish', 'semver'];

      if (!fs.existsSync(destNodeModules)) {
        fs.mkdirSync(destNodeModules, { recursive: true });
      }

      const copyDirSync = (src, dest) => {
        if (!fs.existsSync(src)) return;
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };

      for (const mod of modulesToCopy) {
        const srcMod = path.join(srcNodeModules, mod);
        const destMod = path.join(destNodeModules, mod);
        if (fs.existsSync(srcMod)) {
          copyDirSync(srcMod, destMod);
          console.log(`Copied: ${mod}`);
        }
      }

      // 复制 logo 目录到打包输出目录（与 exe 同级）
      const srcLogo = path.join(__dirname, 'logo');
      const destLogo = path.join(path.dirname(buildPath), 'logo');
      if (fs.existsSync(srcLogo)) {
        copyDirSync(srcLogo, destLogo);
        console.log('Copied: logo directory');
      }

      callback();
    }],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'LensFrame',
        setupExe: 'LensFrame-Setup.exe',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/index.html',
              js: './src/renderer.js',
              name: 'main_window',
              preload: {
                js: './src/preload.js',
              },
            },
          ],
        },
      },
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};
