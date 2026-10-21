import type { UserConfigExport } from '@tarojs/cli';

export default {
  mini: {},
  h5: {
    /**
     * 如需分析 H5 包体积，取消注释并安装 webpack-bundle-analyzer：
     * webpackChain(chain) {
     *   chain.plugin('analyzer').use(require('webpack-bundle-analyzer').BundleAnalyzerPlugin, []);
     * },
     */
  },
} satisfies UserConfigExport<'webpack5'>;
