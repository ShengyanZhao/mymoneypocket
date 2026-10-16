# Aurelio 中国本地化二次迭代 PRD（v2-CN）

> 状态：提案稿（PRD，尚未进入开发）
> 范围：在现有 Aurelio 架构（锚点 + 事件 = 现状）之上，面向中国大陆个人用户的记账、资产、账单、行情、税务、规划需求做本地化改造。
> 前置阅读：[README.md](../README.md)、[docs/how-aurelio-reasons.md](how-aurelio-reasons.md)、项目根目录 `ROADMAP.md`（LLM/行情 Provider 改造计划，本文与其对齐并扩展）。

---

## 0. 背景与目标

### 0.1 现状问题

当前项目面向海外生态：

1. **数据入口靠手录**：所有现金流（收入/支出/转账/定投）都靠表单录入，中国用户的主要消费发生在**支付宝、微信支付**，逐笔手录不现实。
2. **行情源是 Yahoo Finance**：A 股 / 港股 / 场内基金代码格式不支持（无 6 位数字、`.SS/.SZ/.HK`），国内网络访问 Yahoo 不稳（见 ROADMAP 实测：403/429）。
3. **币种/税制默认欧美**：税率默认 Italy/Germany/France；"ECB 参考汇率"措辞遍布全项目（后端 78 处 + 前端 40 处）。
4. **资产形态缺失**：A 股打新、场内 ETF、场外基金、可转债、银行理财、国债逆回购、公积金、企业年金、个税/社保/公积金代扣、花呗/白条/信用卡分期等中国特色科目没有建模。
5. **分类词表不适配**：收入/支出分类硬编码 `salary|freelance|...`、`housing|food|...`（前端下拉枚举），不是国内消费分类（餐饮、交通、红包、话费、还贷……）。

### 0.2 二次迭代目标（按优先级）

| 优先级 | 目标 | 一句话验收 |
|---|---|---|
| P0 | **支付宝/微信账单导入** | 从两大平台导出的账单文件一键导入，自动分类、自动去重，落到现金流模型 |
| P0 | **A 股/港股/场内基金行情与代码体系** | 6 位代码、`.HK`、场内 ETF 可录入、可定价、可取分红 |
| P0 | **国内税制与货币口径** | 个税/股息红利差别化/印花税/基金分红免税；全站 CNY 口径，"ECB"措辞可替换 |
| P1 | **中国特色资产建模** | 公积金、企业年金、银行理财、国债逆回购、可转债、打新、花呗/白条/信用卡分期 |
| P1 | **国内常用分类与频次** | 支出/收入分类本土化；支持周/双周/自定义频次（发薪、还分期） |
| P2 | **导出/备份/凭证** | CSV/Excel 导出、发票/截图凭证挂载、加密备份 |
| P2 | **AI 本地化** | 国产 LLM Provider、联网搜索替换（见 ROADMAP，本文不展开） |

### 0.3 非目标（明确不做）

- ❌ 不做代扣代缴/报税申报（只做**估算与提示**，与现有 `tax.py` 的"declared tax estimate"原则一致）。
- ❌ 不做自动抓取银行/券商账户（合规风险高）；只做**用户主动导出文件的导入**（支付宝/微信/券商 CSV）。
- ❌ 不改卡片确认机制、不改"锚点 + 事件"核心模型（`models.py` 的 `Snapshot/CashAnchor/Transaction` 三件套）。
- ❌ 不做多用户/云端同步（保持本地单机，隐私优先）。

---

## 1. 核心领域模型变更

### 1.1 机构（Institution）类型扩展

现有：`bank | broker | insurance | pension_fund | crypto_exchange | other`

新增（枚举扩展，向后兼容）：

| 新值 | 说明 | 现金流接入点 |
|---|---|---|
| `payment_wallet` | 支付宝/微信钱包 | 余额是活期现金，账单是支出/收入 |
| `broker_cn` | 券商（含两融、期权、可转债账户） | 投资流水 + 托管现金 |
| `fund_otc` | 场外基金代销（天天基金/蚂蚁/银行 App） | 申赎流水 + 份额快照 |
| `bank_wm` | 银行理财/存款/国债逆回购 | 本金快照 + 到期收益 |
| `social_security` | 社保/公积金账户 | 只记录余额快照（不参与现金流，除非提取） |
| `employer_equity` | 企业年金/股权激励（ESOP） | 份额快照 + 归属事件 |

