import type { UserConfigExport } from '@tarojs/cli';

/**
 * 开发配置：实时预览（18080，安全组已开放端口）。
 * 关键：devServer.proxy 把 /petn/api/* 代理到本机 API——
 * 预览页与正式站共用相对路径 /petn/api/v1，远程浏览器才不会打到自己的 127.0.0.1。
 */
export default {
  logger: { quiet: false, stats: true },
  mini: {},
  h5: {
    publicPath: '/',
    router: { mode: 'browser', basename: '/' },
    devServer: {
      host: '0.0.0.0',
      port: 18080,
      allowedHosts: 'all',
      proxy: {
        '/petn/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          pathRewrite: { '^/petn/api': '/api' },
        },
      },
    },
  },
} satisfies UserConfigExport<'webpack5'>;
