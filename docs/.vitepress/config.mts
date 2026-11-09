import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Lagran CDN',
  description: 'Lagran CDN 部署、使用、调试与运维文档',
  base: '/',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#1677ff' }],
    ['meta', { name: 'description', content: 'Lagran CDN 部署、使用、调试与运维文档' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Lagran CDN',
    nav: [
      { text: '指南', link: '/guide/introduction' },
      { text: '部署', link: '/deploy/' },
      { text: '使用', link: '/use/' },
      { text: '运维', link: '/ops/' },
      { text: '开发', link: '/dev/' },
      { text: '参考', link: '/reference/' },
      {
        text: 'GitHub',
        link: 'https://github.com/Lagran93/Lagran',
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '开始使用',
          items: [
            { text: '项目介绍', link: '/guide/introduction' },
            { text: '快速开始', link: '/guide/quick-start' },
            { text: '系统架构', link: '/guide/architecture' },
          ],
        },
      ],
      '/deploy/': [
        {
          text: '部署',
          items: [
            { text: '部署总览', link: '/deploy/' },
            { text: '部署 Control', link: '/deploy/control' },
            { text: '部署 Edge', link: '/deploy/edge' },
            { text: '部署 DNS', link: '/deploy/dns' },
            { text: 'HTTPS 与证书', link: '/deploy/tls' },
            { text: '升级与回滚', link: '/deploy/upgrade' },
          ],
        },
      ],
      '/use/': [
        {
          text: '控制台使用',
          items: [
            { text: '使用总览', link: '/use/' },
            { text: '项目与域名', link: '/use/domains' },
            { text: '缓存规则与 Cache Key', link: '/use/cache' },
            { text: '刷新与预热', link: '/use/prefetch' },
            { text: 'WAF 与 CC 防护', link: '/use/waf' },
            { text: '证书管理', link: '/use/certificates' },
            { text: '配置发布', link: '/use/releases' },
            { text: 'GeoDNS 调度', link: '/use/geodns' },
          ],
        },
      ],
      '/ops/': [
        {
          text: '运维手册',
          items: [
            { text: '运维总览', link: '/ops/' },
            { text: '监控与健康检查', link: '/ops/monitoring' },
            { text: '备份与恢复', link: '/ops/backup' },
            { text: '故障排查', link: '/ops/troubleshooting' },
            { text: '安全清单', link: '/ops/security' },
          ],
        },
      ],
      '/dev/': [
        {
          text: '开发',
          items: [
            { text: '开发总览', link: '/dev/' },
            { text: '本地开发与测试', link: '/dev/development' },
            { text: '请求流水线', link: '/dev/request-pipeline' },
          ],
        },
      ],
      '/reference/': [
        {
          text: '完整参考',
          items: [
            { text: '参考索引', link: '/reference/' },
            { text: '使用与调试手册', link: '/reference/manual' },
            { text: '部署手册', link: '/reference/deployment' },
            { text: '开发指南', link: '/reference/development' },
            { text: '架构说明', link: '/reference/architecture' },
            { text: 'GeoDNS 流程', link: '/reference/geodns' },
            { text: '告警建议', link: '/reference/alerting' },
          ],
        },
      ],
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档',
          },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除搜索',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭',
            },
          },
        },
      },
    },
    outline: {
      level: [2, 3],
      label: '本页目录',
    },
    docFooter: {
      prev: '上一页',
      next: '下一页',
    },
    lastUpdatedText: '最后更新',
    returnToTopLabel: '回到顶部',
    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '菜单',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Lagran93/Lagran' },
    ],
    editLink: {
      pattern: 'https://github.com/Lagran93/lagran93.github.io/edit/main/docs/:path',
      text: '在 GitHub 编辑此页',
    },
    footer: {
      message: 'Lagran CDN · 边缘加速与调度',
      copyright: 'AGPL-3.0-only',
    },
  },
})
