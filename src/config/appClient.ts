import clientConfig from './clientConfig.generated';

type AppClientConfig = typeof clientConfig;

export const appClient: AppClientConfig = clientConfig;

export const appDisplayName = appClient.companyNameAr;
export const appEnglishName = appClient.companyNameEn;
export const appSystemName = appClient.systemName;
