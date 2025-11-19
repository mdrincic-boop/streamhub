const isDevelopment = import.meta.env.DEV;

export const config = {
  rtmp: {
    host: import.meta.env.VITE_RTMP_HOST || 'localhost',
    port: parseInt(import.meta.env.VITE_RTMP_PORT || '1935'),
    secure: import.meta.env.VITE_RTMP_SECURE === 'true',
  },
  http: {
    host: import.meta.env.VITE_HTTP_HOST || 'localhost',
    port: parseInt(import.meta.env.VITE_HTTP_PORT || '8000'),
    secure: import.meta.env.VITE_HTTP_SECURE === 'true',
  },
  app: {
    name: import.meta.env.VITE_APP_NAME || 'StreamHub',
    environment: isDevelopment ? 'development' : 'production',
    isDevelopment,
  },
};

export function getRTMPUrl(streamName: string): string {
  const { host, port, secure } = config.rtmp;
  const protocol = secure ? 'rtmps' : 'rtmp';
  const portSuffix = (secure && port === 443) || (!secure && port === 1935) ? '' : `:${port}`;
  return `${protocol}://${host}${portSuffix}/live/${streamName}`;
}

export function getHLSUrl(streamName: string): string {
  const { host, port, secure } = config.http;
  const protocol = secure ? 'https' : 'http';
  const portSuffix = (secure && port === 443) || (!secure && port === 80) ? '' : `:${port}`;
  return `${protocol}://${host}${portSuffix}/live/${streamName}/index.m3u8`;
}

export function getPublicRTMPUrl(): string {
  const { host, port, secure } = config.rtmp;
  const protocol = secure ? 'rtmps' : 'rtmp';
  const portSuffix = (secure && port === 443) || (!secure && port === 1935) ? '' : `:${port}`;
  return `${protocol}://${host}${portSuffix}/live`;
}