### 1.2 持仓（Holding）与资产类别扩展

- `asset_class` 枚举新增：`money_fund`（货基）、`bond_fund`、`convertible_bond`、`bank_wm`（理财）、`reverse_repo`（逆回购）、`social_security`、`fund_otc`。
- 新增字段（可选，全部 nullable，不破坏现有行）：
  - `product_code`：6 位场内代码 / 理财登记编码 / 基金代码（区别于 `symbol` 行情代码、`isin` 基金身份，三者职责不变）。
  - `nav_date` / `nav_price`：场外基金净值日期与净值（T+1 确认规则见 §5.3）。
  - `locked` / `lock_until`：封闭期、打新锁定期、年金归属期。
- `distribution_policy` 语义扩展：A 股/港股默认 `dist`（现金分红），货基默认 `dist`（日结转/月结转二选一，见 §5.4）。

### 1.3 现金流模型：从"周期流"到"逐笔 + 周期流"双轨

现有 `IncomeSource`/`Expense` 是**周期性发生额**（amount × frequency），适合工资、房租；但支付宝/微信账单是**逐笔**的。

新增 `CashEntry`（逐笔现金流）表：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int PK | |
| `date` | str YYYY-MM-DD | 发生日（不是记账日） |
| `institution_id` | FK | 钱包/账户 |
| `direction` | `in \| out` | 收/支 |
| `amount` | float | 绝对值，`currency` 恒为 CNY（首期） |
| `currency` | str | 默认 CNY，允许港币/美元 |
| `category` | str | 国内分类词表（§3.2），可自定义 |
| `counterparty` | str? | 商户/对方（如"美团""张三"） |
| `channel` | str? | `alipay \| wechat \| bank_card \| cash \| other` |
| `note` | text? | 用户备注 |
| `external_id` | str? | **账单去重键**（支付宝交易号/微信单号），UNIQUE(institution_id, external_id) |
| `import_batch_id` | FK? | 导入批次（可整体回滚） |
| `is_transfer_leg` | bool | 是否是转账的一侧（避免与 `Transfer` 双计） |
| `linked_transfer_id` | FK? | 关联的 Transfer |

> **与现有模型的关系**：`IncomeSource`/`Expense` 保留，继续表示"预期的周期流"（用于预算/预测）；`CashEntry` 表示"已发生的逐笔"（用于对账/复盘）。**现金推演（`analytics.compute_cash_position`）改为：锚点 + Σ CashEntry(逐笔) + 周期流未被逐笔覆盖的部分 + Transfer + 投资流水**。去重规则见 §4.3。

### 1.4 负债（Liability）扩展

`kind` 新增：`huabei`（花呗）、`baitiao`（白条）、`credit_card_installment`（信用卡分期）、`consumer_loan`（消费贷）、`mortgage_cn`（公积金组合贷）。

新增字段：
- `grace_days`：免息期（花呗/白条/信用卡），用于现金流预测。
- `installment_plan`：JSON，记录分期期数/每期金额/手续费率（用于"实际年化利率"提示，参考 IRR 口径）。

### 1.5 转账（Transfer）扩展

新增 `channel` 与 `fee` 字段：微信/支付宝提现手续费、跨行转账费。手续费记为独立 `CashEntry`（category=`transfer_fee`），不并入 Transfer 金额，保持"一笔转账 = 两侧金额 + 可选费用行"的清晰性。

---

## 2. 账单导入（支付宝 / 微信 / 银行 / 券商）

### 2.1 导入通道

