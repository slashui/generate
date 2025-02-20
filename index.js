const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const https = require('https');
const axios = require('axios');

// 确保输出目录存在
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

// 下载文件函数
async function downloadFile(url, outputPath) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream'
  });

  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// 获取音频时长
async function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(metadata.format.duration);
    });
  });
}

const app = express();
app.use(cors());
app.use(express.json());

// 添加特定的 MIME 类型处理
app.use('/output', (req, res, next) => {
  if (req.path.match(/\.(jpg|jpeg|png|gif|mp3|mp4)$/i)) {
    res.type(path.extname(req.path));
  }
  next();
});

// 静态文件服务
app.use('/output', express.static('output'));

// 处理视频生成请求
app.post('/process-video', async (req, res) => {
    const { storyNodes } = req.body;
    
    try {
      console.log('开始处理视频生成请求...');
      console.log(`共收到 ${storyNodes.length} 个故事节点`);
      
      const videoPromises = storyNodes.map(async (node, index) => {
        if (!node.img_url || !node.background_mp3) {
          console.log(`节点 ${index} 缺少必要的媒体文件，跳过`);
          return null;
        }
        
        console.log(`开始处理第 ${index + 1} 个视频片段`);
        console.log(`- 图片: ${node.img_url}`);
        console.log(`- 音频: ${node.background_mp3}`);
        
        // 下载文件
        const localImgPath = path.join(__dirname, 'output', `temp_img_${index}${path.extname(node.img_url)}`);
        const localMp3Path = path.join(__dirname, 'output', `temp_mp3_${index}${path.extname(node.background_mp3)}`);
        
        await downloadFile(node.img_url, localImgPath);
        await downloadFile(node.background_mp3, localMp3Path);
        
        // 获取音频时长
        const duration = await getAudioDuration(localMp3Path);
        const outputPath = path.join(__dirname, 'output', `segment_${index}.mp4`);
        
        return new Promise((resolve, reject) => {
          ffmpeg()
            .input(localImgPath)
            .loop(duration)
            .input(localMp3Path)
            .outputOptions(['-shortest'])
            .save(outputPath)
            .on('progress', (progress) => {
              console.log(`片段 ${index + 1} 处理进度: ${progress.percent}%`);
            })
            .on('end', () => {
              // 清理临时文件
              fs.unlinkSync(localImgPath);
              fs.unlinkSync(localMp3Path);
              console.log(`片段 ${index + 1} 生成完成: ${outputPath}`);
              resolve(outputPath);
            })
            .on('error', (err) => {
              // 清理临时文件
              if (fs.existsSync(localImgPath)) fs.unlinkSync(localImgPath);
              if (fs.existsSync(localMp3Path)) fs.unlinkSync(localMp3Path);
              console.error(`片段 ${index + 1} 生成失败:`, err);
              reject(err);
            });
        });
      });
  
      console.log('等待所有视频片段生成...');
      const segments = await Promise.all(videoPromises);
      const validSegments = segments.filter(Boolean);
      console.log(`成功生成 ${validSegments.length} 个视频片段`);
      
      // 将合并逻辑包装在 Promise 中
      await new Promise((resolve, reject) => {
        // 创建文件列表
        const listFilePath = path.join(__dirname, 'output', 'file_list.txt');
        const fileContent = validSegments.map(file => `file '${file}'`).join('\n');
        fs.writeFileSync(listFilePath, fileContent);
        console.log('生成合并文件列表:', fileContent);

        const finalOutput = path.join(__dirname, 'output', 'final.mp4');
        console.log('开始合并视频片段...');

        ffmpeg()
          .input(listFilePath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy'])
          .save(finalOutput)
          .on('progress', (progress) => {
            console.log(`合并进度: ${progress.percent}%`);
          })
          .on('end', () => {
            console.log('视频合并完成！');
            fs.unlinkSync(listFilePath);
            console.log('清理临时文件完成');
            resolve();
          })
          .on('error', (err) => {
            console.error('视频合并失败:', err);
            if (fs.existsSync(listFilePath)) {
              fs.unlinkSync(listFilePath);
            }
            reject(err);
          });
      });

      res.json({ videoUrl: '/output/final.mp4' });

    } catch (error) {
      console.error('处理过程出错:', error);
      res.status(500).json({ error: error.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Video processor running on port ${PORT}`);
});