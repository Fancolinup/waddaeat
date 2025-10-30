// @ts-ignore
import CryptoJS from 'crypto-js';

/**
 * 接口签名需要的头部字段
 * S-Ca-App：APP KEY
 * S-Ca-Timestamp：当前时间戳
 * S-Ca-Signature：签名字符串
 * S-Ca-Signature-Headers：参与签名的头部字段
 * Content-MD5：请求参数加密的值
 */
interface ISignHeaders {
    'S-Ca-App': string;
    'S-Ca-Timestamp': string;
    'S-Ca-Signature': string;
    'S-Ca-Signature-Headers': string;
    'Content-MD5': string;
}

class SignUtil {
    // APP KEY
    static readonly APP_KEY: string = 'bangomaterial_mobile';
    // APP密钥
    static readonly APP_SECRET: string = 'dome';

    /**
     * 获取签名头部字段
     * @static
     * @param {*} config
     * @memberof SignUtil
     */
    static getSignHeaders(config: any): ISignHeaders {
        const signHeaders: any = {
            'S-Ca-App': SignUtil.APP_KEY,
            'S-Ca-Timestamp': String(new Date().getTime()),
            'S-Ca-Signature-Headers': 'S-Ca-App,S-Ca-Timestamp',
            'Content-MD5': SignUtil.contentMD5(config),
        };
        signHeaders['S-Ca-Signature'] = SignUtil.sign(config, signHeaders);
        return signHeaders;
    }

    /**
     * 计算签名
     * @static
     * @memberof SignUtil
     */
    static sign(config: any, signHeaders: any): string {
        let strSign: any = `${SignUtil.httpMethod(
            config
        )}\n${SignUtil.contentMD5(config)}\n${SignUtil.headers(
            signHeaders
        )}${SignUtil.url(config)}`;
        console.log('待签名字符串:', JSON.stringify(strSign));
        const key = CryptoJS.enc.Utf8.parse(SignUtil.APP_SECRET);
        const message = CryptoJS.enc.Utf8.parse(strSign);
        const hash = CryptoJS.HmacSHA256(message, key);
        return CryptoJS.enc.Base64.stringify(hash);
    }

    /**
     * 请求方式大写
     * @static
     * @param {*} config
     * @return {*}  {string}
     * @memberof SignUtil
     */
    static httpMethod(config: any): string {
        return config.method.toLocaleUpperCase();
    }

    /**
     * 请求参数执行base64+md5的值
     * !get请求直接返回空字符，无需处理
     * @static
     * @param {*} config
     * @return {*}  {string}
     * @memberof SignUtil
     */
    static contentMD5(config: any): string {
        if (config.method === 'post' && config.data) {
            const bodyData = CryptoJS.enc.Utf8.parse(
                JSON.stringify(config.data)
            );
            return CryptoJS.enc.Base64.stringify(CryptoJS.MD5(bodyData));
        } else {
            return '';
        }
    }

    /**
     * 签名计算Header的Key拼接
     * @static
     * @param {*} signHeaders
     * @return {*}  {string}
     * @memberof SignUtil
     */
    static headers(signHeaders: any): string {
        let str = '';
        const sortData = SignUtil.objSort(signHeaders);
        const list = Object.keys(sortData).filter(
            (key: string, index: number) => {
                return key != 'S-Ca-Signature-Headers' && key != 'Content-MD5';
            }
        );
        list.forEach(key => {
            const value = sortData[key];
            str += `${key}:${value ? value : ''}\n`;
        });
        return str;
    }

    /**
     * url拼接
     * post直接返回path，get有参数的情况下拼接url
     * @static
     * @param {*} config
     * @return {*}  {string}
     * @memberof SignUtil
     */
    static url(config: any): string {
        const reqData = config.params || config.data;
        const path = `/${
            config.url
                .split('/')
                .slice(3)
                .join('/')
                .split('?')[0]
        }`;
        if (reqData && config.method === 'get') {
            const sortObj = SignUtil.objSort(reqData);
            const keyList = Object.keys(sortObj);
            let query = '';
            keyList.forEach((key: any, index: number) => {
                const value = sortObj[key];
                if (value) {
                    query += `${key}=${value}${
                        keyList.length - 1 == index ? '' : '&'
                    }`;
                } else {
                    query += `${key}${keyList.length - 1 == index ? '' : '&'}`;
                }
            });
            return `${path}?${query}`;
        } else {
            return path;
        }
    }

    /**
     * 字符串转字节数组
     * @static
     * @param {string} str
     * @return {*}  {number[]}
     * @memberof SignUtil
     */
    static strToUtf8Bytes(str: string): number[] {
        const utf8 = [];
        for (let ii = 0; ii < str.length; ii++) {
            let charCode = str.charCodeAt(ii);
            if (charCode < 0x80) utf8.push(charCode);
            else if (charCode < 0x800) {
                utf8.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
            } else if (charCode < 0xd800 || charCode >= 0xe000) {
                utf8.push(
                    0xe0 | (charCode >> 12),
                    0x80 | ((charCode >> 6) & 0x3f),
                    0x80 | (charCode & 0x3f)
                );
            } else {
                ii++;
                // Surrogate pair:
                // UTF-16 encodes 0x10000-0x10FFFF by subtracting 0x10000 and
                // splitting the 20 bits of 0x0-0xFFFFF into two halves
                charCode =
                    0x10000 +
                    (((charCode & 0x3ff) << 10) | (str.charCodeAt(ii) & 0x3ff));
                utf8.push(
                    0xf0 | (charCode >> 18),
                    0x80 | ((charCode >> 12) & 0x3f),
                    0x80 | ((charCode >> 6) & 0x3f),
                    0x80 | (charCode & 0x3f)
                );
            }
        }
        //兼容汉字，ASCII码表最大的值为127，大于127的值为特殊字符
        for (let jj = 0; jj < utf8.length; jj++) {
            var code: any = utf8[jj];
            if (code > 127) {
                utf8[jj] = code - 256;
            }
        }
        return utf8;
    }

    /**
     * 对象Key按照字典排序
     * todo:这块需要研究，深层次的数据结构，是否做到了字典排序
     * @static
     * @param {*} arys
     * @return {*}
     * @memberof SignUtil
     */
    static objSort(arys: any): any {
        var newkey: any = Object.keys(arys).sort();
        var newObj: any = {};
        for (var i = 0; i < newkey.length; i++) {
            newObj[newkey[i]] = arys[newkey[i]];
        }
        return newObj;
    }
}

export default SignUtil;
