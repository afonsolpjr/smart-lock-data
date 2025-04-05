import * as qs from 'qs';
import * as crypto from 'crypto';
import { default as axios } from 'axios';
import tuya_data = require("./secret.json");

let token = '';

const config = {
  /* openapi host */
  host: 'https://openapi.tuyaus.com',
  /* fetch from openapi platform */
  accessKey: tuya_data.id,
  /* fetch from openapi platform */
  secretKey: tuya_data.secret,
  /* Interface example device_ID */
  deviceId: tuya_data.device,
};

const httpClient = axios.create({
  baseURL: config.host,
  timeout: 5 * 1e3,
});

async function main() {
  await getToken();
  // const data = await getUserInfo(config.deviceId);
  const data = await getlogs();
  console.log('fetch success: ', data.length);
  console.log(data);  
  var json = JSON.stringify(data);
  const fs = require('node:fs');
  fs.writeFile('test_logs.json', json, err => {
  if (err) {
    console.error(err);
  } else {
    console.log("gravou de boa");
  }
  });

}
/**
 * fetch highway login token
 */
async function getToken() {
  const method = 'GET';
  const timestamp = Date.now().toString();
  const signUrl = '/v1.0/token?grant_type=1';
  const contentHash = crypto.createHash('sha256').update('').digest('hex');
  const stringToSign = [method, contentHash, '', signUrl].join('\n');
  const signStr = config.accessKey + timestamp + stringToSign;

  const headers = {
    t: timestamp,
    sign_method: 'HMAC-SHA256',
    client_id: config.accessKey,
    sign: await encryptStr(signStr, config.secretKey),
  };
  const { data: login } = await httpClient.get('/v1.0/token?grant_type=1', { headers });
  if (!login || !login.success) {
    throw Error(`fetch failed: ${login.msg}`);
  }
  token = login.result.access_token;
}

/**
 * fetch highway business data
 */

async function getTempPW(deviceId: string){
  const query = {};
  const method = 'GET';
  const url = `/v1.1/devices/${deviceId}/door-lock/offline-temp-password`;
  
  const reqHeaders: { [k: string]: string } = await getRequestSign(url, method, {}, query);


  const { data } = await httpClient.request({
    method,
    data: {},
    params: {},
    headers: reqHeaders,
    url: reqHeaders.path,
  });
  if (!data || !data.success) {
    throw Error(`request api failed: ${data.msg}`);
  }
  return data;
}


async function getlogs(){

  let logs: any[] = [];
  let actual_page: number = 1;
  let pg_size: number;
  //pegar primeira pagina

  let response = await getlog(config.deviceId,actual_page,500);
  logs.push(...response.result.logs);
  const total_logs = response.result.total;

  while((logs.length)<total_logs){
    actual_page+=1;
    console.log("pegando pagina: "+ actual_page);
    console.log("tamanho do array = " + logs.length + "   total = " +total_logs);
    pg_size = (total_logs-logs.length<500)? (total_logs-logs.length): 500; 
    response = await getlog(config.deviceId,actual_page,pg_size);
    logs.push(...response.result.logs);    
  }

  return logs;
}

async function getlog(deviceId: string, page_num: number, pg_size: number){
  const query = {
    page_no:page_num,
    page_size:pg_size,
    start_time: new Date(2023,12,25).valueOf(),
    end_time: Date.now()
  };
  const method = 'GET';
  const url = `/v1.1/devices/${deviceId}/door-lock/open-logs`;
  const reqHeaders: { [k: string]: string } = await getRequestSign(url, method, {}, query);


  const { data } = await httpClient.request({
    method,
    data: {},
    params: {},
    headers: reqHeaders,
    url: reqHeaders.path,
  });
  if (!data || !data.success) {
    console.log(data.msg);
    throw Error(`request api failed: ${data.msg}`);
  }
  return data;
}

async function getLotData(deviceId: string){
  const query = {
    "codes":"unlock_fingerprint,unlock_password",
    "page_no":1,
    "page_size":100
  };
  const method = 'GET';
  const url = `/v1.0/smart-lock/devices/${deviceId}/users`;
  const reqHeaders: { [k: string]: string } = await getRequestSign(url, method, {}, query);
  

  const { data } = await httpClient.request({
    method,
    data: {},
    params: {},
    headers: reqHeaders,
    url: reqHeaders.path,
  });
  if (!data || !data.success) {
    throw Error(`request api failed: ${data.msg}`);
  }
  return data;
}
async function getAvailableRemoteUnlock(deviceId: string){
  const query = {};
  const method = 'GET';
  const url = `/v1.0/devices/${deviceId}/door-lock/remote-unlocks`;
  const reqHeaders: { [k: string]: string } = await getRequestSign(url, method, {}, query);


  const { data } = await httpClient.request({
    method,
    data: {},
    params: {},
    headers: reqHeaders,
    url: reqHeaders.path,
  });
  if (!data || !data.success) {
    throw Error(`request api failed: ${data.msg}`);
  }
  return data;
}
async function getDeviceUsers(deviceId: string) {
  const query = {};
  const method = 'GET';
  const url = `/v1.0/devices/${deviceId}/users`;
  const reqHeaders: { [k: string]: string } = await getRequestSign(url, method, {}, query);


  const { data } = await httpClient.request({
    method,
    data: {},
    params: {},
    headers: reqHeaders,
    url: reqHeaders.path,
  });
  if (!data || !data.success) {
    throw Error(`request api failed: ${data.msg}`);
  }
  return data;
}

/**
 * HMAC-SHA256 crypto function
 */
async function encryptStr(str: string, secret: string): Promise<string> {
  return crypto.createHmac('sha256', secret).update(str, 'utf8').digest('hex').toUpperCase();
}

/**
 * request sign, save headers 
 * @param path
 * @param method
 * @param headers
 * @param query
 * @param body
 */
async function getRequestSign(
  path: string,
  method: string,
  headers: { [k: string]: string } = {},
  query: { [k: string]: any } = {},
  body: { [k: string]: any } = {},
) {
  const t = Date.now().toString();
  const [uri, pathQuery] = path.split('?');
  const queryMerged = Object.assign(query, qs.parse(pathQuery));
  const sortedQuery: { [k: string]: string } = {};
  Object.keys(queryMerged)
    .sort()
    .forEach((i) => (sortedQuery[i] = query[i]));

  const querystring = decodeURIComponent(qs.stringify(sortedQuery));
  const url = querystring ? `${uri}?${querystring}` : uri;
  const contentHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const stringToSign = [method, contentHash, '', url].join('\n');
  const signStr = config.accessKey + token + t + stringToSign;
  return {
    t,
    path: url,
    client_id: config.accessKey,
    sign: await encryptStr(signStr, config.secretKey),
    sign_method: 'HMAC-SHA256',
    access_token: token,
  };
}


main().catch(err => {
  throw Error(`error: ${err}`);
});

