const fs = require('fs');
const path = require('path');

const API_KEY = '70ece96e-65b0-4ce3-98e3-dcb2bd512a27';

/**
 * Generate an image using the Ideogram API
 * @param {string} prompt - The description of the image to generate
 * @param {Object} options - Additional options for image generation
 * @param {string} [options.aspect_ratio='ASPECT_9_16'] - Aspect ratio of the generated image
 * @param {string} [options.model='V_2'] - Model version to use
 * @param {string} [options.magic_prompt_option='AUTO'] - Magic prompt option
 * @param {number} [options.seed=16545613] - Seed for generation
 * @param {number} [options.num_images=1] - Number of images to generate
 * @returns {Promise<string>} - The path to the generated image
 */
async function generateIdeogram(prompt, options = {}) {
    if (!prompt) {
        throw new Error('Prompt is required');
    }

    const requestData = {
        image_request: {
            prompt,
            aspect_ratio: options.aspect_ratio || 'ASPECT_9_16',
            model: options.model || 'V_2',
            magic_prompt_option: options.magic_prompt_option || 'AUTO',
            seed: options.seed || 16545613,
            num_images: options.num_images || 1
        }
    };

    try {
        const response = await fetch('https://zeakai.api4midjourney.com/api/ideogram/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': API_KEY
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`Ideogram API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.data?.[0]?.url) {
            throw new Error('No image URL in response');
        }

        const imageUrl = data.data[0].url;
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();

        // 生成文件名（使用时间戳和随机数确保唯一性）
        const fileName = `ideogram-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
        const filePath = path.join('output', 'img', fileName);

        // 保存图片
        fs.writeFileSync(filePath, Buffer.from(imageBuffer));

        // 返回相对路径
        return `/output/img/${fileName}`;
    } catch (error) {
        console.error('Error generating ideogram:', error);
        throw error;
    }
}

module.exports = {
    generateIdeogram
};
