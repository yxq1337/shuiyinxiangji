# AI 电话外呼（DeepSeek 话术 + 阿里云线路）

## 功能概览

- 管理员在 `/tool/ai-call` 控制台输入外呼需求，DeepSeek 生成可直接朗读的话术；
- 填写号码列表（每行一个，自动去重校验）后创建外呼任务；
- 号码经云函数调用阿里云外呼接口拨打；
- 任务记录保存在 CloudBase `ai_call_tasks` 集合；
- 未配置阿里云密钥时自动进入「演练模式」：照常创建任务但不会真实拨号。

入口：工具页 →「AI 电话外呼」（仅管理员可见）。

## 架构

```
浏览器 /tool/ai-call
     │  Authorization: Bearer <管理员令牌>
     ▼
CloudBase 云函数 api
     ├─ POST /ai-call/script   → DeepSeek chat/completions 生成话术
     ├─ POST /ai-call/tasks    → 阿里云 RPC（默认 SingleCallByTts）逐个拨打
     ├─ GET  /ai-call/tasks    → 任务列表
     └─ POST /ai-call/callback → 服务商回调更新状态（预留）
```

管理员令牌在「管理员登录」时由云函数签发（HMAC-SHA256，12 小时有效，密钥取
`ADMIN_TOKEN_SECRET`，未设置时回退到 `ADMIN_PASSWORD`）。所有 `/ai-call/*` 写操作
都校验该令牌，防止匿名触发真实呼叫。

## 阿里云开通步骤

> 以阿里云控制台实际要求为准。国内外呼属强监管业务，以下为一般路径。

1. **企业实名认证**
   - 阿里云账号完成企业实名（个人实名通常无法开通语音外呼线路）。
2. **选择产品**
   - 简单通知类外呼：**语音服务（VMS）**，使用「语音通知」能力。
     - 需在控制台购买号码（外呼显示号）并完成报备；
     - 需创建并通过审核 **TTS 模板（TtsCode）**，模板变量与 `TtsParam` 对应。
   - 对话式 AI 外呼（多轮自由对话）：**云呼叫中心 / 智能外呼机器人**。
     - 话术、意图、对话流程需在该产品控制台配置，由平台侧大模型驱动；
     - 本仓库默认对接的是 VMS「语音通知」接口，如需对话式外呼，请把
       `ALIYUN_CALL_ENDPOINT / VERSION / ACTION` 改为对应产品的接口后扩展
       `placeOutboundCall` 的参数映射。
3. **创建 AccessKey**
   - RAM 用户，授予语音服务相关权限（最小权限原则），生成 AccessKey ID/Secret。
4. **拿到关键参数**
   - 外呼显示号码（`ALIYUN_CALLER_NUMBER`）
   - 已审核 TTS 模板编码（`ALIYUN_TTS_CODE`）
   - 模板变量名（`ALIYUN_TTS_CONTENT_KEY`，默认 `content`；需与控制台模板一致）

## 云函数环境变量

在 CloudBase 控制台 → 云函数 `api` → 配置 → 环境变量中设置：

| 变量 | 必填 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 话术生成必填 | DeepSeek API Key |
| `DEEPSEEK_MODEL` | 否 | 默认 `deepseek-chat` |
| `DEEPSEEK_BASE` | 否 | 默认 `https://api.deepseek.com` |
| `ALIYUN_ACCESS_KEY_ID` | 外呼必填 | 阿里云 AccessKey ID |
| `ALIYUN_ACCESS_KEY_SECRET` | 外呼必填 | 阿里云 AccessKey Secret |
| `ALIYUN_CALLER_NUMBER` | 外呼必填 | 外呼显示号码 |
| `ALIYUN_TTS_CODE` | 外呼必填 | 已审核 TTS 模板编码 |
| `ALIYUN_CALL_ENDPOINT` | 否 | 默认 `dyvmsapi.aliyuncs.com` |
| `ALIYUN_CALL_VERSION` | 否 | 默认 `2017-05-25` |
| `ALIYUN_CALL_ACTION` | 否 | 默认 `SingleCallByTts` |
| `ALIYUN_TTS_CONTENT_KEY` | 否 | 模板变量名，默认 `content` |
| `ALIYUN_REGION_ID` | 否 | 默认 `cn-hangzhou` |
| `ADMIN_TOKEN_SECRET` | 建议 | 管理员令牌签名密钥；不设则用 `ADMIN_PASSWORD` |

修改环境变量后需在控制台保存并等待函数配置更新生效。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/ai-call/status` | 配置状态（是否已配置 DeepSeek / 阿里云） |
| POST | `/ai-call/script` | `{ requirement, tone? }` → 生成话术 |
| POST | `/ai-call/tasks` | `{ numbers[], script, requirement?, dryRun? }` → 创建任务 |
| GET | `/ai-call/tasks` | 最近 50 条任务 |
| GET | `/ai-call/tasks/:id` | 任务详情 |
| POST | `/ai-call/callback` | 服务商回调，`{ taskId, number, status, callId, duration }` |

写操作均需请求头 `Authorization: Bearer <管理员令牌>`（管理员登录接口返回 `adminToken`）。

## 回调

在阿里云控制台把外呼结果回调地址配置为：

```
https://shuiyinxiangji-d2gbpqs4wea28beb5-1415424323.ap-shanghai.app.tcloudbase.com/api/ai-call/callback
```

`/ai-call/callback` 目前只记录 `lastCallback` 字段。**上线真实线路前必须补充回调签名
校验**（云函数内已留 TODO），否则任何人可伪造通话状态。

## 合规要求

- 商业营销外呼需提前报备号码与话术模板，遵守《通信短信息和语音呼叫服务管理规定》；
- 禁止对未同意的用户进行骚扰/诈骗性外呼；
- 建议在话术开头自报身份，并提供拒接/退订说明；
- 单次任务上限 50 个号码（云函数内硬限制），防止误操作放大费用。

## 联调建议

1. 先配 `DEEPSEEK_API_KEY`，在控制台用「生成话术」验证模型链路；
2. 未配阿里云时用「演练模式」验证任务创建与记录；
3. 阿里云开通后填齐 4 个必填变量，关闭演练模式，先用 1 个自己的号码测试；
4. 上线前补充回调签名校验与真实号码的黑白名单策略。
