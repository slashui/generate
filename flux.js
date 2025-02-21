const fs = require('fs');
const path = require('path');

const API_KEY = '70ece96e-65b0-4ce3-98e3-dcb2bd512a27';

/**
 * Generate an image using the Flux API
 * @param {string} prompt - The description of the image to generate
 * @param {Object} options - Additional options for image generation
 * @param {number} [options.n=1] - Number of images to generate
 * @param {string} [options.size='768x768'] - Size of the generated image
 * @param {boolean} [options.extend_prompt=true] - Whether to extend the prompt
 * @returns {Promise<string>} - The path to the generated image
 */
async function generateImage(prompt, options = {}) {
    if (!prompt) {
        throw new Error('Prompt is required');
    }

    const requestData = {
        prompt,
        n: options.n || 1,
        model: 'flux-schnell',
        size: options.size || '768x768',
        extend_prompt: options.extend_prompt !== false
    };

    try {
        const response = await fetch('https://zeakai.api4midjourney.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': API_KEY
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // 假设 API 返回的图片数据在 data.images[0].url 或类似的位置
        const imageUrl = data.images[0].url;
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();

        // 生成文件名（使用时间戳和随机数确保唯一性）
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
        const filePath = path.join('output', 'img', fileName);

        // 保存图片
        fs.writeFileSync(filePath, Buffer.from(imageBuffer));

        // 返回相对路径
        return `/output/img/${fileName}`;
    } catch (error) {
        console.error('Error generating image:', error);
        throw error;
    }
}

module.exports = {
    generateImage
};
