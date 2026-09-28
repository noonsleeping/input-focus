# Input Focus

模拟"输入框光标闪烁 → 打字输入"的动画生成器：浏览器里实时预览，一键导出 MP4。

A typing-animation generator: a blinking cursor, realistic Chinese / English typing rhythm, and a camera that pushes in and follows the last word. Preview in the browser, export MP4.

## 功能

- **打字节奏**：英文逐字母 / 中文逐词（模拟输入法上屏），或沿平滑 S 曲线加速；随机种子可换一种节奏
- **镜头**：开场全景推近到光标（可关），特写平滑跟随最新的词，构图位置可调，结尾可拉远展示全文
- **光标**：开场闪烁次数、5 种形状、硬切 / 柔和闪烁
- **模板**：搜索（胶囊式 / 按钮式）、AI 对话（浅色 / 深色）、Claude Code、Codex（模型名可选）
- **屏幕模拟**：手机翻拍摩尔纹 / CRT 复古 / LCD 像素特写
- **镜头质感**：景深（对焦在最新的词）、暗角、色差、胶片颗粒
- **文字出现方式**：直接出现 / 淡入 / 淡入上浮
- **键盘音效**：机械 / 薄膜 / 笔记本三种音色，程序合成，无音频素材
- **导出**：MP4（H.264 + AAC），720p ~ 4K、竖屏、方形，24 / 30 / 60 fps；可下载当前帧 PNG

所有画面由 `renderFrame(配置, 时间)` 逐帧确定性渲染，预览、拖动进度条和导出完全一致，导出不掉帧。

## 使用

推荐最新版 Chrome / Edge（需要 WebCodecs、WebGL2、`Intl.Segmenter`）。

```bash
npm install
npm run dev      # http://localhost:5188
npm test         # 单元测试
npm run build    # 生产构建（输出到 dist/）
```

需求与技术方案见 [docs/spec.md](docs/spec.md)。

## 技术栈

Vite · TypeScript · React · Canvas 2D（场景）· WebGL2（后期特效）· WebCodecs + [Mediabunny](https://github.com/Vanilagy/mediabunny)（MP4 编码封装）· Web Audio（键盘音效合成）

## 声明

Claude Code、Codex 等模板仅为制作演示素材而仿照相应界面的外观，本项目与 Anthropic、OpenAI 等公司无关联，相关名称与标识归其各自所有者。

The Claude Code / Codex templates only imitate those interfaces for making demo footage. This project is not affiliated with Anthropic or OpenAI; their names and marks belong to their respective owners.

## License

[MIT](LICENSE)
