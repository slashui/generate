const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const groupId = "1889723738212012492";
const apiKey = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiJTaGFuIEh1aSIsIlVzZXJOYW1lIjoiU2hhbiBIdWkiLCJBY2NvdW50IjoiIiwiU3ViamVjdElEIjoiMTg4OTcyMzczODIxNjIwNjc5NiIsIlBob25lIjoiIiwiR3JvdXBJRCI6IjE4ODk3MjM3MzgyMTIwMTI0OTIiLCJQYWdlTmFtZSI6IiIsIk1haWwiOiJiYXNzbm92YUBnbWFpbC5jb20iLCJDcmVhdGVUaW1lIjoiMjAyNS0wMi0xMyAxNTo0MzoyNiIsIlRva2VuVHlwZSI6MSwiaXNzIjoibWluaW1heCJ9.vpE7Sjnx8kxln2kczNBF2VfdkCkbeTVFlP7eEJTpHgv_QXLIW-wN9Co8fEMl5k_Tjx7TLMVTLZdaajeEKfHprD30JNW7RgXxjk8fv7u8d6ENS3U0rIuxSBL5j37bIIP-iIeTGoMEeF-RH8YgKVukVivCIfMnfV8SdMot9MUZboKy3EKbq-u55qxqyg2wtDGpwMKc9-yidYvFrBT4tPK5o-voCLndqwVtyQtwEQ4LpqUneZA4Ft2j2U0uifHvVHwgMYl-xQjvRiRKUcvV2po0l28AV5NVTr9mdTFAgi28npBa8lrBXmq7hO9x5JdtfWPV-Sk4eVxPjpqslVX789eJhw";

async function generateTTS(text) {
    try {
        console.log('1. 开始处理 TTS 请求');
        console.log('2. 接收到文本:', text);

        const requestBody = {
            model: "speech-01-hd",
            text: text || 'Hello world',
            stream: false,
            voice_setting: {
                voice_id: "Chinese (Mandarin)_Warm_Bestie",
                speed: 1.0,
                vol: 1.0,
                pitch: 0
            },
            audio_setting: {
                sample_rate: 24000,
                bitrate: 32000,
                format: "mp3",
                channel: 1
            }
        };

        console.log('3. 准备请求体:', JSON.stringify(requestBody, null, 2));

        if (!groupId || !apiKey) {
            throw new Error('Missing HaiLuo API credentials');
        }

        console.log('5. 开始发送请求到 TTS API');

        const response = await fetch(`https://api.minimaxi.chat/v1/t2a_v2?GroupId=${groupId}`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('7. API 错误响应:', errorText);
            throw new Error(`TTS API error: ${response.status}`);
        }

        const responseData = await response.json();
        
        if (!responseData.data?.audio) {
            throw new Error('No audio data in response');
        }

        // 将十六进制字符串转换为 Buffer
        const audioData = Buffer.from(responseData.data.audio.replace(/\s+/g, ''), 'hex');

        if (audioData.length === 0) {
            throw new Error('Audio data is empty');
        }

        // 生成唯一的文件名
        const hash = crypto.createHash('md5').update(text).digest('hex').slice(0, 8);
        const filename = `tts_${hash}.mp3`;
        
        // 确保 audio 目录存在
        const audioDir = path.join(__dirname, 'output', 'audio');
        await fs.mkdir(audioDir, { recursive: true });
        
        // 保存音频文件
        const filePath = path.join(audioDir, filename);
        await fs.writeFile(filePath, audioData);
        
        console.log('音频文件已保存:', filePath);
        
        // 返回相对路径
        return `/output/audio/${filename}`;

    } catch (error) {
        console.error('TTS 生成错误:', error);
        throw error;
    }
}

module.exports = { generateTTS };
