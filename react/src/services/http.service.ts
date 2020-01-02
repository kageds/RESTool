import { TConfigMethod, IConfigInputField } from '../common/models/config.model';

export type ResponseType = 'json' | 'text' | 'boolean' | 'status';

export interface IFetchParams {
  origUrl: string
  method?: TConfigMethod
  headers?: any
  queryParams?: IConfigInputField[]
  rawData?: any
  body?: any
  responseType?: ResponseType
}

class HttpService {
  public baseUrl: string;
  public unauthorizedRedirectUrl: string;
  public errorMessageDataPath: string | string[];

  constructor(baseUrl: string = '', unauthorizedRedirectUrl: string = '', errorMessageDataPath: string = '') {
    this.baseUrl = baseUrl || '';
    this.unauthorizedRedirectUrl = unauthorizedRedirectUrl || '';
    this.errorMessageDataPath = errorMessageDataPath || '';
  }

  private replaceParamsInUrl(url: string, rawData?: any): string {
    if (!rawData || typeof rawData !== 'object') {
      return url;
    }

    let outputUrl = url;
    
    Object.keys(rawData).forEach((key) => {
      const urlParamName = `:${key}`;
      outputUrl = outputUrl.replace(urlParamName, rawData[key] as string);
    });

    return outputUrl;
  }

  private buildUrl(url: string, queryParams: IConfigInputField[] = [], rawData?: any): string {
    if (!queryParams || !queryParams.length) {
      return this.replaceParamsInUrl(url, rawData);
    }

    let outputUrl = url;
    const params = [];

    for (let param of queryParams) {
      if (!param.name || typeof param.value === 'undefined') {
        continue;
      }

      // TODO: Add docs to "urlReplaceOnly"
      if (param.urlReplaceOnly) {
        const urlParamName = `:${param.name}`;
        outputUrl = outputUrl.replace(urlParamName, param.value as string);
      } else {
        params.push(`${param.name}=${param.value || ''}`);
      }
    }

    if (params.length) {
      const firstSeparator = url.indexOf('?') >= 0 ? '&' : '?';
      return outputUrl + firstSeparator + params.join('&');
    }

    return outputUrl;
  }

  private buildRequest(params: IFetchParams): { url: string, params: any } {
    const finalUrl: string = this.buildUrl(this.baseUrl + params.origUrl, params.queryParams, params.rawData);
    const requestParams = {
      method: params.method || 'get',
      headers: {
        'content-type': 'application/json',
        ...(params.headers || {})
      },
      body: params.method === 'post' || params.method === 'put' ? JSON.stringify(params.body) : undefined
    };

    return {
      url: finalUrl,
      params: requestParams
    };
  }

  private extractDataFromResponse(data: any, dataPath: string, attr: string | null = null) {
    if (!data || !dataPath) {
      if (attr) {
        return data[attr];
      }
      return data;
    }

	
    let extractedData = data;
    const digProps = dataPath.split('.');

    for (let prop of digProps) {
      if (typeof extractedData[prop] !== 'undefined') {
        extractedData = extractedData[prop];
      } else {
        return null;
      }
    }

    if (extractedData != null && attr) {
      return extractedData[attr];
    }

    return extractedData;
  }

  private async getErrorMessage(res: Response | any): Promise<string> {
    let errorMessage: string = '';

    try {
      const body = await res.json();

      for (const path of this.errorMessageDataPath) {
        const dataAtPath = this.extractDataFromResponse(body, path);

        if (dataAtPath) {
          errorMessage = dataAtPath;
        }
      }
    } catch {}

    errorMessage = `${res.status} - ${res.statusText || ''}`;

    return errorMessage;
  }

  private async handleError(res: Response) {
    // In case response status is "Unauthorized", redirect to relevant url
    if (res.status === 401 && this.unauthorizedRedirectUrl) {
      const redirectUrl: string = this.unauthorizedRedirectUrl.replace(':returnUrl', encodeURIComponent(document.location.href));
      document.location.href = redirectUrl;
      return;
    }

    throw new Error(await this.getErrorMessage(res));
  }

  private async makeRequest(url: string, params: any = {}, responseType: ResponseType = 'json') {
    const res: Response = await fetch(url, Object.assign({}, params, {}));
    
    if (res.ok) {
      switch (responseType) {
        case 'json':
          return await res.json();  
        case 'text':
          return await res.text();
        case 'boolean':
          return true;
        default:
          return true;
      }
    }

    await this.handleError(res);
  }

  public async fetch({ method, origUrl, queryParams, rawData, body, headers, responseType }: IFetchParams) {
    const { url, params } = this.buildRequest({ method, origUrl, queryParams, rawData, body, headers });
    return await this.makeRequest(url, params, responseType);
  }
}

export default HttpService;