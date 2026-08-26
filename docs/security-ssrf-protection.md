# SSRF 攻击防护文档

## 概述

UpdateRadar 已实施全面的 SSRF（服务器端请求伪造）防护机制，阻止用户通过配置恶意 URL 访问内网资源和云服务元数据。

## 防护范围

### 受保护的字段

以下数据源配置字段已启用 SSRF 防护：

1. **official-website**
   - `officialUrl` - 官网数据地址
   - `homepageUrl` - 官网页面地址

2. **rss**
   - `feedUrl` - RSS/Atom 订阅地址

### 被阻止的地址类型

#### 1. Localhost 和环回地址
- `localhost`（不区分大小写）
- `127.0.0.0/8` - 所有 127.x.x.x 地址
- `0.0.0.0`
- `::1` 和 `[::1]` - IPv6 环回地址

#### 2. 私有 IPv4 网络（RFC 1918）
- `10.0.0.0/8` - A 类私有网络
- `172.16.0.0/12` - B 类私有网络（172.16.0.0 - 172.31.255.255）
- `192.168.0.0/16` - C 类私有网络

#### 3. 特殊用途 IPv4 地址
- `169.254.0.0/16` - Link-local 地址
  - 特别保护 `169.254.169.254` - AWS/Azure/GCP 云元数据服务
- `100.64.0.0/10` - 共享地址空间（RFC 6598）
- `224.0.0.0/4` - 组播地址（224.0.0.0 - 239.255.255.255）
- `240.0.0.0/4` - 保留地址（240.0.0.0 - 255.255.255.255）

#### 4. 私有 IPv6 地址
- `fc00::/7` - 唯一本地地址（fc00:: - fdff::）
- `fe80::/10` - 链路本地地址（fe80:: - febf::）

#### 5. 本地域名后缀
- `.local`
- `.internal`
- `.private`
- `.localhost`

## 实现细节

### 核心函数

```javascript
function isPrivateOrLocalhost(hostname)
```

该函数接收 URL 的主机名部分，执行以下检查：

1. **标准化处理** - 转换为小写以防止大小写绕过
2. **字符串匹配** - 检查 localhost 和常见变体
3. **IPv4 解析** - 使用正则表达式解析 IPv4 地址并验证每个八位组
4. **CIDR 范围检查** - 验证 IP 是否落在私有或保留范围内
5. **IPv6 检测** - 检查常见的 IPv6 私有地址前缀
6. **域名后缀检查** - 阻止以本地域名后缀结尾的主机名

### 集成方式

```javascript
function validUrl(value, field, { allowPrivate = false } = {})
```

扩展的 URL 验证函数在解析 URL 后自动调用 `isPrivateOrLocalhost()` 检查。

### 运行时防护

除了配置层验证，系统在 HTTP 请求层也实施了 SSRF 防护：

#### HTTP 客户端防护 (`src/lib/http.js`)

```javascript
export async function fetchText(url, options = {}) {
  validateUrl(url);  // 请求前验证
  const response = await fetch(url, { redirect: "follow" });
  validateUrl(response.url, "重定向目标");  // 重定向后再次验证
  return response.text();
}
```

防护特性：
- 请求前验证 URL 不指向私有地址
- 跟随重定向后，验证最终 URL 不指向私有地址
- 统一的超时控制（默认 15 秒）

#### 翻译服务防护 (`src/translation.js`, `src/settings.js`)

- 用户配置的翻译服务 `baseUrl` 必须指向公网地址
- 翻译请求发送前验证目标 URL
- 阻止通过翻译接口访问内网服务

#### 统一适配器模式

所有外部 HTTP 请求统一通过 `fetchText()` 发起，确保一致的 SSRF 防护覆盖：

| 适配器 | URL 来源 | 防护层 |
|--------|----------|--------|
| RSS | `source.feedUrl` | 配置验证 + 运行时验证 |
| 官网监控 | `source.officialUrl` | 配置验证 + 运行时验证 |
| 游戏资讯 | 硬编码公网 URL | 运行时验证 |
| 翻译服务 | 用户配置 `baseUrl` | 配置验证 + 运行时验证 |

## 安全边界

### 被阻止的攻击向量

✅ 直接 IP 访问
```
http://192.168.1.1/admin
http://10.0.0.5:8080/api
```

