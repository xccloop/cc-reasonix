---
name: image-describe
description: 查看/描述图片时自动调用 mimo-v2-omni 多模态模型。当用户要求查看图片、描述图片、图片里有什么时触发。
---
# Image Describe Skill

当用户要求查看、描述、分析任何图片文件时，使用此 Skill。

## 触发条件
- "查看这张图片"
- "描述这个图"
- "图片里有什么"
- "分析这张图"
- 用户提供图片路径

## 执行流程

1. **确认图片存在** — 用 `get_file_info` 或 `list_directory` 确认路径有效
2. **调用 mimo 分析** — 使用 `mcp__multimodal_analyze_image` 工具：
   - `image_path`: 图片的绝对路径
   - `prompt`: 具体描述需求，如 "请详细描述这张图片的内容，包括场景、元素、颜色、文字、人物、氛围等"
3. **展示结果** — 将 mimo 返回的描述展示给用户

## 支持的格式
.png, .jpg, .jpeg, .gif, .webp, .ico, .bmp

## 示例
```
用户: "看看桌面这张 backround.jpg 是什么"
→ 调用 mcp__multimodal_analyze_image(image_path="C:\Users\memory\Desktop\backround.jpg", prompt="请详细描述这张图片")
→ 返回描述
```
