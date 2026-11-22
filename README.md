# GameDojo project website

纯静态网站，无需 npm、构建框架或后端。`index.html` 是站点入口，`assets/` 保存样式、脚本、图片、字体和视频，`play/` 保存六个可试玩的游戏页面。

## 本地运行

```sh
./start.sh
```

Windows 双击 `start.bat`。需要 Python 3，启动后会自动打开浏览器；按 Ctrl+C 停止。也可以用 `python3 serve.py 8800` 指定端口。

推荐通过本地 HTTP 服务访问；直接打开 HTML 文件时，浏览器可能限制视频跳转或 3D 游戏的鼠标锁定。试玩需要电脑键盘和鼠标。

## 发布前检查

```sh
python3 tools/check_site.py
```

检查所有 HTML/CSS 本地资源路径、锚点、页面数据引用的图片和视频、游戏入口、文件大小和 JavaScript 语法。路径按文件名大小写检查，与 GitHub Pages 的部署环境保持一致。资源检查只需要 Python 3；JavaScript 语法检查需要本机提供 Node.js，未安装时会明确报告跳过。

首页链接到 [代码仓库](https://github.com/THUSI-Lab/GameDojo)、[GameDojo 数据集](https://huggingface.co/datasets/THUSI-Lab/GameDojo)和 [GameDojo-4B 模型卡](https://huggingface.co/THUSI-Lab/GameDojo-4B)。Paper 暂时标为 Soon。开放时，在 `index.html` 中填写对应 `data-todo` 链接的 `href`，移除 `aria-disabled`、`tabindex`、`title` 和 `.btn__status`，并移除 `data-todo` 属性。

首页的 GitHub 和 Hugging Face 图标来自 [Lobe Icons](https://github.com/lobehub/lobe-icons)，许可见 [LICENSE.txt](assets/icons/models/LICENSE.txt)。

## GitHub Pages

把**当前目录中的内容**放到目标仓库根目录，确保根目录直接包含 `index.html`、`assets/`、`play/` 和 `.github/`。

仓库的 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。推送到 `main` 或 `master` 后，`.github/workflows/pages.yml` 会检查资源并部署；其他分支可以手动运行该工作流，或按目标仓库的默认分支调整触发条件。

工作流只发布 `index.html`、`.nojekyll`、`assets/` 和 `play/`，本地启动器、检查工具及文档不会进入部署产物。也可以选择从分支根目录发布，`.nojekyll` 已备好。

站内资源使用相对路径，同时适用于用户主页根路径和项目仓库子路径；不要将 `assets/` 或 `play/` 改成以 `/` 开头的绝对路径。分享预览的绝对图片地址、站点 canonical 地址等需要等最终仓库和域名确定后再配置。

## 内容和版权

游戏名称、角色、封面和截图属于各自权利人。页面保留原有研究用途说明和字体许可文本；参见页脚版权说明。研究数据、作者和模型结果沿用提供的版本。
