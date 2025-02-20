const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// 确保输出目录存在
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 下载文件的辅助函数
async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    // 如果是相对路径，直接返回
    if (url.startsWith('/')) {
      resolve(path.join(__dirname, url));
      return;
    }

    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(outputPath);
    
    protocol.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

const app = express();
app.use(cors());
app.use(express.json());

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
        
        // 下载媒体文件
        const imgPath = path.join(outputDir, `temp_img_${index}${path.extname(node.img_url)}`);
        const audioPath = path.join(outputDir, `temp_audio_${index}${path.extname(node.background_mp3)}`);
        
        try {
          await downloadFile(node.img_url, imgPath);
          await downloadFile(node.background_mp3, audioPath);
        } catch (err) {
          console.error(`下载媒体文件失败:`, err);
          return null;
        }
        
        const outputPath = path.join(outputDir, `segment_${index}.mp4`);
        
        return new Promise((resolve, reject) => {
          ffmpeg()
            .input(imgPath)
            .loop(1)  // 循环图片
            .input(audioPath)
            .outputOptions(['-shortest'])  // 使用音频长度作为视频长度
            .save(outputPath)
            .on('progress', (progress) => {
              console.log(`片段 ${index + 1} 处理进度: ${progress.percent}%`);
            })
            .on('end', () => {
              console.log(`片段 ${index + 1} 生成完成: ${outputPath}`);
              // 清理临时文件
              fs.unlink(imgPath, () => {});
              fs.unlink(audioPath, () => {});
              resolve(outputPath);
            })
            .on('error', (err) => {
              console.error(`片段 ${index + 1} 生成失败:`, err);
              // 清理临时文件
              fs.unlink(imgPath, () => {});
              fs.unlink(audioPath, () => {});
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
        const listFilePath = path.join(outputDir, 'file_list.txt');
        const fileContent = validSegments.map(file => `file '${path.relative(outputDir, file)}'`).join('\n');
        fs.writeFileSync(listFilePath, fileContent);
        console.log('生成合并文件列表:', fileContent);

        const finalOutput = path.join(outputDir, 'final.mp4');
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
            // 清理临时片段文件
            validSegments.forEach(segment => fs.unlink(segment, () => {}));
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

// 添加文件下载功能
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(outputDir, filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath, filename);
  } else {
    res.status(404).json({ error: '文件不存在' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Video processor running on port ${PORT}`);
});