✅ 云元数据服务
```
http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

✅ 大小写绕过尝试
```
http://LOCALHOST/api
http://LocalHost/api
```

✅ IPv6 绕过尝试
```
http://[::1]/api
http://[fe80::1]/api
```

✅ 本地域名
```
http://server.local/api
http://admin.internal/config
```

### 允许的合法地址

✅ 公网 IP
```
https://8.8.8.8/api
https://1.1.1.1/api
```

✅ 公网域名
```
https://api.github.com/repos/nodejs/node/releases
https://www.google.com/search
```

✅ 标准公共服务
```
https://registry.npmjs.org/package/latest
```

## 测试覆盖

SSRF 防护包含 43 个专门测试用例，覆盖：

- ✅ 7 种 localhost 变体
- ✅ 14 种私有 IPv4 地址范围
- ✅ 4 种私有 IPv6 地址
- ✅ 4 种本地域名后缀
- ✅ 6 种合法公网地址
- ✅ 8 种边界和多字段场景

测试文件：`test/ssrf-protection.test.js`

运行测试：
```bash
npm test
```

## 使用示例

### 被阻止的配置

```javascript
// ❌ 尝试访问内网 NAS
{
  "id": "internal-nas",
  "kind": "official-website",
  "officialUrl": "http://192.168.1.100/api/version"
}
// 错误：官网数据地址不能指向内网或本地地址

// ❌ 尝试访问云元数据
{
  "id": "aws-metadata",
  "kind": "rss",
  "feedUrl": "http://169.254.169.254/latest/meta-data"
}
// 错误：RSS/Atom 地址不能指向内网或本地地址
```

### 允许的配置

```javascript
// ✅ 合法的 GitHub Releases
{
  "id": "nodejs",
  "kind": "github-releases",
  "owner": "nodejs",
  "repo": "node"
}

// ✅ 公开的 RSS 订阅
{
  "id": "github-blog",
  "kind": "rss",
  "feedUrl": "https://github.blog/feed/"
}

// ✅ 公网 API
{
  "id": "public-api",
  "kind": "official-website",
  "officialUrl": "https://api.example.com/version",
  "officialFormat": "json",
  "versionPath": "version"
}
```

## 已知限制

### DNS 重绑定攻击
当前实现在 URL 验证阶段检查主机名，无法防御以下场景：

1. **DNS 记录变更** - 域名在验证后被解析为内网 IP
2. **短 TTL 欺骗** - 使用极短的 DNS TTL 在验证和请求之间切换解析结果

**缓解措施**：
- 在生产环境中，建议在 HTTP 客户端层面也实施 IP 白名单检查
- 可考虑使用 DNS 缓存或固定 DNS 解析器

### CNAME 链绕过
攻击者可能通过 CNAME 记录间接指向内网地址：
```
public.example.com -> internal.local -> 192.168.1.1
```

**缓解措施**：
- 当前防护已覆盖常见本地域名后缀（`.local`, `.internal`）
- 可考虑实施最终 IP 地址检查

## 维护指南

### 添加新的受保护字段

当添加新的数据源类型时，确保所有接受用户提供 URL 的字段都使用 `validUrl()` 函数：

```javascript
if (kind === "new-source-type") {
  source.apiUrl = validUrl(input.apiUrl, "API 地址");
}
```

### 更新私有地址范围

如需添加新的私有地址范围，在 `isPrivateOrLocalhost()` 函数中添加相应检查：

```javascript
// 示例：添加新的保留范围
if (a === 198 && b >= 18 && b <= 19) return true; // 198.18.0.0/15 基准测试
```

### 允许特定内网访问（不推荐）

如果在受控环境中确实需要访问内网资源，可以为特定数据源类型添加例外：

```javascript
// 在 normalizeSource() 中
if (kind === "internal-api") {
  source.apiUrl = validUrl(input.apiUrl, "API 地址", { allowPrivate: true });
}
```

**警告**：仅在完全信任的私有部署中启用此选项。

## 相关资源

- [OWASP SSRF 防护备忘单](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [RFC 1918 - 私有地址分配](https://tools.ietf.org/html/rfc1918)
- [RFC 6598 - 共享地址空间](https://tools.ietf.org/html/rfc6598)
- [CWE-918: Server-Side Request Forgery](https://cwe.mitre.org/data/definitions/918.html)

## 变更日志

### 2024-01-XX - 初始实现
- ✅ 实现 `isPrivateOrLocalhost()` 核心检查函数
- ✅ 集成到 `validUrl()` URL 验证逻辑
- ✅ 保护 `official-website` 和 `rss` 数据源
- ✅ 添加 43 个单元测试
- ✅ 覆盖 IPv4/IPv6 私有地址、localhost 变体、本地域名
