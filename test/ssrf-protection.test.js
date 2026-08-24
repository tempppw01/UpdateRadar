import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { normalizeSource, SourceValidationError } from "../src/sources.js";

describe("SSRF Protection", () => {
  describe("阻止 localhost 变体", () => {
    const localhostUrls = [
      "http://localhost/api",
      "http://LOCALHOST/api",
      "http://127.0.0.1/api",
      "http://127.0.0.2/api",
      "http://127.1.1.1/api",
      "http://0.0.0.0/api",
      "http://[::1]/api"
    ];

    localhostUrls.forEach((url) => {
      it(`应该阻止 ${url}`, () => {
        assert.throws(
          () => normalizeSource({
            id: "test-source",
            name: "Test",
            kind: "official-website",
            officialUrl: url,
            officialFormat: "json",
            versionPath: "version"
          }),
          { message: /不能指向内网或本地地址/ }
        );
      });
    });
  });

  describe("阻止私有 IPv4 地址", () => {
    const privateIpUrls = [
      // 10.0.0.0/8 - 私有网络 A 类
      "http://10.0.0.1/api",
      "http://10.255.255.255/api",
      
      // 172.16.0.0/12 - 私有网络 B 类
      "http://172.16.0.1/api",
      "http://172.31.255.255/api",
      
      // 192.168.0.0/16 - 私有网络 C 类
      "http://192.168.1.1/api",
      "http://192.168.255.255/api",
      
      // 169.254.0.0/16 - Link-local（云元数据）
      "http://169.254.169.254/latest/meta-data",
      "http://169.254.0.1/api",
      
      // 100.64.0.0/10 - 共享地址空间
      "http://100.64.0.1/api",
      "http://100.127.255.255/api",
      
      // 224.0.0.0/4 - 组播地址
      "http://224.0.0.1/api",
      "http://239.255.255.255/api",
      
      // 240.0.0.0/4 - 保留地址
      "http://240.0.0.1/api",
      "http://255.255.255.255/api"
    ];

    privateIpUrls.forEach((url) => {
      it(`应该阻止 ${url}`, () => {
        assert.throws(
          () => normalizeSource({
            id: "test-source",
            name: "Test",
            kind: "official-website",
            officialUrl: url,
            officialFormat: "json",
            versionPath: "version"
          }),
          { message: /不能指向内网或本地地址/ }
        );
      });
    });
  });

  describe("阻止私有 IPv6 地址", () => {
    const privateIpv6Urls = [
      "http://[fc00::1]/api",
      "http://[fd00::1]/api",
      "http://[fe80::1]/api",
      "http://[feb0::1]/api"
    ];

    privateIpv6Urls.forEach((url) => {
      it(`应该阻止 ${url}`, () => {
        assert.throws(
          () => normalizeSource({
            id: "test-source",
            name: "Test",
            kind: "official-website",
            officialUrl: url,
            officialFormat: "json",
            versionPath: "version"
          }),
          { message: /不能指向内网或本地地址/ }
        );
      });
    });
  });

  describe("阻止本地域名", () => {
    const localDomains = [
      "http://server.local/api",
      "http://api.internal/data",
      "http://service.private/info",
      "http://test.localhost/api"
    ];

    localDomains.forEach((url) => {
      it(`应该阻止 ${url}`, () => {
        assert.throws(
          () => normalizeSource({
            id: "test-source",
            name: "Test",
            kind: "official-website",
            officialUrl: url,
            officialFormat: "json",
            versionPath: "version"
          }),
          { message: /不能指向内网或本地地址/ }
        );
      });
    });
  });

  describe("允许合法的公网地址", () => {
    const publicUrls = [
      "https://api.github.com/repos/nodejs/node/releases",
      "https://www.google.com/search",
      "http://example.com/api/version",
      "https://8.8.8.8/api",
      "https://1.1.1.1/api",
      "https://registry.npmjs.org/package/latest"
    ];

    publicUrls.forEach((url) => {
      it(`应该允许 ${url}`, () => {
        assert.doesNotThrow(() => {
          normalizeSource({
            id: "test-source",
            name: "Test",
            kind: "official-website",
            officialUrl: url,
            officialFormat: "json",
            versionPath: "version"
          });
        });
      });
    });
  });

  describe("RSS 数据源 SSRF 防护", () => {
    it("应该阻止 RSS 订阅使用内网地址", () => {
      assert.throws(
        () => normalizeSource({
          id: "test-rss",
          name: "Test RSS",
          kind: "rss",
          feedUrl: "http://192.168.1.100/feed.xml"
        }),
        { message: /不能指向内网或本地地址/ }
      );
    });

    it("应该允许 RSS 订阅使用公网地址", () => {
      assert.doesNotThrow(() => {
        normalizeSource({
          id: "test-rss",
          name: "Test RSS",
          kind: "rss",
          feedUrl: "https://github.blog/feed/"
        });
      });
    });
  });

  describe("边界情况", () => {
    it("应该阻止以点结尾的 localhost 变体", () => {
      // 一些系统会将 "127.0.0.1." 视为合法主机名
      assert.throws(
        () => normalizeSource({
          id: "test-source",
          name: "Test",
          kind: "official-website",
          officialUrl: "http://127.0.0.1./api",
          officialFormat: "json",
          versionPath: "version"
        }),
        { message: /不能指向内网或本地地址/ }
      );
    });

    it("应该处理带端口的 URL", () => {
      assert.throws(
        () => normalizeSource({
          id: "test-source",
          name: "Test",
          kind: "official-website",
          officialUrl: "http://192.168.1.1:8080/api",
          officialFormat: "json",
          versionPath: "version"
        }),
        { message: /不能指向内网或本地地址/ }
      );
    });

    it("应该处理带路径和查询参数的 URL", () => {
      assert.throws(
        () => normalizeSource({
          id: "test-source",
          name: "Test",
          kind: "official-website",
          officialUrl: "http://10.0.0.1/api/v1/data?key=value",
          officialFormat: "json",
          versionPath: "version"
        }),
        { message: /不能指向内网或本地地址/ }
      );
    });
  });

  describe("多个 URL 字段的防护", () => {
    it("应该保护 officialUrl 字段", () => {
      assert.throws(
        () => normalizeSource({
          id: "test-source",
          name: "Test",
          kind: "official-website",
          officialUrl: "http://127.0.0.1/api",
          officialFormat: "json",
          versionPath: "version"
        }),
        { message: /不能指向内网或本地地址/ }
      );
    });

    it("应该保护 homepageUrl 字段", () => {
      assert.throws(
        () => normalizeSource({
          id: "test-source",
          name: "Test",
          kind: "official-website",
          officialUrl: "https://example.com/api",
          homepageUrl: "http://192.168.1.1/",
          officialFormat: "json",
          versionPath: "version"
        }),
        { message: /不能指向内网或本地地址/ }
      );
    });

    it("应该保护 feedUrl 字段", () => {
      assert.throws(
        () => normalizeSource({
          id: "test-rss",
          name: "Test RSS",
          kind: "rss",
          feedUrl: "http://localhost:3000/feed.xml"
        }),
        { message: /不能指向内网或本地地址/ }
      );
    });
  });
});