| 通道 | 文件格式 | 解析器 | 备注 |
|---|---|---|---|
| 支付宝 | `alipay_record_*.csv`（账单页"下载账单"） | `importers/alipay.py` | GBK/GB18030 编码；表头多行说明需跳过 |
| 微信支付 | `微信支付账单-*.csv` | `importers/wechat.py` | 同上；含红包/零钱通/亲属卡 |
| 银行 | 网银导出 CSV/Excel（招行/工行/建行模板） | `importers/bank.py` | 各行模板不同，走"模板映射"机制 |
| 券商 | 交割单/资金流水 CSV（同花顺/东方财富/各券商） | `importers/broker.py` | 落到 `Transaction`（buy/sell/dividend/close） |
| 通用 | 手工 CSV 模板（下载） | `importers/generic.py` | 兜底 |

> **设计原则**：导入是**幂等**的（`external_id` 去重）、**可整体回滚**的（`import_batch_id`）、**绝不静默写入**的（走卡片确认，复用现有 Proposal 机制）。

### 2.2 导入流程（用户视角）

1. 用户在支付宝/微信 App 导出账单（.csv/.zip），上传到 Aurelio（前端拖拽或选择文件）。
2. 后端 `POST /api/imports/preview`：解析 → 返回结构化预览（条数、金额合计、日期范围、识别到的转账对、建议分类、疑似重复）。
3. 用户确认（走**卡片确认**，与 AI 提案同一套 UI）：可逐条勾选、改分类、合并/拆分、标记为"转账一侧"。
4. `POST /api/imports/commit`：批量落库，返回批次号；同批次可 `DELETE /api/imports/{batch_id}` 整体撤销。

### 2.3 自动分类规则（可学习）

- **商户 → 分类**映射表（种子数据内置 500+ 常见商户：美团/饿了么→餐饮外卖，滴滴→交通，京东/淘宝→购物，国家电网→水电燃气，中国移动→通讯，……）。
- **金额区间 + 时段**规则（如 03:00–05:00 的小额支出 → 夜宵/打车）。
- 用户每次纠正分类，规则权重上调（本地学习，不出机器）。
- 未识别项进"待分类"队列，可批量处理；AI 聊天可调用 `suggest_categories` 工具给出建议（走卡片确认）。

### 2.4 转账自动配对

同一日 ±3 天内、金额相等（或扣除手续费后相等）、一侧是 `payment_wallet` 另一侧是 `institution` 的两条 `CashEntry`，自动建议合并为一条 `Transfer`（两侧腿标记 `is_transfer_leg`）。用户确认后原逐笔保留但**不再计入现金流**（避免双计）。

### 2.5 对账与差异

- 每月一次"钱包对账"：导入账单期间末余额 vs `CashAnchor` 推演余额，差异列表明原因（未导入的红包/理财赎回/提现）。
- 一键"以账单余额创建新 CashAnchor"（复用现有锚点重定基语义，天然防双计）。

---

## 3. 分类词表与频次本土化

### 3.1 收入分类（替换 `salary|freelance|...`）

`wage`（工资）、`bonus`（奖金）、`red_packet`（红包/转账收入）、`reimbursement`（报销）、`investment_income`（投资收益：分红/利息/买卖价差）、`rental`（房租）、`side_hustle`（兼职/稿费）、`pension`（养老金/年金）、`other`。

### 3.2 支出分类（替换 `housing|food|...`）

`dining`（餐饮）、`transport`（交通）、`shopping`（购物）、`housing`（房租/物业）、`utilities`（水电燃气）、`telecom`（通讯）、`medical`（医疗）、`education`（教育）、`entertainment`（文娱）、`travel`（旅行）、`insurance`（保费）、`debt_payment`（还贷/分期）、`gift`（人情/红包）、`social_security`（社保公积金个人部分）、`tax`（个税）、`other`。

> 分类词表从**前端硬编码**（`CashFlow.tsx` 的 `INCOME_CATEGORIES/EXPENSE_CATEGORIES`）迁移到后端 `GET /api/taxonomy`，支持用户自定义扩展（`taxonomy_user` 表），避免再出现"前端枚举 vs 后端自由文本"的漂移。

### 3.3 频次扩展

现有 `monthly | quarterly | semiannual | annual | one_off`（`analytics.STEP_MONTHS` 按月步进）。

