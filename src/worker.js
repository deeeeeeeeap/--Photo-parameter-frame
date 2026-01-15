/**
 * LensFrame Worker Thread - 图像处理工作线程
 * 使用独立线程处理图像，避免阻塞主进程
 */

const { parentPort, workerData } = require('worker_threads');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 配置 Sharp 使用多核
sharp.concurrency(4);  // 使用 4 个 CPU 核心

/**
 * 生成噪点纹理层
 */
function generateNoiseSvg(width, height, opacity = 0.03) {
    return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="noise" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="${opacity * 3}" intercept="0"/>
          </feComponentTransfer>
        </filter>
      </defs>
      <rect width="100%" height="100%" filter="url(#noise)" opacity="${opacity}"/>
    </svg>
  `;
}

/**
 * 生成大气渐变层
 */
function generateAtmosphereGradient(width, height) {
    return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="atmosphere" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0.15"/>
          <stop offset="30%" style="stop-color:rgb(0,0,0);stop-opacity:0"/>
          <stop offset="70%" style="stop-color:rgb(0,0,0);stop-opacity:0"/>
          <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.35"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#atmosphere)"/>
    </svg>
  `;
}

function escapeXml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

async function generateBlurPoster(filePath, exifInfo, isPreview, exportQuality, logoDir, logoMap) {
    try {
        const MAX_SIZE_HIGH = 8000;
        const MAX_SIZE_FAST = 3000;
        const maxSize = isPreview ? 1200 : (exportQuality === 'fast' ? MAX_SIZE_FAST : MAX_SIZE_HIGH);

        const rotatedBuffer = await sharp(filePath).rotate().toBuffer();
        let metadata = await sharp(rotatedBuffer).metadata();

        let workBuffer = rotatedBuffer;
        const originalMax = Math.max(metadata.width, metadata.height);

        if (originalMax > maxSize) {
            const scale = maxSize / originalMax;
            workBuffer = await sharp(rotatedBuffer)
                .resize(Math.round(metadata.width * scale), Math.round(metadata.height * scale))
                .toBuffer();
            metadata = await sharp(workBuffer).metadata();
        }

        const imgWidth = metadata.width;
        const imgHeight = metadata.height;

        // 布局参数
        const SIDE_PAD_RATIO = 0.055;
        const TOP_PAD_RATIO = 0.05;
        const BOTTOM_INFO_RATIO = 0.13;

        const posterWidth = imgWidth;
        const posterHeight = Math.round(imgHeight * (1 + TOP_PAD_RATIO + BOTTOM_INFO_RATIO));

        const topPad = Math.round(posterHeight * TOP_PAD_RATIO);
        const sidePad = Math.round(posterWidth * SIDE_PAD_RATIO);
        const bottomInfoHeight = Math.round(posterHeight * BOTTOM_INFO_RATIO);
        const availableWidth = posterWidth - sidePad * 2;
        const availableHeight = posterHeight - topPad - bottomInfoHeight;

        const photoScale = Math.min(availableWidth / imgWidth, availableHeight / imgHeight, 1);
        const mainW = Math.round(imgWidth * photoScale);
        const mainH = Math.round(imgHeight * photoScale);

        const mainX = Math.round((posterWidth - mainW) / 2);
        const mainY = topPad;

        // 背景生成
        const blurRadius = isPreview ? 20 : 40;
        const bgScale = isPreview ? 0.15 : 0.25;

        const bgPromise = sharp(workBuffer)
            .resize(Math.round(posterWidth * bgScale), Math.round(posterHeight * bgScale), { fit: 'cover' })
            .modulate({ brightness: 0.5, saturation: 1.3 })
            .blur(blurRadius)
            .resize(posterWidth, posterHeight)
            .toBuffer();

        // 阴影
        const cornerRadius = Math.round(mainW * 0.02);
        const shadowBlur = isPreview ? 12 : 25;
        const shadowOffsetY = isPreview ? 4 : 8;
        const shadowExpand = Math.round(shadowBlur * 1.0);

        const shadowSvgW = mainW + shadowExpand * 2;
        const shadowSvgH = mainH + shadowExpand * 2;
        const shadowScale = isPreview ? 0.2 : 0.35;

        const shadowSvg = `<svg width="${Math.round(shadowSvgW * shadowScale)}" height="${Math.round(shadowSvgH * shadowScale)}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${Math.round(shadowExpand * shadowScale)}" y="${Math.round(shadowExpand * shadowScale)}" 
        width="${Math.round(mainW * shadowScale)}" height="${Math.round(mainH * shadowScale)}" 
        rx="${Math.round(cornerRadius * shadowScale)}" fill="rgba(0,0,0,0.3)"/>
    </svg>`;

        const shadowPromise = sharp(Buffer.from(shadowSvg))
            .blur(Math.round(shadowBlur * shadowScale) + 1)
            .resize(shadowSvgW, shadowSvgH)
            .toBuffer();

        const shadowX = mainX - shadowExpand;
        const shadowY = mainY - shadowExpand + shadowOffsetY;

        // 圆角照片
        const roundedMaskSvg = `<svg width="${mainW}" height="${mainH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${mainW}" height="${mainH}" rx="${cornerRadius}" fill="white"/>
    </svg>`;

        const photoPromise = sharp(workBuffer)
            .resize(mainW, mainH, { fit: 'fill' })
            .composite([{ input: Buffer.from(roundedMaskSvg), blend: 'dest-in' }])
            .png({ compressionLevel: 6 })
            .toBuffer();

        // 并行处理
        const [bgBuffer, shadowBuffer, roundedMainImg] = await Promise.all([
            bgPromise, shadowPromise, photoPromise
        ]);

        // 叠加渐变和噪点
        const atmosphereSvg = generateAtmosphereGradient(posterWidth, posterHeight);
        let blurredBg = await sharp(bgBuffer)
            .composite([{ input: Buffer.from(atmosphereSvg), blend: 'over' }])
            .toBuffer();

        if (!isPreview) {
            const noiseSvg = generateNoiseSvg(posterWidth, posterHeight, 0.02);
            blurredBg = await sharp(blurredBg)
                .composite([{ input: Buffer.from(noiseSvg), blend: 'over' }])
                .toBuffer();
        }

        // Logo 处理
        let logoBuffer = null;
        let logoWidth = 0;
        let logoHeight = 0;
        let logoX = 0, logoY = 0;

        if (exifInfo.cameraMake && logoDir && logoMap) {
            const make = exifInfo.cameraMake.toLowerCase();
            for (const [keyword, filename] of Object.entries(logoMap)) {
                if (make.includes(keyword)) {
                    const logoPath = path.join(logoDir, filename);
                    if (fs.existsSync(logoPath)) {
                        try {
                            const logoMeta = await sharp(logoPath).metadata();
                            logoHeight = Math.round(bottomInfoHeight * 0.22);
                            logoWidth = Math.round(logoHeight * (logoMeta.width / logoMeta.height));
                            logoBuffer = await sharp(logoPath)
                                .resize(logoWidth, logoHeight, { fit: 'inside' })
                                .toBuffer();
                        } catch (e) {
                            logoBuffer = null;
                        }
                    }
                    break;
                }
            }
        }

        // 文本层
        const infoStartY = posterHeight - bottomInfoHeight;
        const infoCenterY = infoStartY + Math.round(bottomInfoHeight / 2);
        const paramsFontSize = Math.round(posterWidth * 0.016);
        const modelFontSize = Math.round(posterWidth * 0.020);

        const params = [];
        if (exifInfo.focalLength) params.push(exifInfo.focalLength);
        if (exifInfo.aperture) params.push(exifInfo.aperture);
        if (exifInfo.shutterSpeed) params.push(exifInfo.shutterSpeed);
        if (exifInfo.iso) params.push(`ISO ${exifInfo.iso}`);
        const paramsText = escapeXml(params.join('  ·  '));

        let textSvg;

        if (logoBuffer) {
            const paramsY = posterHeight - Math.round(bottomInfoHeight * 0.25);
            const photoBottom = infoStartY;
            const paramsTop = paramsY - Math.round(paramsFontSize * 0.8);
            logoY = photoBottom + Math.round((paramsTop - photoBottom - logoHeight) / 2);
            logoX = Math.round((posterWidth - logoWidth) / 2);
            textSvg = `
        <svg width="${posterWidth}" height="${posterHeight}" xmlns="http://www.w3.org/2000/svg">
          <text x="${posterWidth / 2}" y="${paramsY}" text-anchor="middle" 
            font-family="Helvetica Neue, Arial, sans-serif" font-size="${paramsFontSize}px" 
            fill="rgba(255,255,255,0.7)" font-weight="300" letter-spacing="1.5">${paramsText}</text>
        </svg>
      `;
        } else {
            const brandName = exifInfo.cameraMake ? exifInfo.cameraMake.split(' ')[0] : '';
            const cameraModel = escapeXml(exifInfo.cameraModel || '');
            const modelLine = brandName ? `${brandName}  ·  ${cameraModel}` : cameraModel;
            const modelY = infoCenterY - Math.round(paramsFontSize * 0.5);
            const paramsY = modelY + Math.round(modelFontSize * 1.4);
            textSvg = `
        <svg width="${posterWidth}" height="${posterHeight}" xmlns="http://www.w3.org/2000/svg">
          <text x="${posterWidth / 2}" y="${modelY}" text-anchor="middle" 
            font-family="Helvetica Neue, Arial, sans-serif" font-size="${modelFontSize}px" 
            fill="#ffffff" font-weight="500" letter-spacing="2">${escapeXml(modelLine)}</text>
          <text x="${posterWidth / 2}" y="${paramsY}" text-anchor="middle" 
            font-family="Helvetica Neue, Arial, sans-serif" font-size="${paramsFontSize}px" 
            fill="rgba(255,255,255,0.7)" font-weight="300" letter-spacing="1.5">${paramsText}</text>
        </svg>
      `;
        }

        // 最终合成
        const composites = [
            { input: shadowBuffer, top: shadowY, left: shadowX, blend: 'over' },
            { input: roundedMainImg, top: mainY, left: mainX },
            { input: Buffer.from(textSvg), top: 0, left: 0 }
        ];

        if (logoBuffer) {
            composites.push({ input: logoBuffer, top: logoY, left: logoX });
        }

        const poster = await sharp(blurredBg)
            .composite(composites)
            .png()
            .toBuffer();

        return poster;
    } catch (e) {
        throw e;
    }
}

// 监听来自主进程的消息
parentPort.on('message', async (data) => {
    try {
        const { filePath, exifInfo, isPreview, exportQuality, logoDir, logoMap } = data;
        const result = await generateBlurPoster(filePath, exifInfo, isPreview, exportQuality, logoDir, logoMap);
        parentPort.postMessage({ success: true, buffer: result });
    } catch (error) {
        parentPort.postMessage({ success: false, error: error.message });
    }
});
