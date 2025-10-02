import 'config';

declare module 'config' {
  interface IConfig {
    express: {
      staticfiles: boolean;
      trustproxy: boolean;
    };
  }
}