新增：`weekly`、`biweekly`（双周，发薪/分期常见）、`custom`（指定每月第 N 天/每周几）。

实现：`analytics.recurrence` 增加 `step_days` 分支（周/双周用日差，月/季/半年/年保留月步进），`STEP_MONTHS` 之外引入 `STEP_DAYS = {"weekly": 7, "biweekly": 14}`。所有调用方（`pac.plan_occurrences`、`analytics._flow_sum_in_window`、`tools._write_flow` 的校验 Literal）同步扩展。

---

## 4. 代码体系与行情源（与 ROADMAP Phase 5 对齐）

### 4.1 代码格式映射（`prices.resolve_symbol` 扩展）

| 市场 | 归一化格式 | 示例 | 行情 Provider |
|---|---|---|---|
| 上交所 | `600519.SS` | 贵州茅台 | akshare / 新浪 / 腾讯 |
| 深交所 | `000001.SZ` | 平安银行 | 同上 |
| 创业板/科创板 | `300750.SZ` / `688981.SS` | | 同上 |
| 场内基金 | `510300.SS` / `159915.SZ` | 沪深300ETF / 创业板ETF | 同上 |
| 港股 | `00700.HK` | 腾讯 | akshare / 富途 |
| 美股 | `AAPL` | | Yahoo（代理）/ akshare |
| 场外基金 | `110011`（6 位基金代码） | 易方达中小盘 | 天天基金/好买净值接口 |
| 可转债 | `113050.SH` / `123xxx.SZ` | | akshare |
| 加密 | `BTC-USDT` | | 币安/OKX（可选） |

> 输入宽容：用户输 `600519` 自动补 `.SS`，输 `0700` 自动补 `.HK`，输 `510300` 自动判市；ISIN（`CN000...`/`CNE...`）走 OpenFIGI 或本地映射。

### 4.2 三层降级链（Provider 抽象，见 ROADMAP §2）

`CnProvider`（akshare/新浪/腾讯） → `YahooProvider`（代理场景） → `ManualProvider`（手动价/净值）。

分红/派息接口按市场拆分：
- A 股：分红送转（akshare `stock_history_dividend`）+ **股息红利差别化税率**（§5.1）。
- 港股：分红（含港币计价）。
- 场外基金：**分红方式（现金分红/红利再投）** 由 `distribution_policy` 决定；红利再投等价于 `acc`，现金分红记 `dividend` 流水。
- 货基：**日结转（万份收益）/月结转** 二选一，见 §5.4。

### 4.3 净值与确认日（T+1 / T+2）

场外基金申购/赎回按**确认日**（而非申请日）入账：
- `Transaction` 新增 `trade_date`（申请日）与 `confirm_date`（确认日/净值日），现金流按 `trade_date`（钱当天划走），份额按 `confirm_date`（净值日）。
- 现金流与持仓之间的"在途"状态：`CashEntry` 可标记 `pending`（资金已划出、份额未确认），总资产视图提示"在途金额"。

---

## 5. 税务与中国口径

### 5.1 个税/股息红利（`tax.DEFAULTS` 扩展）

| 项目 | 规则 | 备注 |
|---|---|---|
| A 股股息红利 | 持股 ≤1 个月 20%；1 个月–1 年 10%；>1 年 **免征** | 差别化政策，需按持股期分档 |
| 港股通股息 | H 股 20%（红筹/民企口径不同，可配置） | 通过港股通持有 |
| 基金分红 | **免征**个人所得税 | |
| 股票/基金转让价差 | **暂免**（A 股/公募基金） | 境外股票按 20% 财产转让所得 |
| 印花税 | 卖出 0.05% | 场内股票；基金/债券免 |
| 过户费/经手费 | 0.001%–0.00341% 可配置 | 按券商实际 |
| 工资个税 | 累计预扣法（7 级超额累进） | 只做估算提示，不申报 |

