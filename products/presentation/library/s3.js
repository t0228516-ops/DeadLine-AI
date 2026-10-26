'use strict';
/**
 * Шаблон файлдарының жеке қоймасы (Railway Bucket, S3 протоколы). Canva шаблондарын сайттан қайта жүктеу мүмкін емес
 * (лицензия бойынша бір рет жүктеліп, тек біздің серверде сақталады), сондықтан тұрақты қоймада тұрады.
 *
 * Айнымалылар: LIBRARY_S3_ENDPOINT (https://...), LIBRARY_S3_BUCKET, LIBRARY_S3_KEY, LIBRARY_S3_SECRET, LIBRARY_S3_REGION (әдепкі auto)
 *   getObject(key) → Buffer | null;  putObject(key, buf)
 */
const crypto = require('crypto');
const axios = require('axios');

const env = (k) => process.env[k] || '';
const configured = () => !!(env('LIBRARY_S3_ENDPOINT') && env('LIBRARY_S3_BUCKET') && env('LIBRARY_S3_KEY') && env('LIBRARY_S3_SECRET'));

const sha256 = (d) => crypto.createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();

/** AWS Signature V4 (virtual-host не path-style URL) */
function signed(method, key, body, now = new Date()) {
  const endpoint = new URL(env('LIBRARY_S3_ENDPOINT'));
  const region = env('LIBRARY_S3_REGION') || 'auto';
  const bucket = env('LIBRARY_S3_BUCKET');
  // Railway Bucket — virtual-host стилі (bucket.endpoint/key); LIBRARY_S3_PATH_STYLE=1 — endpoint/bucket/key
  const pathStyle = env('LIBRARY_S3_PATH_STYLE') === '1';
  const host = pathStyle ? endpoint.host : `${bucket}.${endpoint.host}`;
  const keyPath = `/${key.split('/').map(encodeURIComponent).join('/')}`;
  const pathName = pathStyle ? `/${bucket}${keyPath}` : keyPath;
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const payloadHash = body ? sha256(body) : sha256('');
  const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const names = Object.keys(headers).sort();
  const canonical = [method, pathName, '', names.map((h) => `${h}:${headers[h]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  let k = hmac(`AWS4${env('LIBRARY_S3_SECRET')}`, day);
  for (const part of [region, 's3', 'aws4_request']) k = hmac(k, part);
  const signature = crypto.createHmac('sha256', k).update(toSign).digest('hex');
  headers.Authorization = `AWS4-HMAC-SHA256 Credential=${env('LIBRARY_S3_KEY')}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  delete headers.host;
  return { url: `${endpoint.protocol}//${host}${pathName}`, headers };
}

async function getObject(key) {
  if (!configured()) return null;
  const { url, headers } = signed('GET', key);
  try {
    const res = await axios.get(url, { headers, responseType: 'arraybuffer', timeout: 30000, maxContentLength: 200 * 1024 * 1024 });
    return Buffer.from(res.data);
  } catch (e) {
    if (e.response && e.response.status === 404) return null;
    throw new Error(`s3 get ${key}: ${e.response ? e.response.status : e.message}`);
  }
}

async function putObject(key, buf) {
  if (!configured()) throw new Error('LIBRARY_S3_* not configured');
  const { url, headers } = signed('PUT', key, buf);
  await axios.put(url, buf, { headers: { ...headers, 'Content-Type': 'application/octet-stream' }, timeout: 300000, maxBodyLength: Infinity, maxContentLength: Infinity });
}

module.exports = { configured, getObject, putObject, signed };
