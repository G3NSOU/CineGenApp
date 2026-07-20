# CineGen Backend

Express + SQLite 本地后端，负责项目、素材、生成任务、第三方 AI 配置与媒体处理。

```bash
npm ci
node --test test/*.test.js
npm start
```

默认监听 `127.0.0.1:5679`。首次启动会在 `data/` 创建数据库与存储目录；该目录可能包含项目、素材和凭据，禁止提交到 Git。