> 实现：`tax.py` 的 `Rates` 增加 `stamp_duty_sell`、`transfer_fee`、`dividend_holding_period`（分档向量）；`estimate()` 输入增加 `holding_period_days`（取自 `Transaction.date` 与持仓成本批次）。**界面永远标注"估算"，可覆盖**（与现有 `estimated` 字段语义一致）。

### 5.2 汇率源去中心化（"ECB" 措辞替换）

- `fx.py` 引入 `source_name()`（`ECB` / `CFETS 人民币中间价` / `中国银行外汇牌价`），文案统一为"以 {source} 当日参考汇率为准"。
- 优先级：CFETS 中间价（权威、含 CNY）→ Frankfurter/ECB（外币交叉盘）→ 手动录入。
- 后端 78 处 + 前端 40 处文案改为模板参数（一次性 grep 替换 + i18n key）。

### 5.3 货基与万份收益

- 持仓行新增 `yield_type`：`daily_accrual`（日结转，万份收益日切）/ `monthly_accrual`（月结转）。
- 收益记账：`daily_accrual` 每日生成 `CashEntry(in, category=investment_income)` 或聚合为月度 `dividend`；`monthly_accrual` 月末一次性。
- 万份收益数据源：天天基金/好买 API，或手动录入。

### 5.4 公积金 / 企业年金 / 个税代扣

- `social_security` 机构下的 `CashAnchor` 只作余额快照展示（**不参与净资产**，因为提取受限；配置项可开关"计入净资产"）。
- 工资流水的税前/税后拆分：`CashEntry` 新增 `gross_amount`、`tax_withheld`、`social_insurance`、`housing_fund` 字段（工资类明细），用于个税估算与"到手收入"统计。

---

## 6. 负债与分期建模

- 花呗/白条：**免息期内 = 流动性负债**，账单日生成 `Expense(debt_payment)`；分期后转 `Liability(credit_card_installment)`，`installment_plan` 记录每期本金/手续费。
- 信用卡分期：真实年化利率用 IRR 反推（`planning.required_annual_return` 的同款数值方法），界面提示"名义费率 X%，实际年化 Y%"。
- 公积金组合贷：`Liability(mortgage_cn)` 拆分公积金部分（低息）与商贷部分，还款计划按等额本息/等额本金分别预测。

---

## 7. 目标与规划本土化

- 目标类型扩展：`emergency_fund`（3–6 个月支出，自动计算并提示）、`housing_down_payment`（首付）、`children_education`（教育金）、`retirement`（养老）、`car`、`travel`、`custom`。
- 首付/教育金目标：`planning.compute_required_return` 已有数学，新增**收入增长率**与**通胀假设**参数（默认 3%），结论标注"名义/实际购买力"两种口径。
- 应急资金提示：`analytics.compute_summary` 增加 `months_of_essential_covered`（现有 advisor.py 已有雏形，提升为 Dashboard 一等指标）。

---

## 8. 数据导出、凭证与隐私

- **导出**：CSV（账单/流水/持仓）、Excel（对账表）、JSON（全量备份）。字段与现有 schema 对齐，含 `external_id`/`import_batch_id`。
- **凭证**：`CashEntry`/`Transaction` 支持挂载图片（发票/截图/交割单 PDF），存本地目录 `backend/attachments/{yyyy}/{mm}/`，数据库只存路径 + 哈希（校验完整性）。
- **备份**：一键"导出加密备份"（SQLCipher 或 age 加密的 zip，含数据库 + 附件），恢复走 `/api/restore`。
- **隐私声明**：README 增补"数据出境清单"——明确哪些请求会出网（LLM Provider、行情源、汇率源、基金目录下载），每项可单独禁用/降级到手动。

---

## 9. AI 顾问本地化（对齐 ROADMAP，仅列接口变化）

- LLM Provider 抽象（DeepSeek/Kimi/GLM/豆包/本地 Ollama）——见 ROADMAP §2/§3。
- 联网搜索替换：智谱/Kimi 内置搜索 或 Tavily；**所有搜索结果回灌仍走卡片确认**（防提示注入）。
- 新增工具（走卡片确认）：`import_suggestion`（给未分类账单建议分类）、`tax_reminder`（个税汇算清缴提醒）、`goal_rebalance`（目标进度偏差调整建议）。
- MCP 服务器契约不变（只读）。

