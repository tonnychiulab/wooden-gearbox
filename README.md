# 木製 5 速手排變速箱 · Wooden 5-Speed Gearbox

一個可以拆開看的 3D 互動模擬器：用木頭做的三軸式 5 速手排變速箱。單一離線 HTML 頁面，用 Three.js 繪製，不需要後端。

**線上體驗：<https://tonnychiulab.github.io/wooden-gearbox/>**

## 你可以做什麼

- 切換 **N 與 1 到 5 檔**，看套筒如何退回中位再滑向新檔位，動力如何改走另一組齒輪。
- 拖動**引擎轉速**，儀表同步顯示輸出轉速、傳動比、輸出扭力和車速。
- 用**動力路徑**把正在傳遞動力的零件亮成橘色，用**外殼**開關做剖開檢視。
- 四種視角、標註開關，拖曳旋轉、滾輪縮放。
- 什麼都不做時會自動導覽，點擊就由你接手，靜止 25 秒後恢復。

| 按鍵 | 功能 |
|---|---|
| `0` 到 `5` | 空檔與 1 到 5 檔 |
| `q` `w` `e` `r` | 全景、側視、俯視、端視 |
| `c` `l` `p` | 外殼、標註、動力路徑 |
| `t` | 自動導覽開關 |

## 機械數據

數據只在 [`src/main.js`](src/main.js) 的齒數表定義一次，畫面上的動作、儀表和圖表都讀同一份，不會互相矛盾。

- 模數 4 mm，每一對嚙合的齒數和都是 60，所以中心距固定為 4 × 60 ÷ 2 = **120 mm**。
- 第一級：輸入齒輪 24T 帶動中間軸 36T，比值 1.5。
- 第二級：中間軸與主軸齒輪配對，決定檔位。

| 檔位 | 中間軸 | 主軸 | 總傳動比 |
|---|---|---|---|
| 1 | 18T | 42T | 3.500 |
| 2 | 24T | 36T | 2.250 |
| 3 | 30T | 30T | 1.500 |
| 4 | 36T | 24T | 1.000 |
| 5 | 42T | 18T | 0.643 |

- 最終減速比 4.1，輪胎周長 1.9 m，用來換算車速。
- 畫面是 1/30 慢動作，否則轉速一高只會看到一團模糊。

## 簡化之處

這是教學模型，不是工程圖。

- 沒有同步環，只有滑動套筒（dog collar），所以是「不同步」的簡化結構。
- 沒有倒檔。
- 輸入軸與主軸同軸，但沒畫軸承內部細節。
- 扭力曲線是一條通用的汽油引擎曲線，不代表任何實際車款。
- 木紋是程式產生的紋理，齒形是簡化的梯形齒，不是漸開線。

## 專案結構

```
index.html     打包後的單檔頁面（部署用）
src/main.js    機器本體：齒數表、幾何、動作、介面
src/style.css  介面樣式
```

## 重新建置

用 [teardown](https://github.com/elvarofficial/teardown) 技能的建置工具把 `src/` 打包成單一 HTML：

```bash
git clone https://github.com/elvarofficial/teardown
cd teardown && npm install
mkdir wooden-gearbox && cp ../src/* wooden-gearbox/
node sims/build.mjs ./wooden-gearbox   # 輸出到 teardown-out/dist/wooden-gearbox.html
```

需要 Node.js 20 以上。

## 授權與致謝

- 本專案以 MIT 授權釋出。
- 建置工具與頁面架構來自 [elvarofficial/teardown](https://github.com/elvarofficial/teardown)（MIT），它又建立在 [whaleyxbt/claude-motion](https://github.com/whaleyxbt/claude-motion)（MIT）之上。
- 3D 繪製使用 [three.js](https://threejs.org/)（MIT），字型為 JetBrains Mono（OFL）。