---

## 10. 非功能需求

| 项 | 要求 |
|---|---|
| 批量导入性能 | 1 万条账单 < 3 秒解析，预览 < 1 秒 |
| 幂等 | 同一文件重复导入 0 新增；`external_id` 唯一约束兜底 |
| 可回滚 | 按批次撤销，撤销后逐笔/转账/对账状态一致恢复 |
| 编码兼容 | GBK/GB18030/UTF-8 BOM 自动探测 |
| 离线可用 | 已下载的行情/目录/汇率缓存可离线查询（现有缓存机制保留） |
| 本地存储 | 默认全本地；任何出网请求在 UI 可见、可关闭 |
| 时区/日期 | 统一 `Asia/Shanghai`（现有 `dated.today()` 抽象复用） |

---

## 11. 分期实施建议

| 里程碑 | 内容 | 依赖 |
|---|---|---|
| **M1（P0）** | 支付宝/微信账单导入 + `CashEntry` 模型 + 分类词表本土化 + 转账配对 | 无 |
| **M2（P0）** | A 股/港股/基金代码体系 + 国内行情 Provider + 三层降级 | ROADMAP Phase 5 |
| **M3（P0）** | 中国税制 + 汇率源去中心化 + CNY 口径 | ROADMAP Phase 6 |
| **M4（P1）** | 公积金/年金/理财/分期负债建模 + T+1 净值确认 | M1–M3 |
| **M5（P1）** | 周/双周频次 + 目标本土化 + 应急资金指标 | M1 |
| **M6（P2）** | 导出/凭证/加密备份 | M1 |
| **M7（P2）** | AI Provider + 搜索替换 + 新增工具 | ROADMAP Phase 2–4 |

---

## 12. 验收标准（摘选）

1. 导入一份真实支付宝年度账单（>2000 条）：解析成功率 ≥ 99%，自动分类准确率 ≥ 85%（人工纠正后可学习），重复导入新增 0 条。
2. 录入 `600519`、`510300`、`00700.HK`、`110011` 各一笔买入：行情可取、市值可算、分红/收益可记。
3. 设置持股期 <1 月与 >1 年的两笔股息：税务估算分别给出 20% 与免税两档。
4. 花呗账单分期 12 期：现金流预测按月扣款，界面显示"名义费率 7.2%，实际年化 13.0%"。
5. 全站措辞搜索 "ECB" 无残留；汇率来源可在设置里切换为"CFETS 人民币中间价"。
6. 任何 LLM 写入仍必须经卡片确认；禁用出网后核心记账/查看功能完全可用。

---

## 附录 A：与现有模型的兼容策略

- 所有新字段 **nullable / 有默认值**，Alembic 迁移保持旧行语义不变。
- `CashEntry` 是**新增表**，不动 `IncomeSource/Expense` 的 DDL（尊重原作者"两表不合并"的设计原则）。
- 现金推演函数 `compute_cash_position` 的算式扩展为：`anchor + ΣCashEntry(非转账腿) + Σ周期流(未被逐笔覆盖) + transfers + 投资流水`，并保留原函数签名作为兼容包装（`compute_cash_position` 不带 `cash_entries` 参数时退化为旧行为）。
- 前端分类下拉改读 `/api/taxonomy`，旧枚举值通过 `taxonomy_alias` 映射表平滑过渡。

## 附录 B：术语对照

| 中文 | 英文/字段 | 说明 |
|---|---|---|
| 现金锚点 | `CashAnchor` | 某日某账户实际余额 |
| 逐笔流水 | `CashEntry`（新） | 账单导入/手工的一笔收付 |
| 周期流 | `IncomeSource`/`Expense` | 工资、房租等规律发生额 |
| 投资流水 | `Transaction` | 买卖/分红/清仓 |
| 快照 | `Snapshot` | 某日持仓照片 |
| 卡片确认 | Proposal card | AI 任何写入的人工确认机制 |
